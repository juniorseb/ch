import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Shell from '../components/Shell'
import BackButton from '../components/BackButton'
import GenerationLoader from '../components/GenerationLoader'
import { useSongDraft } from '../lib/SongDraftContext'
import { improveLyrics } from '../lib/api/song'

// Étape du flow "j'ai déjà mes paroles" : avant de voir le rendu final,
// l'utilisateur choisit de garder son texte tel quel ou de le faire
// améliorer/structurer par l'IA (en gardant son sens et ses idées).
export default function ImproveChoice() {
  const navigate = useNavigate()
  const { draft, setDraft } = useSongDraft()
  const [improving, setImproving] = useState(false)

  async function handleImprove() {
    if (improving) return
    setImproving(true)
    try {
      const improved = await improveLyrics(draft)
      // Le texte final du mode "mes paroles" vit dans draft.ownLyrics.
      setDraft({ ownLyrics: improved })
      navigate('/creer/paroles')
    } catch {
      setImproving(false)
    }
  }

  // Pendant l'amélioration : même page de chargement animée que le flow guidé.
  if (improving) {
    return (
      <GenerationLoader
        title="On sublime tes paroles"
        phrases={[
          'On garde ton message et tes idées…',
          'On structure couplets et refrain…',
          'On peaufine les rimes…',
          'Presque prêt…',
        ]}
      />
    )
  }

  return (
    <Shell logo>
      <BackButton onClick={() => navigate(-1)} className="mb-6" />

      <div className="text-center mb-7">
        <h1 className="text-[22px] md:text-[26px] mb-1">Améliorer ton texte ?</h1>
        <p className="text-[14px] md:text-[16px] text-ink-soft">
          Notre IA peut structurer et sublimer tes paroles, sans changer ton message.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleImprove}
          disabled={improving}
          className="rounded-xl border-2 border-ember-600 bg-ember-50 px-4 py-4 text-left disabled:opacity-60"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[15px] md:text-[17px] font-semibold text-ink">✨ Améliorer avec l'IA</span>
            <span className="text-[11px] md:text-[12px] bg-ember-600 text-cream px-2 py-0.5 rounded-md">Recommandé</span>
          </div>
          <span className="block text-[13px] md:text-[15px] text-ink-soft">
            {improving
              ? 'Amélioration en cours…'
              : 'On garde ton message et tes idées, mais on structure et on embellit pour un rendu pro adapté au style.'}
          </span>
        </button>

        <button
          onClick={() => navigate('/creer/paroles')}
          disabled={improving}
          className="rounded-xl border border-line bg-surface px-4 py-4 text-left disabled:opacity-60"
        >
          <span className="block text-[15px] md:text-[17px] font-semibold text-ink mb-1">📝 Garder mes paroles</span>
          <span className="block text-[13px] md:text-[15px] text-ink-soft">
            Utiliser mon texte exactement tel que je l'ai écrit, sans modification.
          </span>
        </button>
      </div>
    </Shell>
  )
}
