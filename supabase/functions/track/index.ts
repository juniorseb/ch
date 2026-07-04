// supabase/functions/track/index.ts
// Journalise un événement comportemental (funnel). PUBLIC : appelé depuis le
// parcours de création AVANT tout compte. Écrit via service_role dans
// analytics_events (table sans policy publique). Best-effort : on renvoie
// toujours 200 pour ne jamais bloquer l'UI, même si l'insert échoue.
//
// Sécurité : liste blanche stricte d'événements (pas d'écriture arbitraire),
// tailles bornées. Si un JWT valide est présent, on rattache user_id.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

// Événements autorisés = étapes du funnel + conversions clés.
const ALLOWED_EVENTS = new Set([
  'landing',
  'occasion',
  'details',
  'style',
  'improve',
  'lyrics',
  'account',
  'account_created',
  'payment',
  'generation_started',
  'song_completed',
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { visitorId, event, path, meta } = await req.json()

    const ev = String(event ?? '').trim()
    const vid = String(visitorId ?? '').trim().slice(0, 64)
    if (!vid || !ALLOWED_EVENTS.has(ev)) {
      // On ne remonte pas d'erreur exploitable (anti-bruit) mais on n'écrit rien.
      return jsonResponse({ ok: true, ignored: true })
    }

    // user_id best-effort : présent seulement si un JWT valide accompagne l'appel.
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader && authHeader !== `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`) {
      try {
        const userClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } }
        )
        const { data: { user } } = await userClient.auth.getUser()
        userId = user?.id ?? null
      } catch {
        /* anonyme : on ignore */
      }
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { error: insErr } = await admin.from('analytics_events').insert({
      visitor_id: vid,
      user_id: userId,
      event: ev,
      path: typeof path === 'string' ? path.slice(0, 200) : null,
      meta: meta && typeof meta === 'object' ? meta : null,
    })
    if (insErr) {
      console.error('[track] insert error:', JSON.stringify(insErr))
      return jsonResponse({ ok: true, error: insErr.message })
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    // Best-effort : ne jamais faire échouer le parcours pour un souci de tracking.
    console.error('[track] insert échoué:', String(err))
    return jsonResponse({ ok: true, error: true })
  }
})
