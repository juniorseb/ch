import { useEffect, useRef, useState } from 'react'
import Waveform from './Waveform'
import { shareSong } from '../lib/share'
import { recordDownload } from '../lib/downloads'

interface AudioPlayerProps {
  title: string
  // Une ou deux versions audio (Suno en génère deux). URLs vides ignorées.
  versions: string[]
  // Id de la chanson (pour comptabiliser les téléchargements). Optionnel.
  songId?: string
}

// Lecteur réutilisé sur l'écran "chanson prête" et dans la bibliothèque
// (page détail d'une chanson) : bascule de version, play/pause, téléchargement
// et partage. Un seul point de vérité pour éviter deux lecteurs divergents.
export default function AudioPlayer({ title, versions, songId }: AudioPlayerProps) {
  const clips = versions.filter(Boolean)
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [shareMsg, setShareMsg] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  // Si on change de version pendant la lecture, on repart proprement.
  useEffect(() => {
    setPlaying(false)
  }, [active])

  const current = clips[active] ?? ''

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      el.play()
      setPlaying(true)
    }
  }

  async function handleShare() {
    const result = await shareSong(title, current)
    if (result === 'copied') setShareMsg('Lien copié')
    else if (result === 'unavailable') setShareMsg('Partage indisponible')
    else setShareMsg('')
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Pochette : visualisation audio (waveform). */}
      <div
        className="w-36 h-36 md:w-44 md:h-44 rounded-2xl mb-6 flex items-center justify-center border border-ember-600/30"
        style={{
          background:
            'radial-gradient(120% 120% at 30% 20%, rgba(249,115,22,0.22), rgba(249,115,22,0.04) 60%, transparent)',
        }}
      >
        <Waveform animated={playing} />
      </div>

      {clips.length > 1 && (
        <div className="flex bg-surface border border-line rounded-full p-1 mb-6">
          {clips.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`px-4 py-1.5 rounded-full text-[13px] md:text-[15px] font-medium transition-colors ${
                active === i ? 'bg-ember-600 text-cream' : 'text-ink-soft'
              }`}
            >
              Version {i + 1}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={togglePlay}
        disabled={!current}
        className="w-20 h-20 rounded-full bg-ember-600 text-cream flex items-center justify-center mb-6 disabled:opacity-50"
        aria-label={playing ? 'Mettre en pause' : 'Écouter'}
      >
        {playing ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      {current && (
        <audio key={active} ref={audioRef} src={current} onEnded={() => setPlaying(false)} />
      )}

      <div className="flex gap-2.5 w-full">
        <a
          href={current || '#'}
          download
          onClick={() => { if (current) void recordDownload(songId) }}
          aria-disabled={!current}
          className={`flex-1 h-12 rounded-xl border border-line bg-surface flex items-center justify-center gap-2 text-[13px] md:text-[15px] font-semibold text-ink ${
            current ? '' : 'opacity-50 pointer-events-none'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Télécharger
        </a>
        <button
          onClick={handleShare}
          disabled={!current}
          className="flex-1 h-12 rounded-xl border border-line bg-surface flex items-center justify-center gap-2 text-[13px] md:text-[15px] font-semibold text-ink disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 10.6l6.8-3.8M8.6 13.4l6.8 3.8" strokeLinecap="round" />
          </svg>
          Partager
        </button>
      </div>
      {shareMsg && <p className="text-[12px] md:text-[13px] text-clay mt-3">{shareMsg}</p>}
    </div>
  )
}
