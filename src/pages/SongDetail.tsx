import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AudioPlayer from '../components/AudioPlayer'
import BackButton from '../components/BackButton'
import ConfirmModal from '../components/ConfirmModal'
import { useSongHistory, SONGS_REFRESH_EVENT } from '../lib/useSongHistory'
import { deleteSong } from '../lib/api/song'
import { formatSongDate } from '../lib/date'
import { STYLES, OCCASIONS } from '../lib/types'

function label(list: { id: string; label: string }[], id: string) {
  return list.find((x) => x.id === id)?.label ?? id
}

export default function SongDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { songs, loading } = useSongHistory()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(false)

  const song = songs.find((s) => s.id === id)

  async function handleDelete() {
    if (!song || deleting) return
    setDeleting(true)
    setError(false)
    try {
      await deleteSong(song.id)
      // Prévient les listes (accueil, « Mes chansons ») de se rafraîchir.
      window.dispatchEvent(new Event(SONGS_REFRESH_EVENT))
      navigate('/app/chansons', { replace: true })
    } catch {
      setError(true)
      setDeleting(false)
    }
  }

  return (
    <div className="pb-8">
      <BackButton onClick={() => navigate(-1)} className="mb-5" />

      {loading && !song ? (
        <p className="text-[13px] md:text-[15px] text-clay text-center py-10">Chargement…</p>
      ) : !song ? (
        <p className="text-[13px] md:text-[15px] text-clay text-center py-10">Chanson introuvable.</p>
      ) : (
        <div className="flex flex-col items-center text-center">
          <h1 className="text-[24px] md:text-[28px] mb-1">{song.title}</h1>
          <p className="text-[13px] md:text-[15px] text-clay mb-8">
            {[
              label(OCCASIONS, song.occasion),
              song.style ? label(STYLES, song.style) : '',
              formatSongDate(song.createdAt),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <AudioPlayer
            title={song.title}
            versions={[song.audioUrl ?? '', song.audioUrl2 ?? '']}
            songId={song.id}
          />

          {/* Suppression : possible uniquement depuis la page de la chanson.
              Un modal de confirmation évite un effacement accidentel. */}
          <div className="mt-10 w-full flex flex-col items-center">
            <button
              onClick={() => { setError(false); setConfirming(true) }}
              className="inline-flex items-center gap-1.5 text-[13px] md:text-[14px] text-clay hover:text-ember-700 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Supprimer cette chanson
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirming}
        title="Supprimer cette chanson ?"
        message="La chanson et ses deux versions audio seront définitivement supprimées. Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={deleting}
        error={error ? 'La suppression a échoué. Réessaie.' : undefined}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
