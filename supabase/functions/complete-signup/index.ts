// supabase/functions/complete-signup/index.ts
// Appelée juste après signUp() quand l'OTP est DÉSACTIVÉ par l'admin : confirme
// l'email sans code pour que l'utilisateur puisse se connecter tout de suite.
// Ne fait rien si l'OTP est activé (sécurité : on ne contourne pas la
// vérification quand elle est censée s'appliquer).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userId } = await req.json()
    if (!userId) return jsonResponse({ error: 'userId manquant' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'otp_enabled')
      .maybeSingle()

    // Si l'OTP est activé, on refuse : la vérification par code doit s'appliquer.
    if ((setting?.value ?? 'true') !== 'false') {
      return jsonResponse({ error: 'OTP activé, vérification requise' }, 403)
    }

    await supabase.auth.admin.updateUserById(userId, { email_confirm: true })
    return jsonResponse({ confirmed: true })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
