// supabase/functions/verify-email-otp/index.ts
// Vérifie le code à 4 chiffres puis confirme l'email côté Supabase Auth
// (email_confirm: true), ce qui débloque la connexion normale ensuite.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userId, code } = await req.json()
    if (!userId || !code) return jsonResponse({ error: 'userId ou code manquant' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: otp } = await supabase
      .from('email_otps')
      .select('*')
      .eq('user_id', userId)
      .eq('code', code)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!otp) return jsonResponse({ error: 'Code invalide ou expiré' }, 401)

    await supabase.from('email_otps').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id)
    await supabase.auth.admin.updateUserById(userId, { email_confirm: true })

    return jsonResponse({ verified: true })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
