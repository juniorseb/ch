import { supabase, isSupabaseConfigured } from '../supabase'

export interface PaymentRecord {
  id: string
  amountFcfa: number
  creditsPurchased: number
  status: 'pending' | 'success' | 'failed'
  createdAt: string
}

const DEMO_KEY = 'mamelodie:payments'

function readDemoPayments(): PaymentRecord[] {
  try {
    const raw = sessionStorage.getItem(DEMO_KEY)
    return raw ? (JSON.parse(raw) as PaymentRecord[]) : []
  } catch {
    return []
  }
}

// En démo, on enregistre chaque "achat" pour alimenter l'historique.
export function addDemoPayment(p: PaymentRecord): void {
  sessionStorage.setItem(DEMO_KEY, JSON.stringify([p, ...readDemoPayments()]))
}

export async function getPayments(): Promise<PaymentRecord[]> {
  if (!isSupabaseConfigured) return readDemoPayments()
  const { data } = await supabase
    .from('payments')
    .select('id, amount_fcfa, credits_purchased, status, created_at')
    .order('created_at', { ascending: false })
  return (data ?? []).map((r) => ({
    id: r.id as string,
    amountFcfa: r.amount_fcfa as number,
    creditsPurchased: r.credits_purchased as number,
    status: r.status as PaymentRecord['status'],
    createdAt: (r.created_at as string)?.slice(0, 10) ?? '',
  }))
}
