import { useEffect, useState } from 'react'
import { listFeedback, type FeedbackItem } from '../../lib/api/admin'
import Pagination from '../../components/Pagination'

const PAGE_SIZE = 20

function Stars({ n }: { n: number }) {
  return (
    <span className="text-[13px] tracking-wide">
      <span className="text-ember-600">{'★'.repeat(n)}</span>
      <span className="text-line">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

export default function AdminFeedback() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listFeedback(page, PAGE_SIZE)
      .then((r) => { if (!cancelled) { setItems(r.rows); setTotal(r.total) } })
      .catch(() => { if (!cancelled) { setItems([]); setTotal(0) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page])

  return (
    <div>
      <h1 className="text-[22px] md:text-[26px] mb-1">Avis & suggestions</h1>
      <p className="text-[13px] md:text-[15px] text-ink-soft mb-6">Retours laissés par les utilisateurs (les plus récents en premier).</p>

      {loading && total === 0 ? (
        <p className="text-[13px] text-clay">Chargement…</p>
      ) : total === 0 ? (
        <p className="text-[13px] text-clay">Aucun avis pour le moment.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((f) => (
            <div key={f.id} className="bg-surface border border-line rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-[13px] md:text-[15px] font-semibold text-ink truncate">{f.email}</span>
                <span className="text-[11px] md:text-[12px] text-clay shrink-0">{f.createdAt}</span>
              </div>
              {f.rating ? <div className="mb-1.5"><Stars n={f.rating} /></div> : null}
              <p className="text-[13px] md:text-[15px] text-ink-soft whitespace-pre-wrap">{f.message}</p>
            </div>
          ))}
          <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} />
        </div>
      )}
    </div>
  )
}
