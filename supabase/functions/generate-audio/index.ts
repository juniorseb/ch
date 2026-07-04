// supabase/functions/generate-audio/index.ts
// Appelée en tâche de fond (create-song / geniuspay-webhook) une fois les
// paroles prêtes. Crée la tâche musicale chez le fournisseur (SunoAPI principal,
// ApiPass en secours) puis REND LA MAIN immédiatement (pas de polling long :
// l'edge-runtime tue les fonctions qui durent trop). La finalisation vient
// ensuite du CALLBACK (music-webhook, prod) et/ou du sondage check-song-status.
//
// Réglages : music_sunoapi_enabled, music_apipass_enabled, music_primary.
// Secrets  : sunoapi_api_key, apipass_api_key ; FUNCTIONS_PUBLIC_URL + APIPASS_WEBHOOK_SECRET (opt).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { loadSecrets, secretOrEnv } from '../_shared/secrets.ts'
import {
  loadMusicSettings, providerOrder, secretKeyFor, createMusicTask, markFailed,
  type MusicProvider,
} from '../_shared/music.ts'

const MAX_STYLE = 200

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

// URL publique du callback (si configurée) : un seul endpoint pour les deux
// fournisseurs (music-webhook re-interroge selon le provider de la chanson).
function callbackUrl(): string | undefined {
  const base = Deno.env.get('FUNCTIONS_PUBLIC_URL')
  if (!base) return undefined
  const secret = Deno.env.get('APIPASS_WEBHOOK_SECRET')
  const url = `${base.replace(/\/$/, '')}/music-webhook`
  return secret ? `${url}?secret=${encodeURIComponent(secret)}` : url
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

    // Fournisseurs activés, dans l'ordre (principal puis secours).
    const settings = await loadMusicSettings()
    const order = providerOrder(settings)
    if (order.length === 0) {
      await markFailed(supabase, songGenerationId, 'Génération musicale désactivée par l’administrateur')
      return jsonResponse({ error: 'music provider disabled' }, 503)
    }

    const finalLyrics: string = lyrics ?? song.lyrics
    await supabase
      .from('song_generations')
      .update({ lyrics: finalLyrics, status: 'generating_audio' })
      .eq('id', songGenerationId)
    await supabase.channel(`song:${songGenerationId}`).send({
      type: 'broadcast', event: 'status', payload: { status: 'generating_audio' },
    })

    const secrets = await loadSecrets()
    const style = buildStyleTag(song)
    const title = (song.title as string) ?? `Pour ${song.recipient_name}`
    const cb = callbackUrl()

    // Essaie chaque fournisseur activé dans l'ordre ; bascule sur le suivant si
    // la clé manque ou si la création de tâche échoue (panne du prestataire).
    let taskId: string | undefined
    let used: MusicProvider | undefined
    let lastErr = ''
    for (const p of order) {
      const { key, env } = secretKeyFor(p)
      const apiKey = secretOrEnv(secrets, key, env)
      if (!apiKey) { lastErr = `${p}: clé manquante`; continue }
      try {
        taskId = await createMusicTask(p, {
          lyrics: finalLyrics, style, title, apiKey, model: settings.sunoapiModel, callBackUrl: cb,
        })
        used = p
        console.log(`[music] tâche créée via ${p} (task ${taskId})`)
        break
      } catch (e) {
        lastErr = `${p}: ${String(e)}`
        console.error(`[music] ${p} createTask échoué -> secours:`, String(e))
      }
    }

    if (!taskId || !used) {
      await markFailed(supabase, songGenerationId, 'Aucun fournisseur musical disponible. Réessaie.')
      return jsonResponse({ error: `music create failed: ${lastErr}` }, 502)
    }

    await supabase
      .from('song_generations')
      .update({ suno_task_id: taskId, music_provider: used })
      .eq('id', songGenerationId)

    // On rend la main tout de suite. Finalisation via callback + check-song-status.
    return jsonResponse({ status: 'generating_audio', taskId, provider: used })
  } catch (err) {
    console.error('[generate-audio] échec:', String(err))
    if (songId) {
      try {
        await markFailed(supabase, songId, 'La génération musicale a échoué. Réessaie.')
      } catch { /* ignore */ }
    }
    return jsonResponse({ error: String(err) }, 500)
  }
})
