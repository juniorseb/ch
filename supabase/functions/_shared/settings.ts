// Lecture des réglages globaux (table app_settings) côté Edge Functions.
// Sert à activer/désactiver dynamiquement les fournisseurs (IA paroles,
// musique) depuis le panel admin, sans redéploiement.
import { createClient } from 'jsr:@supabase/supabase-js@2'

export async function loadSettings(): Promise<Map<string, string>> {
  try {
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      // service_role si dispo (fonctions authentifiées), sinon anon : la
      // policy de lecture de app_settings est publique de toute façon.
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!
    )
    const { data } = await client.from('app_settings').select('key, value')
    return new Map((data ?? []).map((r) => [r.key as string, r.value as string]))
  } catch {
    // En cas d'échec de lecture : réglages vides -> les valeurs par défaut
    // (dans settingBool) s'appliquent, donc rien n'est bloqué.
    return new Map()
  }
}

export function settingBool(map: Map<string, string>, key: string, dflt: boolean): boolean {
  return (map.get(key) ?? String(dflt)) === 'true'
}

export function settingStr(map: Map<string, string>, key: string, dflt: string): string {
  return map.get(key) ?? dflt
}
