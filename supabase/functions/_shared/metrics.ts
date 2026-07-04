// Journalisation technique : un enregistrement par appel d'API externe.
// Best-effort et non bloquant sur l'échec (le suivi ne doit jamais casser le
// parcours). Écrit dans api_calls via service_role.
import { createClient } from 'jsr:@supabase/supabase-js@2'

export type ApiName = 'openrouter' | 'groq' | 'sunoapi' | 'apipass' | 'resend' | 'geniuspay'

export async function recordApiCall(
  api: ApiName,
  ok: boolean,
  status?: number,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    await admin.from('api_calls').insert({
      api,
      ok,
      status: status ?? null,
      meta: meta ?? null,
    })
  } catch (err) {
    console.error('[metrics] enregistrement échoué:', String(err))
  }
}
