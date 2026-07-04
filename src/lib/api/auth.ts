import { supabase, isSupabaseConfigured } from '../supabase'

export interface SignUpResult {
  userId: string
}

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  if (!isSupabaseConfigured) {
    return { userId: `demo_${Date.now()}` }
  }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  if (!data.user) throw new Error("Échec de l'inscription")
  return { userId: data.user.id }
}

export async function sendSignupOtp(userId: string, email: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    // eslint-disable-next-line no-console
    console.info(`[demo] code de vérification pour ${email}: ${code}`)
    sessionStorage.setItem(`signup-otp:${userId}`, code)
    return
  }
  const { error } = await supabase.functions.invoke('send-email-otp', { body: { userId, email } })
  if (error) throw error
}

// Code de secours accepté en dev/démo pour se connecter sans vrai email.
export const DEV_OTP = '1234'

// Quand l'admin a désactivé l'OTP : confirme l'email sans code, pour que
// l'utilisateur puisse se connecter tout de suite. En démo, rien à faire.
export async function completeSignupWithoutOtp(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return
  // Best-effort : avec l'auto-confirmation d'email, la session existe déjà
  // après signUp. On ne bloque JAMAIS la suite si cette confirmation échoue.
  try {
    await supabase.functions.invoke('complete-signup', { body: { userId } })
  } catch {
    /* ignore */
  }
}

export async function verifySignupOtp(userId: string, code: string): Promise<boolean> {
  if (code === DEV_OTP) return true
  if (!isSupabaseConfigured) {
    return sessionStorage.getItem(`signup-otp:${userId}`) === code
  }
  const { error } = await supabase.functions.invoke('verify-email-otp', { body: { userId, code } })
  return !error
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  // Vide le cache de profil (nom/email/flags) pour ne pas afficher les infos de
  // l'utilisateur précédent au prochain login.
  try {
    localStorage.removeItem('mamelodie:username')
    localStorage.removeItem('mamelodie:email')
    localStorage.removeItem('mamelodie:hasPassword')
    localStorage.removeItem('mamelodie:isAdmin')
  } catch {
    /* ignore */
  }
  if (!isSupabaseConfigured) return
  await supabase.auth.signOut()
}

// Connexion Google (mode réel). Note : l'OAuth redirige hors de l'app ; pour
// conserver le brouillon en cours, il faudra le persister avant redirection.
export async function signInWithGoogle(redirectPath = '/creer/compte'): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${redirectPath}` },
  })
}

// Récupère l'URL d'autorisation Google SANS rediriger (pour l'ouvrir dans une
// popup sur desktop). Le code_verifier PKCE est stocké en localStorage (partagé
// même origine), donc la popup peut finaliser l'échange du code.
export async function googleOAuthUrl(redirectUrl: string): Promise<string> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
  })
  if (error) throw error
  return data.url
}

// Connexion Google en redirection plein écran vers une URL de retour explicite
// (utilisé sur mobile, où les popups sont peu fiables).
export async function signInWithGoogleRedirect(redirectUrl: string): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl },
  })
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/app/profil/mot-de-passe`,
  })
  if (error) throw error
}

export async function updatePassword(newPassword: string): Promise<void> {
  if (!isSupabaseConfigured) return
  // updateUser({password}) DÉFINIT le mot de passe même si le compte n'en avait
  // pas (cas d'une inscription via Google) — pas besoin d'ancien mot de passe.
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// Indique si le compte possède déjà un mot de passe (identité « email »).
// Un compte créé uniquement via Google n'en a pas -> on proposera « Définir »
// plutôt que « Changer ». On regarde les identités ET app_metadata (repli
// fiable) ; par défaut on renvoie true pour ne JAMAIS proposer « Définir » à
// tort à un utilisateur qui a déjà un mot de passe.
const HAS_PW_KEY = 'mamelodie:hasPassword'

export function getCachedHasPassword(): boolean | null {
  try {
    const v = localStorage.getItem(HAS_PW_KEY)
    return v == null ? null : v === '1'
  } catch {
    return null
  }
}

export async function hasPasswordIdentity(): Promise<boolean> {
  if (!isSupabaseConfigured) return true
  const { data } = await supabase.auth.getUser()
  const user = data.user
  let result = true
  if (user) {
    const identities = user.identities ?? []
    const providers = (user.app_metadata?.providers as string[] | undefined) ?? []
    const provider = user.app_metadata?.provider as string | undefined
    result =
      identities.some((i) => i.provider === 'email') ||
      providers.includes('email') ||
      provider === 'email'
  }
  try { localStorage.setItem(HAS_PW_KEY, result ? '1' : '0') } catch { /* ignore */ }
  return result
}

// Un compte suspendu par l'admin ne peut plus utiliser l'app.
export async function isCurrentUserSuspended(): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { data } = await supabase.from('profiles').select('suspended').maybeSingle()
  return !!data?.suspended
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) {
    return sessionStorage.getItem('mamelodie:demo-authed') ? { id: 'demo-user' } : null
  }
  const { data } = await supabase.auth.getUser()
  return data.user
}
