import { useNavigate } from 'react-router-dom'
import type { ReactElement } from 'react'
import Shell from '../components/Shell'
import Stepper from '../components/Stepper'
import BackButton from '../components/BackButton'
import { useSongDraft } from '../lib/SongDraftContext'
import { OCCASIONS } from '../lib/types'

const ICONS: Record<string, ReactElement> = {
  cake: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7" strokeLinecap="round" />
      <path d="M9 12V7M12 12V7M15 12V7" strokeLinecap="round" />
      <path d="M12 4v0" strokeLinecap="round" />
      <circle cx="12" cy="3" r="1" />
    </svg>
  ),
  heart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.5-9.5 9-9.5 9z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  confetti: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20l4-12 12 4-12 4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4l1 2M20 8l2 1M14 9l1.5 1.5" strokeLinecap="round" />
    </svg>
  ),
  sparkles: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" strokeLinecap="round" />
    </svg>
  ),
}

const SUBTITLES: Record<string, string> = {
  anniversaire: 'Souhaite un anniversaire mémorable',
  amour: 'Déclare ton amour en chanson',
  mariage: 'Célèbre une union unique',
  autre: 'Hommage, remerciement, motivation…',
}

export default function Occasion() {
  const navigate = useNavigate()
  const { draft, setDraft } = useSongDraft()

  // Nouvelle chanson : on repart de paroles vierges (sinon celles du brouillon
  // précédent s'afficheraient dans la box à la génération suivante).
  const freshLyrics = { lyrics: '', lyricsSignature: '', lyricsRegenCount: 0 }
  // Détails à remettre à blanc quand on CHANGE d'occasion : évite qu'un lien,
  // un prénom ou une histoire d'une occasion précédente ne fuite dans la
  // nouvelle chanson (ex. « Maman » choisi en Autre puis oublié en Anniversaire).
  const blankDetails = {
    recipientName: '', senderName: '', relation: '', marriageType: '',
    meetContext: '', story: '', songTitle: '',
  }

  function choose(id: (typeof OCCASIONS)[number]['id']) {
    const changed = draft.occasion !== id
    setDraft({ occasion: id, lyricsMode: 'guided', ...freshLyrics, ...(changed ? blankDetails : {}) })
    navigate('/creer/details')
  }

  function useOwnLyrics() {
    // En mode "mes paroles", les infos du destinataire (prénom, histoire…) ne
    // sont pas redemandées : on repart donc à blanc pour ne PAS traîner celles
    // d'une chanson guidée précédente (sinon un ancien nom réapparaîtrait dans
    // l'amélioration ou le titre par défaut).
    setDraft({
      lyricsMode: 'own',
      // Ce mode ne demande pas d'occasion : on met « Autre » (neutre) plutôt
      // que d'hériter d'une occasion d'une chanson précédente (ex. Anniversaire).
      occasion: 'autre',
      ...freshLyrics,
      ownLyrics: '',
      songTitle: '',
      recipientName: '',
      senderName: '',
      relation: '',
      marriageType: '',
      meetContext: '',
      story: '',
    })
    navigate('/creer/paroles-perso')
  }

  return (
    <Shell
      logo
      footer={
        <button
          onClick={useOwnLyrics}
          className="w-full text-[15px] md:text-[17px] font-semibold text-ember-700 py-1"
        >
          J'ai déjà mes paroles ✍️
        </button>
      }
    >
      <BackButton onClick={() => navigate(-1)} className="mb-4" />

      <Stepper steps={['Occasion', 'Détails', 'Style', 'Paroles']} current={0} />

      <h1 className="text-[22px] md:text-[26px] mb-1">Pour quelle occasion ?</h1>
      <p className="text-[13px] md:text-[15px] text-ink-soft mb-6">On adapte les questions à ton évènement.</p>

      <div className="flex flex-col gap-2.5">
        {OCCASIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => choose(o.id)}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-left hover:border-ember-400 transition-colors"
          >
            <span className="w-10 h-10 rounded-lg bg-ember-50 text-ember-700 flex items-center justify-center shrink-0">
              {ICONS[o.icon]}
            </span>
            <span className="flex-1">
              <span className="block text-[15px] md:text-[17px] font-semibold text-ink">{o.label}</span>
              <span className="block text-[12px] md:text-[13px] text-clay">{SUBTITLES[o.id]}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-clay)" strokeWidth="1.8">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </Shell>
  )
}
