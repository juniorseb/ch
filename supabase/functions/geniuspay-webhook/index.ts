// supabase/functions/geniuspay-webhook/index.ts
// Callback GeniusPay (paiement réussi / échoué). Vérifie la signature HMAC
// (si un secret webhook est configuré) puis met à jour le paiement et lance la
// génération musicale.
//
// URL à déclarer dans GeniusPay (Webhooks) :
//   https://<domaine>/functions/v1/geniuspay-webhook
// Secret webhook (whsec_...) : à saisir depuis l'admin (sandbox + live).
// Réf : https://geniuspay.ci/docs/api (section Webhooks)
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { loadSecrets } from '../_shared/secrets.ts'

// Signature = HMAC-SHA256(timestamp + "." + payload, whsec) en hexadécimal.
async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Comparaison à temps constant (évite une attaque temporelle sur la signature).
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const raw = await req.text()
    const env = req.headers.get('X-Webhook-Environment') ?? ''
    const signature = req.headers.get('X-Webhook-Signature') ?? ''
    const timestamp = req.headers.get('X-Webhook-Timestamp') ?? ''

    // Secret webhook du bon environnement (admin -> app_secrets, repli env).
    const secrets = await loadSecrets()
    const secret =
      (env === 'sandbox' ? secrets.get('geniuspay_whsec_sandbox') : secrets.get('geniuspay_whsec_live')) ??
      Deno.env.get(env === 'sandbox' ? 'GENIUSPAY_WEBHOOK_SECRET_SANDBOX' : 'GENIUSPAY_WEBHOOK_SECRET') ??
      ''

    // SÉCURITÉ (fail-closed) : sans secret configuré, on REJETTE — sinon un tiers
    // pourrait forger un « payment.success » et déclencher une génération gratuite.
    if (!secret) {
      console.error(`[geniuspay-webhook] secret webhook manquant (env=${env}) -> rejet`)
      return jsonResponse({ error: 'webhook non configuré' }, 401)
    }
    // Anti-rejeu : timestamp récent (< 5 min).
    const ts = Number(timestamp)
    if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
      return jsonResponse({ error: 'timestamp invalide' }, 400)
    }
    const expected = await hmacHex(secret, `${timestamp}.${raw}`)
    if (!timingSafeEqual(expected, signature)) {
      return jsonResponse({ error: 'signature invalide' }, 401)
    }

    const payload = JSON.parse(raw)
    const event = payload.event
    const data = payload.data
    const songGenerationId = data?.metadata?.song_generation_id
    const paymentId = data?.metadata?.payment_id

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (event === 'payment.success') {
      if (paymentId) {
        await supabase.from('payments').update({ status: 'success' }).eq('id', paymentId)
      }
      if (songGenerationId) {
        // Idempotence : GeniusPay peut renvoyer le même webhook plusieurs fois.
        // On ne (re)lance la génération QUE si elle n'a pas déjà démarré, pour
        // ne pas générer deux fois la même chanson.
        const { data: song } = await supabase
          .from('song_generations')
          .select('status')
          .eq('id', songGenerationId)
          .maybeSingle()

        if (song && song.status === 'pending_payment') {
          // Les paroles sont déjà en base (générées avant paiement) : on passe
          // directement à la génération de la musique.
          await supabase
            .from('song_generations')
            .update({ status: 'generating_audio' })
            .eq('id', songGenerationId)

          // Déclenche generate-audio en tâche de fond (réponse rapide au webhook).
          fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-audio`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ songGenerationId }),
          }).catch(() => {})
        }
      }
    }

    if (event === 'payment.failed' || event === 'payment.expired' || event === 'payment.cancelled') {
      if (paymentId) {
        await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentId)
      }
      if (songGenerationId) {
        await supabase
          .from('song_generations')
          .update({ status: 'failed', error_message: 'Paiement non abouti' })
          .eq('id', songGenerationId)
      }
    }

    return jsonResponse({ received: true })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
