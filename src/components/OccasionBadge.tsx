import { useSongDraft } from '../lib/SongDraftContext'
import { OCCASIONS } from '../lib/types'

const EMOJI: Record<string, string> = {
  anniversaire: '🎂',
  amour: '💖',
  mariage: '💍',
  autre: '✨',
}

// Rappel contextuel de la chanson en cours (occasion + destinataire), affiché
// pour combler l'espace et garder l'utilisateur ancré dans son intention.
// Ne rend rien si aucune occasion n'est encore choisie.
export default function OccasionBadge() {
  const { draft } = useSongDraft()
  if (!draft.occasion) return null

  const label = OCCASIONS.find((o) => o.id === draft.occasion)?.label ?? ''
  const who = draft.recipientName?.trim()

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-ember-50 border border-ember-600/30 px-4 py-2.5 text-[13px] md:text-[15px] text-ink">
      <span>{EMOJI[draft.occasion] ?? '🎵'}</span>
      <span>
        {label}
        {who ? ` pour ${who}` : ''}
      </span>
    </span>
  )
}
