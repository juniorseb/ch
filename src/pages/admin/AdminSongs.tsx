import { useEffect, useState } from 'react'
import { listSongs, type AdminSong } from '../../lib/api/admin'
import Pagination from '../../components/Pagination'

const PAGE_SIZE = 20

const STATUS_LABEL: Record<string, string> = {
  completed: 'Terminée',
  generating_audio: 'Musique en cours',
  generating_lyrics: 'Paroles en cours',
  lyrics_ready: 'Paroles prêtes',
  pending_payment: 'En attente de paiement',
  failed: 'Échouée',
}

export default function AdminSongs() {
  const [songs, setSongs] = useState<AdminSong[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listSongs(page, PAGE_SIZE)
      .then((r) => { if (!cancelled) { setSongs(r.rows); setTotal(r.total) } })
      .catch(() => { if (!cancelled) { setSongs([]); setTotal(0) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page])

  return (
    <div>
      <h1 className="text-[22px] md:text-[26px] mb-1">Chansons générées</h1>
      <p className="text-[13px] md:text-[15px] text-ink-soft mb-6">
        {loading && total === 0 ? 'Chargement…' : `${total.toLocaleString('fr-FR')} chanson${total > 1 ? 's' : ''}`}
      </p>

      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2.5 text-[12px] md:text-[13px] text-clay border-b border-line">
          <span>Titre</span>
          <span className="text-right">Statut</span>
          <span className="text-right">Écoutes</span>
          <span className="text-right">Téléch.</span>
          <span className="text-right">Date</span>
        </div>
        {songs.map((s) => (
          <div
            key={s.id}
            className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 text-[13px] md:text-[15px] border-b border-line last:border-0"
          >
            <span className="min-w-0">
              <span className="block text-ink font-semibold truncate">{s.title}</span>
              <span className="block text-[11px] md:text-[12px] text-clay truncate">{s.style} · {s.author}</span>
            </span>
            <span className="text-clay text-right self-center text-[12px] md:text-[13px]">
              {STATUS_LABEL[s.status] ?? s.status}
            </span>
            <span className="text-ink text-right self-center font-semibold">{s.plays}</span>
            <span className="text-ink text-right self-center font-semibold">{s.downloads}</span>
            <span className="text-clay text-right self-center">{s.createdAt}</span>
          </div>
        ))}
        {!loading && songs.length === 0 && (
          <p className="text-[13px] text-clay text-center py-8">Aucune chanson.</p>
        )}
      </div>

      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} />
    </div>
  )
}
