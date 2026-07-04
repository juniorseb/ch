import { supabase, isSupabaseConfigured } from '../supabase'

// Solde de crédits de l'utilisateur. 1 crédit = 1 chanson.
//
// En mode réel, le solde est calculé côté serveur par la vue SQL
// `user_credits` : somme des crédits achetés (paiements réussis) moins le
// nombre de chansons générées, peu importe à quel achat elles se rattachent.
//
// En mode démo (pas encore de projet Supabase), on simule ce solde dans
// sessionStorage. Il démarre à 0, comme un vrai nouveau compte (aucun crédit
// de bienvenue). Les helpers *Demo ne servent qu'à ce mode local ; en réel,
// l'ajout vient du webhook de paiement et la consommation de la création de
// la chanson.
const DEMO_CREDITS_KEY = 'mamelodie:credits'

export async function getCreditBalance(): Promise<number> {
  if (!isSupabaseConfigured) {
    return Number(sessionStorage.getItem(DEMO_CREDITS_KEY) ?? '0')
  }
  const { data } = await supabase
    .from('user_credits')
    .select('credits_balance')
    .maybeSingle()
  return data?.credits_balance ?? 0
}

export function readDemoCredits(): number {
  return Number(sessionStorage.getItem(DEMO_CREDITS_KEY) ?? '0')
}

export function addCreditsDemo(n: number): void {
  sessionStorage.setItem(DEMO_CREDITS_KEY, String(readDemoCredits() + n))
}

export function consumeCreditDemo(): void {
  sessionStorage.setItem(DEMO_CREDITS_KEY, String(Math.max(0, readDemoCredits() - 1)))
}
