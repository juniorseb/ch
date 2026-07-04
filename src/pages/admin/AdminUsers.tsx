import { useEffect, useState } from 'react'
import { listUsers, setUserSuspended, grantCredits, type AdminUser } from '../../lib/api/admin'
import Pagination from '../../components/Pagination'

const PAGE_SIZE = 20

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [grantFor, setGrantFor] = useState<string | null>(null)
  const [grantAmount, setGrantAmount] = useState('')
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listUsers(page, PAGE_SIZE)
      .then((r) => { if (!cancelled) { setUsers(r.rows); setTotal(r.total) } })
      .catch(() => { if (!cancelled) { setUsers([]); setTotal(0) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page])

  async function toggleSuspend(u: AdminUser) {
    if (busy) return
    setBusy(u.id)
    try {
      await setUserSuspended(u.id, !u.suspended)
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, suspended: !x.suspended } : x)))
    } finally {
      setBusy(null)
    }
  }

  async function confirmGrant(u: AdminUser) {
    const n = parseInt(grantAmount, 10)
    if (!n || n < 1) return
    setBusy(u.id)
    try {
      await grantCredits(u.id, n)
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, credits: x.credits + n } : x)))
      setGrantFor(null)
      setGrantAmount('')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <h1 className="text-[22px] md:text-[26px] mb-1">Utilisateurs</h1>
      <p className="text-[13px] md:text-[15px] text-ink-soft mb-6">
        {loading && total === 0
          ? 'Chargement…'
          : `${total.toLocaleString('fr-FR')} compte${total > 1 ? 's' : ''} · triés par dernière connexion`}
      </p>

      <div className="bg-surface border border-line rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2.5 text-[12px] md:text-[13px] text-clay border-b border-line">
          <span>Email</span>
          <span className="text-right">Chansons</span>
          <span className="text-right">Crédits</span>
          <span className="text-right">Action</span>
        </div>
        {users.map((u) => (
          <div
            key={u.id}
            className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 text-[13px] md:text-[15px] border-b border-line last:border-0 items-center"
          >
            <span className="min-w-0">
              <span className="block text-ink truncate">{u.email}</span>
              <span className="block text-[11px] md:text-[12px] text-clay">
                {u.lastSignInAt ? `Vu le ${u.lastSignInAt}` : 'Jamais connecté'} · inscrit le {u.createdAt}
                {u.suspended && <span className="text-ember-700 font-semibold"> · Suspendu</span>}
              </span>
            </span>
            <span className="text-ink text-right">{u.songs}</span>
            <span className="text-ink text-right font-semibold">{u.credits}</span>
            <span className="text-right">
              {grantFor === u.id ? (
                <span className="inline-flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    autoFocus
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    placeholder="Ex : 5"
                    className="w-14 h-8 rounded-lg border border-line px-2 text-[13px] bg-surface outline-none focus:border-ember-600"
                  />
                  <button
                    onClick={() => confirmGrant(u)}
                    disabled={busy === u.id}
                    className="text-[12px] font-semibold rounded-lg px-2 py-1.5 bg-ember-600 text-cream disabled:opacity-50"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => { setGrantFor(null); setGrantAmount('') }}
                    className="text-[12px] text-clay px-1"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <button
                    onClick={() => { setGrantFor(u.id); setGrantAmount('') }}
                    className="text-[12px] md:text-[13px] font-semibold rounded-lg px-2.5 py-1.5 bg-leaf-100 text-leaf-900"
                  >
                    + Crédits
                  </button>
                  <button
                    onClick={() => toggleSuspend(u)}
                    disabled={busy === u.id}
                    className={`text-[12px] md:text-[13px] font-semibold rounded-lg px-2.5 py-1.5 disabled:opacity-50 ${
                      u.suspended ? 'bg-leaf-100 text-leaf-900' : 'bg-ember-50 text-ember-700'
                    }`}
                  >
                    {busy === u.id ? '…' : u.suspended ? 'Réactiver' : 'Suspendre'}
                  </button>
                </span>
              )}
            </span>
          </div>
        ))}
        {!loading && users.length === 0 && (
          <p className="text-[13px] text-clay text-center py-8">Aucun utilisateur.</p>
        )}
      </div>

      <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} />
    </div>
  )
}
