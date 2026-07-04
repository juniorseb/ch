import { supabase, isSupabaseConfigured } from '../supabase'
import { getCurrentUser } from './auth'

function emailPrefix(email?: string | null): string {
  return email && email.includes('@') ? email.split('@')[0] : ''
}

// --- Cache local (évite le "vide" le temps du chargement à chaque visite de
// l'accueil / du profil). On lit la valeur en cache SYNCHRONE au montage, puis
// on rafraîchit en arrière-plan. Vidé à la déconnexion (voir signOut).
const USERNAME_KEY = 'mamelodie:username'
const EMAIL_KEY = 'mamelodie:email'

export function getCachedUsername(): string | null {
  try { return localStorage.getItem(USERNAME_KEY) } catch { return null }
}
export function getCachedEmail(): string | null {
  try { return localStorage.getItem(EMAIL_KEY) } catch { return null }
}
export function clearProfileCache(): void {
  try {
    localStorage.removeItem(USERNAME_KEY)
    localStorage.removeItem(EMAIL_KEY)
  } catch {
    /* ignore */
  }
}
function cache(key: string, value: string | null | undefined) {
  if (!value) return
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

// Nom d'utilisateur : stocké dans profiles.username, avec pour défaut le
// préfixe de l'email (avant le @).
export async function getUsername(): Promise<string> {
  const user = (await getCurrentUser()) as { email?: string } | null
  if (!isSupabaseConfigured) return emailPrefix(user?.email) || 'invité'
  const { data } = await supabase.from('profiles').select('username, email').maybeSingle()
  const email = (data?.email as string) ?? user?.email
  const name = (data?.username as string) || emailPrefix(email)
  cache(USERNAME_KEY, name)
  cache(EMAIL_KEY, email)
  return name
}

export async function setUsername(name: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.rpc('set_username', { p_username: name.trim() })
  if (error) throw error
  cache(USERNAME_KEY, name.trim())
}
