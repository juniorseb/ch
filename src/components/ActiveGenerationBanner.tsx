import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getActiveGeneration, clearActiveGeneration } from '../lib/activeGeneration'
import { checkSongStatus } from '../lib/api/song'
import { SONGS_REFRESH_EVENT } from '../lib/useSongHistory'
import { track } from '../lib/analytics'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Durée estimée d'une composition (pour la barre de progression).
const EST_MS = 150000

function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// Bannière persistante (affichée dans l'espace connecté) qui suit une chanson
// en cours de composition : progression estimée + minuteur, puis « Écouter »
// dès que c'est prêt. La génération tourne côté serveur : l'utilisateur peut
// naviguer / recharger sans l'interrompre.
export default function ActiveGenerationBanner() {
  const navigate = useNavigate()
  const [active] = useState(getActiveGeneration())
  const [status, setStatus] = useState<'generating' | 'completed' | 'failed'>('generating')
  const [pct, setPct] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [hidden, setHidden] = useState(false)
  // Écoute en avant-première (flux SunoAPI), disponible avant le MP3 final.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!active || !isSupabaseConfigured) return
    let finished = false

    function finish(s: 'completed' | 'failed') {
      if (finished) return
      finished = true
      setStatus(s)
      if (s === 'completed') {
        setPct(100)
        track('song_completed')
        // La chanson est finalisée en base : on demande aux listes (accueil,
        // « Mes chansons ») de se rafraîchir pour l'afficher immédiatement.
        window.dispatchEvent(new Event(SONGS_REFRESH_EVENT))
      }
    }

    async function check() {
      try {
        const res = await checkSongStatus(active!.id)
        if (res.streamUrl) setPreviewUrl(res.streamUrl)
        if (res.status === 'completed') finish('completed')
        else if (res.status === 'failed') finish('failed')
      } catch {
        /* on réessaiera au prochain tick */
      }
    }

    // Chemin principal : broadcast Realtime (callback ou polling serveur).
    const channel = supabase
      .channel(`song:${active.id}`)
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        if (payload.status === 'preview' && payload.streamUrl) setPreviewUrl(payload.streamUrl)
        else if (payload.status === 'completed') finish('completed')
        else if (payload.status === 'failed') finish('failed')
      })
      .subscribe()

    check()
    const poll = setInterval(() => { if (!finished) check() }, 6000)
    const prog = setInterval(() => {
      const t = (Date.now() - active.startedAt) / EST_MS
      setElapsed(Date.now() - active.startedAt)
      if (!finished) setPct(Math.min(95, Math.round(95 * (1 - Math.exp(-2.2 * t)))))
    }, 500)
    // Garde-fou : au-delà de ~5 min, on arrête d'attendre.
    const timeout = setTimeout(() => finish('failed'), 300000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
      clearInterval(prog)
      clearTimeout(timeout)
    }
  }, [active])

  if (!active || hidden || !isSupabaseConfigured) return null

  function dismiss() {
    clearActiveGeneration()
    setHidden(true)
  }
  function listen() {
    clearActiveGeneration()
    setHidden(true)
    navigate(`/app/chansons/${active!.id}`)
  }
  function togglePreview() {
    const el = audioRef.current
    if (!el) return
    if (playing) el.pause()
    else el.play().catch(() => {})
  }

  const border =
    status === 'completed' ? 'border-ember-600' : status === 'failed' ? 'border-ember-700/60' : 'border-ember-600/50'

  return (
    <div className={`mb-5 rounded-xl border ${border} bg-surface-2 p-3.5`}>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-lg bg-ember-50 flex items-center justify-center shrink-0 text-ember-600">
          {status === 'completed' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : status === 'failed' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v5M12 16.5v.5" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="animate-pulse">
              <path d="M9 18V5l10-2v13" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="16" cy="16" r="3" />
            </svg>
          )}
        </span>

        <div className="flex-1 min-w-0">
          <div className="text-[14px] md:text-[15px] font-semibold text-ink truncate">
            {status === 'completed'
              ? '🎉 Ta chanson est prête !'
              : status === 'failed'
                ? 'La composition a échoué'
                : 'Ta chanson est en cours…'}
          </div>
          <div className="text-[12px] md:text-[13px] text-clay truncate">
            {status === 'completed'
              ? active.title
              : status === 'failed'
                ? 'Réessaie, ou contacte le support si ça persiste.'
                : 'Tu peux continuer à explorer, on te prévient ici.'}
          </div>
        </div>

        {status === 'generating' && (
          // Rebours « doux » : décompte vers 0, puis « presque prêt… » s'il
          // déborde (jamais de 00:00 trompeur -> pas de promesse trahie).
          <span className="text-[12px] md:text-[13px] font-semibold text-ember-700 tabular-nums shrink-0">
            {elapsed < EST_MS ? mmss(EST_MS - elapsed) : 'presque prêt…'}
          </span>
        )}
        {status === 'completed' ? (
          <button
            onClick={listen}
            className="shrink-0 h-9 px-3.5 rounded-lg bg-ember-600 text-cream text-[13px] font-semibold"
          >
            Écouter
          </button>
        ) : (
          <button onClick={dismiss} aria-label="Fermer" className="shrink-0 text-clay p-1 text-[16px] leading-none">
            ✕
          </button>
        )}
      </div>

      {status === 'generating' && (
        <div className="mt-2.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-ember-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Écoute en avant-première : dispo dès que le flux existe, avant le MP3
          final. La version définitive (téléchargeable/partageable) arrivera juste après. */}
      {status === 'generating' && previewUrl && (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-2.5 py-2">
          <button
            onClick={togglePreview}
            aria-label={playing ? 'Pause' : 'Écouter l’aperçu'}
            className="w-8 h-8 rounded-full bg-ember-600 text-cream flex items-center justify-center shrink-0"
          >
            {playing ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <span className="text-[12px] md:text-[13px] text-ember-700 font-medium">
            🎧 Aperçu prêt — écoute pendant qu'on finalise
          </span>
          <audio
            ref={audioRef}
            src={previewUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        </div>
      )}
    </div>
  )
}
