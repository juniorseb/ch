import { Link, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import Pagination from '../components/Pagination'
import { useSongHistory } from '../lib/useSongHistory'
import { usePagination } from '../lib/usePagination'
import { formatSongDate } from '../lib/date'
import { STYLES, OCCASIONS } from '../lib/types'

function styleLabel(id: string) {
  return STYLES.find((s) => s.id === id)?.label ?? id
}
function occasionLabel(id: string) {
  return OCCASIONS.find((o) => o.id === id)?.label ?? id
}

export default function MySongs() {
  const navigate = useNavigate()
  const { songs } = useSongHistory()
  const { pageItems, page, setPage, pageCount, total } = usePagination(songs, 15)

  return (
    <div className="pb-8">
      <BackButton onClick={() => navigate('/app')} className="mb-4" />
      <h1 className="text-[22px] md:text-[26px] mb-5">Mes chansons</h1>
      <div className="flex flex-col gap-2">
        {pageItems.map((song) => (
          <Link
            key={song.id}
            to={`/app/chansons/${song.id}`}
            className="flex items-center gap-3 border border-line bg-surface rounded-xl px-3 py-2.5 hover:border-ember-400 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-ember-50 flex items-center justify-center shrink-0">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--color-ember-600)">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[13px] md:text-[15px] font-semibold text-ink">{song.title}</div>
              <div className="text-[11px] md:text-[12px] text-clay">
                {[occasionLabel(song.occasion), song.style ? styleLabel(song.style) : '', formatSongDate(song.createdAt)]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-clay)" strokeWidth="1.8">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
        {songs.length === 0 && (
          <p className="text-[13px] md:text-[15px] text-clay text-center py-10">Pas encore de chanson créée.</p>
        )}
      </div>

      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} />
    </div>
  )
}
