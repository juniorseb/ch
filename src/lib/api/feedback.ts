import { supabase, isSupabaseConfigured } from '../supabase'
import { getCurrentUser } from './auth'

// Dépôt d'un avis / suggestion par un utilisateur connecté. La RLS impose
// user_id = auth.uid() ; la lecture est réservée à l'admin (admin-api).
export async function submitFeedback(message: string, rating: number | null): Promise<void> {
  const text = message.trim()
  if (!text) return

  if (!isSupabaseConfigured) {
    // Démo : on garde en localStorage pour pouvoir le visualiser dans l'admin.
    try {
      const list = JSON.parse(localStorage.getItem('mamelodie:feedback') ?? '[]')
      list.unshift({
        id: `demo_${Date.now()}`,
        email: 'compte de démonstration',
        rating,
        message: text,
        createdAt: new Date().toISOString().slice(0, 10),
      })
      localStorage.setItem('mamelodie:feedback', JSON.stringify(list))
    } catch {
      /* ignore */
    }
    return
  }

  const user = (await getCurrentUser()) as { id?: string; email?: string } | null
  const { error } = await supabase.from('feedback').insert({
    user_id: user?.id ?? null,
    email: user?.email ?? null,
    rating,
    message: text,
  })
  if (error) throw error
}
