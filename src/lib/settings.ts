import { supabase, isSupabaseConfigured } from './supabase'
import { CREDIT_TIERS, type CreditTier } from './types'

// Réglages globaux de la plateforme, pilotés depuis le panel admin.
//
// otp_enabled : si false, l'inscription saute la vérification par code email
// (utile au lancement pour laisser les premiers inscrits entrer vite). Stocké
// dans app_settings côté serveur ; en démo, dans localStorage.
const OTP_KEY = 'mamelodie:setting:otp_enabled'

export async function isOtpEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return (localStorage.getItem(OTP_KEY) ?? 'true') === 'true'
  }
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'otp_enabled')
    .maybeSingle()
  // Par défaut activé si le réglage n'existe pas encore.
  return (data?.value ?? 'true') === 'true'
}

export function setOtpEnabledDemo(value: boolean): void {
  localStorage.setItem(OTP_KEY, String(value))
}

// Grille de crédits, pilotable depuis l'admin (clé app_settings 'credit_tiers',
// JSON). À défaut, la grille par défaut de types.ts. Lecture publique (RLS).
export async function getCreditTiers(): Promise<CreditTier[]> {
  const parse = (raw: string | null | undefined): CreditTier[] | null => {
    if (!raw) return null
    try {
      const arr = JSON.parse(raw)
      return Array.isArray(arr) && arr.length ? (arr as CreditTier[]) : null
    } catch {
      return null
    }
  }
  if (!isSupabaseConfigured) {
    return parse(localStorage.getItem('mamelodie:setting:credit_tiers')) ?? CREDIT_TIERS
  }
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'credit_tiers')
    .maybeSingle()
  return parse(data?.value) ?? CREDIT_TIERS
}

// Mode GeniusPay (sandbox de test vs production), piloté depuis l'admin.
export async function isGeniuspaySandbox(): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return localStorage.getItem('mamelodie:setting:geniuspay_sandbox') === 'true'
  }
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'geniuspay_sandbox')
    .maybeSingle()
  return (data?.value ?? 'false') === 'true'
}
