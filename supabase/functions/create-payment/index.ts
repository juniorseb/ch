// supabase/functions/create-payment/index.ts
// Crée payments + song_generations pour l'utilisateur authentifié (le JWT
// est transmis automatiquement par supabase.functions.invoke côté client),
// puis démarre un checkout GeniusPay. Le téléphone n'est utilisé ici que
// comme contact de paiement mobile money, pas comme identifiant.
// Clés GeniusPay : saisies depuis l'admin (app_secrets) OU en repli via les
// variables d'env GENIUSPAY_API_KEY / GENIUSPAY_API_SECRET.
// Sandbox vs live = clés différentes (pk_sandbox_/sk_sandbox_ vs *_live_),
// MÊME endpoint. Le mode se pilote depuis l'admin (app_settings.geniuspay_sandbox).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { loadSettings, settingBool } from '../_shared/settings.ts'
import { loadSecrets, secretOrEnv } from '../_shared/secrets.ts'
import { generateSongTitle } from '../_shared/lyrics.ts'
import { recordApiCall } from '../_shared/metrics.ts'

// Grille par défaut (repli si aucune grille custom n'est définie en base).
const DEFAULT_TIERS: Record<string, { credits: number; priceFcfa: number }> = {
  c1: { credits: 1, priceFcfa: 500 },
  c4: { credits: 4, priceFcfa: 1500 },
  c8: { credits: 8, priceFcfa: 2500 },
  c18: { credits: 18, priceFcfa: 5000 },
}

// Endpoint unique GeniusPay (identique sandbox/live).
const GENIUSPAY_URL = 'https://geniuspay.ci/api/v1/merchant/payments'

// Grille effective : soit celle définie par l'admin (app_settings.credit_tiers,
// JSON), soit la grille par défaut.
function resolveTiers(settings: Map<string, string>): Record<string, { credits: number; priceFcfa: number }> {
  const raw = settings.get('credit_tiers')
  if (!raw) return DEFAULT_TIERS
  try {
    const arr = JSON.parse(raw) as Array<{ id: string; credits: number; priceFcfa: number }>
    if (!Array.isArray(arr) || !arr.length) return DEFAULT_TIERS
    return Object.fromEntries(arr.map((t) => [t.id, { credits: t.credits, priceFcfa: t.priceFcfa }]))
  } catch {
    return DEFAULT_TIERS
  }
}

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

    const { tierId, draft, returnUrl, topup } = await req.json()
    const settings = await loadSettings()
    const tier = resolveTiers(settings)[tierId]
    if (!tier || (!topup && !draft)) {
      return jsonResponse({ error: 'Palier de crédits ou détails de chanson manquants' }, 400)
    }
    // Le numéro n'est plus collecté ici : l'utilisateur le saisit sur la page
    // sécurisée de l'agrégateur (GeniusPay).

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: payment, error: insertError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        phone: null,
        tier_id: tierId,
        credits_purchased: tier.credits,
        amount_fcfa: tier.priceFcfa,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) return jsonResponse({ error: insertError.message }, 500)

    // Recharge autonome : on ne crée PAS de chanson (juste des crédits).
    let song: { id: string } | null = null
    if (!topup) {
      // Les paroles sont déjà prêtes (aperçu généré/édité avant paiement).
      const ownLyrics = String(draft.lyrics ?? draft.ownLyrics ?? '').trim()

      // Titre : saisi, sinon proposé par l'IA d'après les paroles, sinon repli.
      let title = (draft.songTitle && String(draft.songTitle).trim()) || ''
      if (!title) title = await generateSongTitle(ownLyrics)
      if (!title) {
        const rn = (draft.recipientName && String(draft.recipientName).trim()) || ''
        title = rn ? `Pour ${rn}` : 'Ma chanson'
      }

      const { data: created, error: songError } = await supabase
        .from('song_generations')
        .insert({
          user_id: user.id,
          occasion: draft.occasion,
          recipient_name: draft.recipientName,
          sender_name: draft.senderName ?? null,
          relation: draft.relation ?? null,
          marriage_type: draft.marriageType ?? null,
          meet_context: draft.meetContext ?? null,
          style: draft.customStyle || draft.style || null,
          voice: draft.voice ?? null,
          ambiance: draft.ambiance ?? null,
          language: (draft.customLanguage && draft.customLanguage.trim()) || draft.language || null,
          story: draft.story ?? null,
          lyrics: ownLyrics || null,
          title,
          status: 'pending_payment',
        })
        .select()
        .single()
      if (songError) return jsonResponse({ error: songError.message }, 500)
      song = created
    }

    // Mode sandbox (test) vs live (production), piloté depuis l'admin ; on
    // choisit le jeu de clés correspondant (même endpoint).
    const sandbox = settingBool(settings, 'geniuspay_sandbox', false)
    const secrets = await loadSecrets()
    const apiKey = sandbox
      ? secretOrEnv(secrets, 'geniuspay_pk_sandbox', 'GENIUSPAY_API_KEY')
      : secretOrEnv(secrets, 'geniuspay_pk_live', 'GENIUSPAY_API_KEY')
    const apiSecret = sandbox
      ? secretOrEnv(secrets, 'geniuspay_sk_sandbox', 'GENIUSPAY_API_SECRET')
      : secretOrEnv(secrets, 'geniuspay_sk_live', 'GENIUSPAY_API_SECRET')

    if (!apiKey || !apiSecret) {
      console.error(`[create-payment] clés GeniusPay ${sandbox ? 'sandbox' : 'live'} manquantes`)
      return jsonResponse({ error: 'Clés GeniusPay non configurées' }, 500)
    }

    // Jeton de connexion à USAGE UNIQUE ajouté à l'URL de retour : permet
    // l'auto-connexion même si le retour s'ouvre dans un AUTRE navigateur
    // (mobile money type Wave -> Safari), pour ne PAS casser l'élan de création.
    let successUrl = returnUrl
    try {
      if (user.email) {
        const { data: link } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: user.email,
        })
        const tokenHash = (link?.properties as { hashed_token?: string } | undefined)?.hashed_token
        if (tokenHash) {
          const sep = returnUrl.includes('?') ? '&' : '?'
          successUrl = `${returnUrl}${sep}login=${encodeURIComponent(tokenHash)}`
        }
      }
    } catch (e) {
      console.error('[create-payment] generateLink échoué (retour sans auto-login):', String(e))
    }

    const geniusRes = await fetch(GENIUSPAY_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
        'Content-Type': 'application/json',
      },
      // payment_method omis -> GeniusPay renvoie une page de checkout où le
      // client choisit son opérateur (Wave, Orange, MTN…) ou la carte.
      body: JSON.stringify({
        amount: tier.priceFcfa,
        currency: 'XOF',
        description: topup
          ? `Recharge ${tier.credits} crédit${tier.credits > 1 ? 's' : ''} Mamélodie`
          : 'Chanson personnalisée Mamélodie',
        success_url: successUrl,
        error_url: returnUrl,
        // Retournées dans le webhook -> on retrouve le paiement / la chanson.
        metadata: { payment_id: payment.id, song_generation_id: song?.id ?? null },
      }),
    })
    // ⚠️ La réponse GeniusPay est enveloppée : { success, data: { checkout_url, ... } }
    const geniusJson = await geniusRes.json().catch(() => ({} as Record<string, unknown>))
    const gd = (geniusJson.data ?? {}) as Record<string, unknown>
    const checkoutUrl = (gd.checkout_url ?? gd.payment_url) as string | undefined
    const reference = (gd.reference ?? gd.id) as string | number | undefined

    await recordApiCall('geniuspay', geniusRes.ok && !!checkoutUrl, geniusRes.status)

    if (!geniusRes.ok || !checkoutUrl) {
      console.error(
        `[create-payment] GeniusPay (${sandbox ? 'sandbox' : 'live'}) -> ${geniusRes.status}: ${JSON.stringify(geniusJson).slice(0, 400)}`
      )
    }

    await supabase
      .from('payments')
      .update({ geniuspay_reference: reference ? String(reference) : null })
      .eq('id', payment.id)

    return jsonResponse({
      paymentId: payment.id,
      songGenerationId: song?.id ?? null,
      checkoutUrl: checkoutUrl ?? '',
      reference: reference ? String(reference) : payment.id,
    })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
