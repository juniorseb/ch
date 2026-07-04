import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Shell from '../components/Shell'
import Button from '../components/Button'
import Stepper from '../components/Stepper'
import BackButton from '../components/BackButton'
import { useSongDraft } from '../lib/SongDraftContext'
import { STYLES, VOICES, AMBIANCES, LANGUAGES } from '../lib/types'

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-2 text-[13px] md:text-[15px] font-medium transition-colors ${
        active ? 'bg-ember-600 text-cream' : 'bg-surface border border-line text-ink-soft'
      }`}
    >
      {children}
    </button>
  )
}

export default function StyleStep() {
  const navigate = useNavigate()
  const { draft, setDraft } = useSongDraft()
  const [showAllStyles, setShowAllStyles] = useState(false)

  const popular = STYLES.filter((s) => s.popular)
  const rest = STYLES.filter((s) => !s.popular)
  const visibleStyles = showAllStyles ? STYLES : popular

  const stepLabels =
    draft.lyricsMode === 'own'
      ? ['Occasion', 'Tes paroles', 'Style', 'Musique']
      : ['Occasion', 'Détails', 'Style', 'Paroles']

  const styleIsAuto = !draft.style && !draft.customStyle

  function pickStyle(id: string) {
    setDraft({ style: id, customStyle: '' })
  }

  function handleContinue() {
    // Pas de barrière ici (sans compte). En mode "mes paroles", on propose
    // d'abord de les améliorer ; sinon on génère un aperçu de paroles.
    navigate(draft.lyricsMode === 'own' ? '/creer/ameliorer' : '/creer/paroles')
  }

  return (
    <Shell
      logo
      footer={
        <Button className="w-full" onClick={handleContinue}>
          Voir mes paroles
        </Button>
      }
    >
      <BackButton onClick={() => navigate(-1)} className="mb-4" />

      <Stepper steps={stepLabels} current={2} />

      <h1 className="text-[22px] md:text-[26px] mb-1">Choisis le style</h1>
      <p className="text-[13px] md:text-[15px] text-ink-soft mb-6">
        Tout est possible — pioche un style ou tape le tien ✨
      </p>

      {/* Style musical */}
      <h2 className="text-[13px] md:text-[15px] text-clay mb-2.5">Style musical</h2>
      <div className="flex flex-wrap gap-2 mb-2">
        <Chip active={styleIsAuto} onClick={() => setDraft({ style: '', customStyle: '' })}>
          Automatique
        </Chip>
        {visibleStyles.map((s) => (
          <Chip key={s.id} active={draft.style === s.id} onClick={() => pickStyle(s.id)}>
            {s.label}
          </Chip>
        ))}
        {!showAllStyles && rest.length > 0 && (
          <button
            onClick={() => setShowAllStyles(true)}
            className="rounded-full px-3.5 py-2 text-[13px] md:text-[15px] font-medium text-ember-700"
          >
            + Plus de styles
          </button>
        )}
      </div>

      <input
        value={draft.customStyle}
        onChange={(e) => setDraft({ customStyle: e.target.value, style: '' })}
        placeholder="Ex : salsa + slow"
        className="w-full h-11 md:h-12 rounded-lg border border-line px-3 md:px-4 text-[14px] md:text-[16px] bg-surface focus:border-ember-600 outline-none mb-7"
      />

      {/* Voix */}
      <h2 className="text-[13px] md:text-[15px] text-clay mb-2.5">Type de voix</h2>
      <div className="flex flex-wrap gap-2 mb-7">
        {VOICES.map((v) => (
          <Chip key={v.id || 'auto'} active={draft.voice === v.id} onClick={() => setDraft({ voice: v.id })}>
            {v.label}
          </Chip>
        ))}
      </div>

      {/* Ambiance */}
      <h2 className="text-[13px] md:text-[15px] text-clay mb-2.5">Ambiance</h2>
      <div className="flex flex-wrap gap-2 mb-7">
        <Chip active={!draft.ambiance} onClick={() => setDraft({ ambiance: '' })}>
          Automatique
        </Chip>
        {AMBIANCES.map((a) => (
          <Chip
            key={a.id}
            active={draft.ambiance === a.id}
            onClick={() => setDraft({ ambiance: draft.ambiance === a.id ? '' : a.id })}
          >
            {a.label}
          </Chip>
        ))}
      </div>

      {/* Langue */}
      <h2 className="text-[13px] md:text-[15px] text-clay mb-2.5">Langue des paroles</h2>
      <div className="flex flex-wrap gap-2 mb-2">
        {LANGUAGES.map((l) => (
          <Chip
            key={l.id}
            active={draft.language === l.id && !draft.customLanguage}
            onClick={() => setDraft({ language: l.id, customLanguage: '' })}
          >
            {l.label}
          </Chip>
        ))}
      </div>
      <input
        value={draft.customLanguage}
        onChange={(e) => setDraft({ customLanguage: e.target.value, language: '' })}
        placeholder="Ex : bambara, wolof, dioula"
        className="w-full h-11 md:h-12 rounded-lg border border-line px-3 md:px-4 text-[14px] md:text-[16px] bg-surface focus:border-ember-600 outline-none"
      />
    </Shell>
  )
}
