import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import Button from '../components/Button'
import BackButton from '../components/BackButton'
import GenerationError from '../components/GenerationError'
import GenerationLoader from '../components/GenerationLoader'
import { useSongDraft } from '../lib/SongDraftContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { getCurrentUser } from '../lib/api/auth'
import { generateLyricsPreview } from '../lib/api/song'
import { useProceedToGeneration } from '../lib/useProceedToGeneration'
import type { SongDraft } from '../lib/types'

// Nombre maximum de régénérations manuelles (protège les crédits IA : sans
// plafond, un clic répété sur « Régénérer » consommerait sans fin).
const MAX_REGEN = 3

// Signature des entrées qui déterminent les paroles. Si elle n'a pas changé
// au retour, on réaffiche EXACTEMENT les mêmes paroles (pas de régénération
// subie). Elle change dès que l'utilisateur modifie un détail ou le style.
function inputSignature(d: SongDraft): string {
  return JSON.stringify([
    d.occasion, d.recipientName, d.senderName, d.relation, d.marriageType,
    d.meetContext, d.story, d.style, d.customStyle, d.voice, d.ambiance,
    d.language, d.customLanguage,
  ])
}

const DEMO_LYRICS = `[Intro]
Aïcha, douce lumière sur mon chemin

[Couplet 1]
On s'est rencontrés un matin à Marcory
Le riz gras fumait, ton rire a tout changé

[Refrain]
Aïcha, Aïcha, tu illumines mes jours
Aïcha, Aïcha, mon plus bel amour

[Couplet 2]
Trois ans déjà, et chaque jour je découvre
Encore une raison de t'aimer, encore et encore

[Refrain]
Aïcha, Aïcha, tu illumines mes jours
Aïcha, Aïcha, mon plus bel amour

[Pont]
Quoi qu'il arrive, je resterai là
Pour toi, Aïcha, jusqu'au bout, je le sais

[Refrain final]
Aïcha, Aïcha, tu illumines mes jours
Aïcha, Aïcha, mon plus bel amour

[Outro]
Aïcha`

export default function LyricsEdit() {
  const navigate = useNavigate()
  const { draft, setDraft } = useSongDraft()
  const proceed = useProceedToGeneration()
  const [lyrics, setLyrics] = useState('')
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const ownMode = draft.lyricsMode === 'own' && draft.ownLyrics.trim().length > 0
  const regenCount = draft.lyricsRegenCount ?? 0
  const regenLeft = MAX_REGEN - regenCount

  // Génère (ou régénère) les paroles et les mémorise dans le brouillon, avec
  // la signature des entrées et le compteur de régénérations.
  async function generate(count: number) {
    setFailed(false)
    setReady(false)
    const sig = inputSignature(draft)
    try {
      let text: string
      if (!isSupabaseConfigured) {
        await new Promise((r) => setTimeout(r, 1200))
        text = DEMO_LYRICS
      } else {
        text = await generateLyricsPreview(draft)
      }
      setLyrics(text)
      setDraft({ lyrics: text, lyricsSignature: sig, lyricsRegenCount: count })
      setReady(true)
    } catch {
      setFailed(true)
    }
  }

  // Garde-fou : en dev (React StrictMode) l'effet de montage s'exécute deux
  // fois -> sans ce verrou, les paroles seraient générées 2 fois (2 appels IA).
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Mode "mes paroles" : le texte final vit dans ownLyrics, rien à générer.
    if (ownMode) {
      setLyrics(draft.ownLyrics)
      setReady(true)
      return
    }
    // On retrouve les mêmes paroles si les entrées n'ont pas changé.
    if (draft.lyrics && draft.lyricsSignature === inputSignature(draft)) {
      setLyrics(draft.lyrics)
      setReady(true)
      return
    }
    // Première venue OU détails/style modifiés -> génération fraîche (compteur
    // de régénération remis à zéro : c'est un nouveau contexte).
    generate(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Édition manuelle : on persiste tout de suite pour ne rien perdre au retour.
  function handleEdit(value: string) {
    setLyrics(value)
    if (ownMode) setDraft({ ownLyrics: value })
    else setDraft({ lyrics: value })
  }

  function handleRegenerate() {
    if (regenCount >= MAX_REGEN) return
    generate(regenCount + 1)
  }

  // Réessai après échec : ne consomme pas de régénération.
  async function handleRetry() {
    setRetrying(true)
    await generate(regenCount)
    setRetrying(false)
  }

  // Clic "Générer la musique" : c'est ICI qu'on demande le compte (et le
  // paiement si besoin), une fois que l'utilisateur a vu/édité ses paroles.
  async function handleContinue() {
    if (!lyrics.trim() || submitting) return
    setSubmitting(true)
    setDraft({ lyrics })
    const nextDraft = { ...draft, lyrics }
    const user = await getCurrentUser()
    if (user) {
      try {
        await proceed(nextDraft)
      } catch {
        setSubmitting(false)
        setFailed(true)
      }
    } else {
      // Pas encore de compte -> écran compte (puis paiement / génération).
      navigate('/creer/compte')
    }
  }

  if (failed) {
    return (
      <GenerationError
        message="On n'a pas réussi à écrire les paroles."
        onRetry={handleRetry}
        retrying={retrying}
      />
    )
  }

  if (!ready) {
    return (
      <GenerationLoader
        title="On écrit tes paroles"
        phrases={[
          'On s’inspire de ton histoire…',
          'On cherche les plus belles rimes…',
          'On soigne le refrain…',
          'On prépare une jolie intro…',
          'Presque prêt…',
        ]}
      />
    )
  }

  return (
    <Shell logo footer={
      <Button className="w-full" loading={submitting} disabled={!lyrics.trim()} onClick={handleContinue}>
        {submitting ? 'Un instant…' : 'Générer la musique'}
      </Button>
    }>
      <BackButton onClick={() => navigate(-1)} className="mb-4" />

      <h1 className="text-[20px] md:text-[23px] mb-1">Voici les paroles de ta chanson</h1>

      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-[13px] md:text-[15px] text-ink-soft">Tu peux les modifier avant de créer la musique</p>
        {!ownMode && (
          <button
            onClick={handleRegenerate}
            disabled={regenCount >= MAX_REGEN}
            className="shrink-0 inline-flex items-center gap-1.5 text-[13px] md:text-[14px] font-semibold text-ember-700 disabled:text-clay disabled:cursor-not-allowed transition-colors"
            title={regenCount >= MAX_REGEN ? 'Limite de régénérations atteinte' : `Il te reste ${regenLeft} régénération${regenLeft > 1 ? 's' : ''}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {regenCount >= MAX_REGEN ? 'Limite atteinte' : `Régénérer (${regenLeft})`}
          </button>
        )}
      </div>

      <textarea
        value={lyrics}
        onChange={(e) => handleEdit(e.target.value)}
        rows={16}
        className="w-full flex-1 rounded-xl border border-line bg-surface p-4 text-[14px] md:text-[16px] leading-relaxed resize-none focus:border-ember-600 outline-none font-mono"
      />
    </Shell>
  )
}
