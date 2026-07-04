import { useNavigate } from 'react-router-dom'
import { useSongDraft } from './SongDraftContext'
import { isSupabaseConfigured } from './supabase'
import { getCreditBalance, consumeCreditDemo } from './api/credits'
import { createSongFromCredit } from './api/song'
import { setActiveGeneration } from './activeGeneration'
import { track } from './analytics'
import type { SongDraft } from './types'

// Appelé une fois l'utilisateur authentifié (juste après le clic "Générer la
// musique", suivi éventuellement de la création de compte). Vérifie le solde :
// - >= 1 crédit  -> crée la chanson (avec ses paroles) et lance la génération
// - 0 crédit     -> écran de paiement
export function useProceedToGeneration() {
  const navigate = useNavigate()
  const { setSongGenerationId, resetDraft } = useSongDraft()

  return async function proceed(draft: SongDraft): Promise<void> {
    const balance = await getCreditBalance()
    if (balance >= 1) {
      const { songGenerationId } = await createSongFromCredit(draft)
      setSongGenerationId(songGenerationId)
      track('generation_started')

      if (!isSupabaseConfigured) {
        // Démo (local, sans backend) : on garde l'écran de génération court.
        consumeCreditDemo()
        navigate('/creer/generation')
        return
      }

      // Réel : la composition tourne côté serveur. On la suit en arrière-plan
      // via une bannière sur le dashboard (l'utilisateur reste libre).
      setActiveGeneration({
        id: songGenerationId,
        title: draft.songTitle?.trim() || `Pour ${draft.recipientName || 'toi'}`,
        startedAt: Date.now(),
      })
      // La chanson est créée côté serveur : le brouillon n'a plus d'utilité.
      // On le remet à zéro pour que la prochaine chanson reparte vierge (aucun
      // nom, style ou parole d'une chanson précédente qui traînerait).
      resetDraft()
      navigate('/creer/lancement')
    } else {
      navigate('/creer/paiement')
    }
  }
}
