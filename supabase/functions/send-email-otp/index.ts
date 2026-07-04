// supabase/functions/send-email-otp/index.ts
// Appelée juste après supabase.auth.signUp() côté frontend. Génère un code
// à 4 chiffres, le stocke dans email_otps, et l'envoie par email via Resend.
// Secret : RESEND_API_KEY (ou clé saisie depuis l'admin, app_secrets).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { loadSecrets, secretOrEnv } from '../_shared/secrets.ts'
import { loadSettings, settingStr } from '../_shared/settings.ts'
import { recordApiCall } from '../_shared/metrics.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userId, email } = await req.json()
    if (!userId || !email) return jsonResponse({ error: 'userId ou email manquant' }, 400)

    const code = String(Math.floor(1000 + Math.random() * 9000))

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabase.from('email_otps').insert({
      user_id: userId,
      email,
      code,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

    const resendKey = secretOrEnv(await loadSecrets(), 'resend_api_key', 'RESEND_API_KEY')
    if (!resendKey) return jsonResponse({ error: 'Clé Resend manquante' }, 500)

    // Adresse d'expéditeur configurable (app_settings.email_from). Par défaut
    // le domaine de prod ; pour tester avant vérification DNS on peut mettre
    // « Mamélodie <onboarding@resend.dev> » (n'envoie qu'au propriétaire Resend).
    const from = settingStr(await loadSettings(), 'email_from', 'Mamélodie <noreply@mamelodie.net>')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'Ton code Mamélodie',
        html: `<p>Ton code de vérification est <strong>${code}</strong>. Il expire dans 10 minutes.</p>`,
      }),
    })

    await recordApiCall('resend', res.ok, res.status)
    if (!res.ok) {
      // On NE prétend PAS avoir envoyé : l'appelant doit savoir que ça a échoué
      // (sinon l'utilisateur attend un code qui n'arrivera jamais).
      const detail = await res.text()
      console.error(`[send-email-otp] Resend ${res.status}: ${detail}`)
      return jsonResponse({ error: `Envoi email échoué (${res.status})` }, 502)
    }

    return jsonResponse({ sent: true })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
