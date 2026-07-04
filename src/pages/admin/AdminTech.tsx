import { useEffect, useState } from 'react'
import { getApiMetrics, type ApiMetric, type FunnelPeriod } from '../../lib/api/admin'

// Métadonnées d'affichage par API (libellé lisible + rôle).
const API_INFO: Record<string, { label: string; role: string }> = {
  openrouter: { label: 'OpenRouter', role: 'Paroles (gpt-4o-mini)' },
  groq: { label: 'Groq', role: 'Paroles (secours)' },
  apipass: { label: 'ApiPass', role: 'Musique (générations facturées)' },
  resend: { label: 'Resend', role: 'Emails (codes, resets)' },
  geniuspay: { label: 'GeniusPay', role: 'Paiements' },
}

const PERIODS: { id: FunnelPeriod; label: string }[] = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '12m', label: '12 mois' },
  { id: 'all', label: 'Tout' },
]

function pct(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString('fr-FR')} %`
}

export default function AdminTech() {
  const [period, setPeriod] = useState<FunnelPeriod>('30d')
  const [rows, setRows] = useState<ApiMetric[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getApiMetrics(period)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [period])

  // Ordre stable (par volume décroissant).
  const sorted = [...rows].sort((a, b) => b.total - a.total)
  const totalCalls = rows.reduce((s, r) => s + r.total, 0)
  const totalErrors = rows.reduce((s, r) => s + r.errors, 0)
  const maxTotal = sorted.length ? Math.max(...sorted.map((r) => r.total)) : 0

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <div>
          <h1 className="text-[22px] md:text-[26px] mb-1">Technique</h1>
          <p className="text-[13px] md:text-[15px] text-ink-soft">Appels aux API externes et taux d'erreur.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] md:text-[13px] font-medium ${
                period === p.id ? 'bg-deep text-cream' : 'text-ink-soft hover:bg-ember-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 my-5">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-[12px] md:text-[13px] text-clay mb-1">Appels totaux</div>
          <div className="font-display text-[22px] md:text-[26px] font-semibold text-ink">
            {totalCalls.toLocaleString('fr-FR')}
          </div>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-[12px] md:text-[13px] text-clay mb-1">Erreurs</div>
          <div className="font-display text-[22px] md:text-[26px] font-semibold text-ink">
            {totalErrors.toLocaleString('fr-FR')}
            <span className="text-[13px] md:text-[15px] text-clay font-normal ml-2">
              {totalCalls ? pct((totalErrors / totalCalls) * 100) : '0 %'}
            </span>
          </div>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-[13px] text-clay text-center py-10">Chargement…</p>
      ) : sorted.length === 0 ? (
        <p className="text-[13px] text-clay text-center py-10">Aucun appel enregistré sur cette période.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.map((r) => {
            const info = API_INFO[r.api] ?? { label: r.api, role: '' }
            const errRate = r.total ? (r.errors / r.total) * 100 : 0
            const width = maxTotal ? Math.max(2, (r.total / maxTotal) * 100) : 0
            return (
              <div key={r.api} className="bg-surface border border-line rounded-xl p-4">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <span className="text-[14px] md:text-[16px] font-semibold text-ink">{info.label}</span>
                    {info.role && <span className="text-[12px] md:text-[13px] text-clay"> · {info.role}</span>}
                  </div>
                  <div className="text-[13px] md:text-[15px] text-ink tabular-nums shrink-0">
                    <span className="font-semibold">{r.total.toLocaleString('fr-FR')}</span>
                    <span className="text-clay"> appels</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-ember-600 rounded-full" style={{ width: `${width}%` }} />
                </div>
                <div className="text-[11px] md:text-[12px] mt-1">
                  {r.errors > 0 ? (
                    <span className="text-ember-700">
                      {r.errors.toLocaleString('fr-FR')} erreur{r.errors > 1 ? 's' : ''} · {pct(errRate)}
                    </span>
                  ) : (
                    <span className="text-leaf-600">Aucune erreur</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
