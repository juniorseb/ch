// Lecture des SECRETS sensibles (table app_secrets) côté Edge Functions.
// app_secrets n'a aucune policy de lecture -> nécessite le service_role.
// Sert à récupérer les clés d'API (ex. GeniusPay sandbox/live) saisies depuis
// l'admin, avec repli sur les variables d'environnement.
import { createClient } from 'jsr:@supabase/supabase-js@2'

export async function loadSecrets(): Promise<Map<string, string>> {
  try {
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data } = await client.from('app_secrets').select('key, value')
    return new Map((data ?? []).map((r) => [r.key as string, r.value as string]))
  } catch {
    return new Map()
  }
}

// Valeur d'un secret : d'abord app_secrets (admin), sinon variable d'env.
export function secretOrEnv(secrets: Map<string, string>, key: string, envVar: string): string {
  const v = secrets.get(key)
  if (v && v.trim()) return v
  return Deno.env.get(envVar) ?? ''
}
