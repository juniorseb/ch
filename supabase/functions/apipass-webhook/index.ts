// supabase/functions/apipass-webhook/index.ts
// Callback appelé par ApiPass quand la génération musicale (Suno) est terminée.
// C'est le chemin PRINCIPAL recommandé (le polling de generate-audio reste un
// filet de secours). Retrouve la chanson via suno_task_id, vérifie l'état puis
// finalise (MAJ base + broadcast Realtime).
//
// URL de callback (à passer à ApiPass) :
//   ${FUNCTIONS_PUBLIC_URL}/apipass-webhook[?secret=APIPASS_WEBHOOK_SECRET]
// generate-audio la construit automatiquement.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { readTaskState, markCompleted, markFailed } from '../_shared/apipass.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Vérification d'un secret partagé (si configuré) : évite qu'un tiers
    // puisse pousser de fausses URLs audio sur une chanson.
    const expected = Deno.env.get('APIPASS_WEBHOOK_SECRET')
    if (expected) {
      const url = new URL(req.url)
      if (url.searchParams.get('secret') !== expected) {
        return jsonResponse({ error: 'secret invalide' }, 401)
      }
    }

    const body = await req.json()
    const d = (body.data ?? body) as Record<string, unknown>
    const taskId = (d.taskId ?? d.task_id) as string | undefined
    if (!taskId) return jsonResponse({ error: 'taskId manquant' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Retrouve la chanson correspondant à la tâche Suno.
    const { data: song } = await supabase
      .from('song_generations')
      .select('id, status')
      .eq('suno_task_id', taskId)
      .maybeSingle()
    if (!song) return jsonResponse({ error: 'chanson introuvable pour cette tâche' }, 404)

    // Déjà finalisée (callback en double ou polling passé avant) : rien à faire.
    if (song.status === 'completed' || song.status === 'failed') {
      return jsonResponse({ received: true, alreadyFinal: true })
    }

    const result = readTaskState(body)
    if (result.state === 'success' && result.urls[0]) {
      await markCompleted(supabase, song.id as string, result.urls)
    } else if (result.state === 'fail') {
      await markFailed(supabase, song.id as string, result.message)
    } else {
      // Callback reçu mais résultat incomplet : on ne finalise pas (le polling
      // de secours ou un callback ultérieur s'en chargera).
      return jsonResponse({ received: true, pending: true })
    }

    return jsonResponse({ received: true })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
