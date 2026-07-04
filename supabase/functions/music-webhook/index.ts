// supabase/functions/music-webhook/index.ts
// Callback appelé par le fournisseur musical (SunoAPI ou ApiPass) quand la
// génération est terminée. Plutôt que de parser des corps de callback aux
// formats différents, on utilise le callback comme simple SIGNAL : on retrouve
// la chanson via son taskId, puis on RE-INTERROGE le bon fournisseur
// (source de vérité) pour finaliser. Robuste et provider-agnostique.
//
// URL déclarée automatiquement par generate-audio :
//   ${FUNCTIONS_PUBLIC_URL}/music-webhook[?secret=APIPASS_WEBHOOK_SECRET]
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { loadSecrets, secretOrEnv } from '../_shared/secrets.ts'
import { pollMusicTask, markCompleted, markFailed, secretKeyFor, type MusicProvider } from '../_shared/music.ts'

// Extrait le taskId d'un corps de callback (tolérant aux deux formats).
function extractTaskId(body: Record<string, unknown>): string | undefined {
  const d = (body.data ?? {}) as Record<string, unknown>
  const dd = (d.data ?? {}) as Record<string, unknown>
  return (
    (d.taskId as string) ?? (d.task_id as string) ??
    (body.taskId as string) ?? (body.task_id as string) ??
    (dd.taskId as string) ?? (dd.task_id as string)
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Secret partagé optionnel : évite qu'un tiers pousse de faux callbacks.
    const expected = Deno.env.get('APIPASS_WEBHOOK_SECRET')
    if (expected) {
      const url = new URL(req.url)
      if (url.searchParams.get('secret') !== expected) {
        return jsonResponse({ error: 'secret invalide' }, 401)
      }
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const taskId = extractTaskId(body)
    if (!taskId) return jsonResponse({ error: 'taskId manquant' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: song } = await supabase
      .from('song_generations')
      .select('id, status, suno_task_id, music_provider')
      .eq('suno_task_id', taskId)
      .maybeSingle()
    if (!song) return jsonResponse({ error: 'chanson introuvable pour cette tâche' }, 404)

    // Déjà finalisée (callback en double ou polling passé avant).
    if (song.status === 'completed' || song.status === 'failed') {
      return jsonResponse({ received: true, alreadyFinal: true })
    }

    // Re-interroge le fournisseur (source de vérité) pour finaliser.
    const provider = ((song.music_provider as string) || 'apipass') as MusicProvider
    const { key, env } = secretKeyFor(provider)
    const apiKey = secretOrEnv(await loadSecrets(), key, env)
    const result = await pollMusicTask(provider, taskId, apiKey)

    if (result.state === 'success' && result.urls[0]) {
      await markCompleted(supabase, song.id as string, result.urls)
    } else if (result.state === 'fail') {
      await markFailed(supabase, song.id as string, result.message)
    } else {
      return jsonResponse({ received: true, pending: true })
    }

    return jsonResponse({ received: true })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
