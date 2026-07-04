import { useNavigate, Link, Navigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import Shell from '../components/Shell'
import Logo from '../components/Logo'
import Waveform from '../components/Waveform'
import AudienceIcon, { type AudienceIconName } from '../components/AudienceIcon'
import { useSongDraft } from '../lib/SongDraftContext'
import { getCurrentUser } from '../lib/api/auth'
import type { SongDraft } from '../lib/types'

// Chips "Pour qui ?" : chaque clic pré-remplit le brouillon puis envoie vers
// le formulaire de création (occasion / destinataire déjà posés).
const AUDIENCES: { icon: AudienceIconName; label: string; preset: Partial<SongDraft> }[] = [
  { icon: 'cake', label: 'Anniversaire', preset: { occasion: 'anniversaire' } },
  { icon: 'woman', label: 'Maman', preset: { occasion: 'amour', recipientName: 'Maman', relation: 'Parent' } },
  { icon: 'heart', label: 'Amour', preset: { occasion: 'amour' } },
  { icon: 'peace', label: 'Pardon', preset: { occasion: 'autre' } },
  { icon: 'rings', label: 'Mariage', preset: { occasion: 'mariage' } },
  { icon: 'friends', label: 'Ami(e)', preset: { occasion: 'anniversaire', relation: 'Ami(e)' } },
  { icon: 'sparkles', label: 'Autre', preset: { occasion: 'autre' } },
]

// Exemples audio réels en rotation (fichiers dans public/chantsexemples).
// L'ordre suit la numérotation des fichiers fournis.
const EXAMPLES = [
  { title: 'À ma maman', style: 'Fête des mères', url: '/chantsexemples/a-ma-maman.mp3' },
  { title: "Déclaration d'amour", style: 'Amour', url: '/chantsexemples/declaration-amour.mp3' },
  { title: "L'histoire de Jésus", style: 'Gospel', url: '/chantsexemples/histoire-de-jesus.mp3' },
  { title: 'Anniversaire de Junior', style: 'Anniversaire enfant', url: '/chantsexemples/anniversaire-junior.mp3' },
  { title: 'Soutien aux Éléphants', style: 'Hymne', url: '/chantsexemples/soutien-aux-elephants.mp3' },
  { title: 'Jour de mariage', style: 'Mariage', url: '/chantsexemples/mariage.mp3' },
  { title: 'Éléphants, Coupe du monde', style: 'Hymne', url: '/chantsexemples/elephants-coupe-du-monde.mp3' },
  { title: 'Un moment heureux', style: 'Fête', url: '/chantsexemples/moment-heureux.mp3' },
  { title: 'Acapella', style: 'Voix seule', url: '/chantsexemples/acapella.mp3' },
  { title: "L'histoire de Job", style: 'Gospel', url: '/chantsexemples/histoire-de-job.mp3' },
  { title: 'Viens dans le cœur de Dieu', style: 'Gospel', url: '/chantsexemples/viens-dans-le-coeur-de-dieu.mp3' },
]

const ACCENT = 'var(--color-ember-600)'

export default function Landing() {
  const navigate = useNavigate()
  const { setDraft } = useSongDraft()
  const [auth, setAuth] = useState<'checking' | 'authed' | 'anon'>('checking')

  const [exampleIndex, setExampleIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const example = EXAMPLES[exampleIndex]

  function scrollChips(dir: number) {
    chipsRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' })
  }

  useEffect(() => {
    getCurrentUser().then((u) => setAuth(u ? 'authed' : 'anon'))
  }, [])

  useEffect(() => {
    setPlaying(false)
  }, [exampleIndex])

  function chooseAudience(preset: Partial<SongDraft>) {
    // Nouvelle chanson depuis la landing : on repart à blanc (paroles ET détails)
    // puis on applique le preset -> aucun résidu d'un brouillon/occasion précédent.
    setDraft({
      lyricsMode: 'guided',
      lyrics: '', lyricsSignature: '', lyricsRegenCount: 0,
      recipientName: '', senderName: '', relation: '', marriageType: '',
      meetContext: '', story: '', songTitle: '',
      ...preset,
    })
    navigate('/creer/details')
  }

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      el.play().catch(() => {})
      setPlaying(true)
    }
  }

  // Connecté : on ne montre plus la landing, on va directement à l'app.
  if (auth === 'checking') return null
  if (auth === 'authed') return <Navigate to="/app" replace />

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center justify-between mb-9">
        <Logo to={null} />
        <Link
          to="/connexion"
          className="text-[13px] md:text-[15px] font-semibold text-ink border border-line rounded-full px-4 py-2 hover:border-ember-600/50 hover:text-ember-700 transition-colors"
        >
          Se connecter
        </Link>
      </div>

      {/* Slogan + sous-titre */}
      <div className="text-center mb-7">
        <h1 className="text-[32px] md:text-[48px] leading-[1.1] mb-3 text-ink">
          Crée une chanson.
          <br />
          Offre une émotion.
        </h1>
        <p className="text-[15px] md:text-[17px] text-ink-soft leading-relaxed">
          Une chanson unique, personnalisée pour les personnes qui comptent,
          en seulement 2 minutes.
        </p>
      </div>

      {/* CTA principal (remonté, plus imposant) + micro-copy */}
      <button
        onClick={() => navigate('/occasion')}
        className="w-full h-14 md:h-16 rounded-xl bg-ember-600 hover:bg-ember-700 text-cream font-semibold text-[17px] md:text-[20px] transition-all active:scale-[0.98] mb-8"
        style={{ boxShadow: '0 8px 26px -12px rgba(234,106,52,0.32)' }}
      >
        Créer ma chanson
      </button>

      {/* Bloc "Pour qui ?" */}
      <div className="mb-8">
        <p className="text-[13px] md:text-[15px] text-clay mb-2.5">Pour qui ?</p>
        {/* Une seule ligne. PC : flèches ‹ › pour défiler. Mobile : scroll
            tactile + fade sur les bords. */}
        <div className="relative -mx-5 md:mx-0 group">
          <div
            ref={chipsRef}
            className="flex flex-nowrap gap-2 overflow-x-auto px-5 md:px-10 pb-1 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
          >
            {AUDIENCES.map((a) => (
              <button
                key={a.label}
                onClick={() => chooseAudience(a.preset)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] md:text-[15px] font-medium text-ink bg-white/5 border border-white/[0.12] hover:bg-ember-600/15 hover:border-ember-600/40 transition-colors whitespace-nowrap"
              >
                <AudienceIcon name={a.icon} className="shrink-0" />
                {a.label}
              </button>
            ))}
          </div>

          {/* Flèches de défilement (PC uniquement) */}
          <button
            onClick={() => scrollChips(-1)}
            aria-label="Précédent"
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface border border-line text-ink-soft items-center justify-center hover:border-ember-600/50 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => scrollChips(1)}
            aria-label="Suivant"
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface border border-line text-ink-soft items-center justify-center hover:border-ember-600/50 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Dégradés de bord : uniquement sur mobile (indiquent le scroll). */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-6 md:hidden"
            style={{ background: 'linear-gradient(to right, var(--color-bg), transparent)' }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-12 md:hidden"
            style={{ background: 'linear-gradient(to left, var(--color-bg), transparent)' }}
          />
        </div>
      </div>

      {/* Barre de stats (inchangée) */}
      <div className="flex mb-8">
        <div className="flex-1 text-center">
          <div className="font-display text-[18px] md:text-[20px] font-semibold text-ember-600">2 400+</div>
          <div className="text-[11px] md:text-[12px] text-clay">Chansons créées</div>
        </div>
        <div className="flex-1 text-center border-x border-line">
          <div className="font-display text-[18px] md:text-[20px] font-semibold text-ember-600">2 min</div>
          <div className="text-[11px] md:text-[12px] text-clay">Fait en</div>
        </div>
        <div className="flex-1 text-center">
          <div className="font-display text-[18px] md:text-[20px] font-semibold text-ember-600">500 F</div>
          <div className="text-[11px] md:text-[12px] text-clay">À partir de</div>
        </div>
      </div>

      {/* Bloc "Écoute un exemple" (sous les stats, bordure accent + glow + rotation) */}
      <div className="rounded-2xl border border-ember-600 bg-white/[0.03] p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Écouter l’exemple'}
            className="w-12 h-12 rounded-full bg-ember-600 text-cream flex items-center justify-center shrink-0"
            style={{ boxShadow: `0 0 28px 2px rgba(234,106,52,0.45)` }}
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-[13px] md:text-[15px] font-semibold text-ink">Écoute un exemple</div>
            <div className="text-[12px] md:text-[13px] text-ember-700 truncate">
              {example.title} · {example.style}
            </div>
          </div>

          <Waveform bars={8} animated={playing} color={ACCENT} />

          <button
            onClick={() => setExampleIndex((i) => (i + 1) % EXAMPLES.length)}
            aria-label="Exemple suivant"
            className="w-8 h-8 rounded-full border border-line text-ink-soft flex items-center justify-center shrink-0 hover:border-ember-600/50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <audio key={exampleIndex} ref={audioRef} src={example.url} onEnded={() => setPlaying(false)} />

        {/* Dots de rotation */}
        <div className="flex justify-center gap-1.5 mt-3">
          {EXAMPLES.map((_, i) => (
            <button
              key={i}
              onClick={() => setExampleIndex(i)}
              aria-label={`Exemple ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === exampleIndex ? 'w-5 bg-ember-600' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </Shell>
  )
}
