// supabase/functions/generate-audio/index.ts
// Appelée en tâche de fond (create-song / geniuspay-webhook) une fois les
// paroles prêtes. Crée la tâche musicale ApiPass (Suno) puis REND LA MAIN
// immédiatement (pas de polling long : l'edge-runtime tue les fonctions qui
// durent trop). La finalisation se fait ensuite par :
//   - le CALLBACK apipass-webhook (prod, si FUNCTIONS_PUBLIC_URL est défini), et
//   - le sondage de l'écran de génération via check-song-status (local + filet).
//
// Provider activable depuis l'admin (app_settings.music_apipass_enabled).
// Secrets : APIPASS_API_KEY ; FUNCTIONS_PUBLIC_URL + APIPASS_WEBHOOK_SECRET (opt).
// Réf : https://apipass.dev/fr/document/suno-api-integration-guide
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { loadSettings, settingBool } from '../_shared/settings.ts'
import { loadSecrets, secretOrEnv } from '../_shared/secrets.ts'
import { markFailed } from '../_shared/apipass.ts'
import { recordApiCall } from '../_shared/metrics.ts'

const APIPASS_BASE = 'https://api.apipass.dev/api/v1/jobs'

// Contraintes ApiPass/Suno : style <= 200 caractères, prompt (paroles) <= 3000.
const MAX_STYLE = 200
const MAX_PROMPT = 3000

// Construit la description de style (en anglais, comme attendu par Suno) à
// partir des choix : style musical (liste ou libre), ambiance, voix, langue.
function buildStyleTag(song: Record<string, unknown>): string {
  const voice =
    song.voice === 'femme' ? 'female vocals'
    : song.voice === 'homme' ? 'male vocals'
    : song.voice === 'duo' ? 'male and female duet'
    : ''
  const knownLang: Record<string, string> = {
    francais: 'french lyrics',
    anglais: 'english lyrics',
    mix: 'french and english lyrics',
    lingala: 'lingala and french lyrics',
    nouchi: 'ivorian french (nouchi)',
  }
  const rawLang = String(song.language ?? 'francais').trim() || 'francais'
  const lang = knownLang[rawLang] ?? `${rawLang} lyrics`
  return [song.style, song.ambiance, voice, lang].filter(Boolean).join(', ').slice(0, MAX_STYLE)
}

// URL publique du callback ApiPass (si configurée).
function callbackUrl(): string | undefined {
  const base = Deno.env.get('FUNCTIONS_PUBLIC_URL')
  if (!base) return undefined
  const secret = Deno.env.get('APIPASS_WEBHOOK_SECRET')
  const url = `${base.replace(/\/$/, '')}/apipass-webhook`
  return secret ? `${url}?secret=${encodeURIComponent(secret)}` : url
}

// Mode "chanson vocale personnalisée" : paroles + titre + style, customMode=true,
// instrumental=false (guide §1.3). callBackUrl transmis si disponible.
async function createSunoTask(
  lyrics: string,
  style: string,
  title: string,
  apiKey: string,
  callBackUrl?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    model: 'suno/generate',
    input: {
      prompt: lyrics.slice(0, MAX_PROMPT),
      title: title.slice(0, MAX_STYLE),
      style,
      customMode: true,
      instrumental: false,
    },
  }
  if (callBackUrl) body.callBackUrl = callBackUrl

  const res = await fetch(`${APIPASS_BASE}/createTask`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  await recordApiCall('apipass', res.ok, res.status)
  if (!res.ok) throw new Error(`ApiPass createTask ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const taskId = data.taskId ?? data.data?.taskId ?? data.data?.task_id
  if (!taskId) throw new Error('ApiPass : taskId manquant dans la réponse')
  return taskId as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  let songId: string | undefined

  try {
    const { songGenerationId, lyrics } = await req.json()
    songId = songGenerationId

    const { data: song, error } = await supabase
      .from('song_generations')
      .select('*')
      .eq('id', songGenerationId)
      .single()
    if (error || !song) return jsonResponse({ error: 'Chanson introuvable' }, 404)

    // Provider musique activable depuis l'admin.
    const settings = await loadSettings()
    if (!settingBool(settings, 'music_apipass_enabled', true)) {
      await markFailed(supabase, songGenerationId, 'Génération musicale désactivée par l’administrateur')
      return jsonResponse({ error: 'music provider disabled' }, 503)
    }

    // Clé ApiPass depuis l'admin (app_secrets) avec repli sur l'env.
    const apipassKey = secretOrEnv(await loadSecrets(), 'apipass_api_key', 'APIPASS_API_KEY')
    if (!apipassKey) {
      await markFailed(supabase, songGenerationId, 'Clé ApiPass non configurée')
      return jsonResponse({ error: 'apipass key missing' }, 500)
    }

    const finalLyrics: string = lyrics ?? song.lyrics
    await supabase
      .from('song_generations')
      .update({ lyrics: finalLyrics, status: 'generating_audio' })
      .eq('id', songGenerationId)
    await supabase.channel(`song:${songGenerationId}`).send({
      type: 'broadcast', event: 'status', payload: { status: 'generating_audio' },
    })

    const taskId = await createSunoTask(
      finalLyrics,
      buildStyleTag(song),
      (song.title as string) ?? `Pour ${song.recipient_name}`,
      apipassKey,
      callbackUrl()
    )
    await supabase.from('song_generations').update({ suno_task_id: taskId }).eq('id', songGenerationId)

    // On rend la main tout de suite. La finalisation viendra du callback
    // (apipass-webhook) et/ou du sondage frontend (check-song-status).
    return jsonResponse({ status: 'generating_audio', taskId })
  } catch (err) {
    // Toute erreur (ex. appel ApiPass qui échoue) DOIT finaliser la chanson en
    // échec, sinon le frontend attend indéfiniment.
    console.error('[generate-audio] échec:', String(err))
    if (songId) {
      try {
        await markFailed(supabase, songId, 'La génération musicale a échoué. Réessaie.')
      } catch { /* ignore */ }
    }
    return jsonResponse({ error: String(err) }, 500)
  }
})
