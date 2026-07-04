// supabase/functions/check-song-status/index.ts
// Appelée périodiquement par l'écran de génération pour FAIRE AVANCER une
// chanson : interroge ApiPass une seule fois et finalise si prêt. Réponse
// rapide (un appel) -> pas de fonction longue durée tuée par l'edge-runtime.
//
// C'est le moteur de progression en local (où le callback ApiPass ne peut pas
// joindre localhost). En prod, le callback finalise plus tôt ; cette fonction
// voit alors simplement le statut déjà 'completed' en base.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { pollApipass, markCompleted, markFailed } from '../_shared/apipass.ts'
import { loadSecrets, secretOrEnv } from '../_shared/secrets.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Non authentifié' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return jsonResponse({ error: 'Session invalide' }, 401)

    const { songGenerationId } = await req.json()
    if (!songGenerationId) return jsonResponse({ error: 'songGenerationId manquant' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: song } = await admin
      .from('song_generations')
      .select('id, user_id, status, suno_task_id, audio_url, audio_url_2')
      .eq('id', songGenerationId)
      .maybeSingle()
    if (!song || song.user_id !== user.id) return jsonResponse({ error: 'Chanson introuvable' }, 404)

    // Déjà finalisée (par le callback, un autre appel, ou un échec).
    if (song.status === 'completed') {
      return jsonResponse({ status: 'completed', audioUrl: song.audio_url, audioUrl2: song.audio_url_2 })
    }
    if (song.status === 'failed') return jsonResponse({ status: 'failed' })
    // La tâche ApiPass n'a pas encore été créée par generate-audio.
    if (!song.suno_task_id) return jsonResponse({ status: 'pending' })

    // Un seul sondage ApiPass, puis finalisation si prêt.
    const apipassKey = secretOrEnv(await loadSecrets(), 'apipass_api_key', 'APIPASS_API_KEY')
    const result = await pollApipass(song.suno_task_id as string, apipassKey)
    if (result.state === 'success' && result.urls[0]) {
      await markCompleted(admin, song.id as string, result.urls)
      return jsonResponse({ status: 'completed', audioUrl: result.urls[0], audioUrl2: result.urls[1] })
    }
    if (result.state === 'fail') {
      await markFailed(admin, song.id as string, result.message)
      return jsonResponse({ status: 'failed' })
    }
    return jsonResponse({ status: 'generating_audio' })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
