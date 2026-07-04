// Démarre un paiement GeniusPay en passant par l'Edge Function
// `create-payment`, qui détient seule les clés secrètes GeniusPay et crée
// en même temps la ligne `song_generations` correspondante.
import { supabase, isSupabaseConfigured } from '../supabase'
import type { SongDraft } from '../types'

export interface CreatePaymentInput {
  tierId: string
  draft: SongDraft
  // URL de retour dans l'app après le checkout mobile money (mode réel).
  returnUrl?: string
  // Recharge autonome (depuis le profil) : achète des crédits sans créer de
  // chanson.
  topup?: boolean
}

export interface CreatePaymentResult {
  checkoutUrl: string
  reference: string
  songGenerationId: string
}

export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  if (!isSupabaseConfigured) {
    // Mode démo : pas de projet Supabase encore configuré.
    return { checkoutUrl: '', reference: `demo_${Date.now()}`, songGenerationId: `demo_${Date.now()}` }
  }

  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: { tierId: input.tierId, draft: input.draft, returnUrl: input.returnUrl, topup: input.topup },
  })
  if (error) throw error
  return {
    checkoutUrl: data.checkoutUrl ?? '',
    reference: data.reference,
    songGenerationId: data.songGenerationId,
  }
}
