import { useEffect, useState } from 'react'
import BarChart from '../../components/BarChart'
import {
  getStats,
  getSeries,
  getFunnel,
  exportAnalyticsCsv,
  type AdminStats,
  type SeriesPoint,
  type PeriodKey,
  type FunnelPeriod,
  type FunnelResult,
} from '../../lib/api/admin'

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-4">
      <div className="text-[12px] md:text-[13px] text-clay mb-1">{label}</div>
      <div className="font-display text-[22px] md:text-[26px] font-semibold text-ink">{value}</div>
    </div>
  )
}

const PERIODS: { id: PeriodKey; label: string }[] = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '12m', label: '12 mois' },
]

// Étapes ordonnées du parcours (funnel). L'ordre reflète le tunnel réel :
// accueil -> occasion -> détails -> style -> paroles -> compte -> génération.
const FUNNEL_STEPS: { key: string; label: string }[] = [
  { key: 'landing', label: "Visite de l'accueil" },
  { key: 'occasion', label: "Choix de l'occasion" },
  { key: 'details', label: 'Détails / paroles saisis' },
  { key: 'style', label: 'Choix du style' },
  { key: 'lyrics', label: 'Paroles générées vues' },
  { key: 'account', label: 'Étape compte' },
  { key: 'generation_started', label: 'Génération lancée' },
  { key: 'song_completed', label: 'Chanson terminée' },
]

const FUNNEL_PERIODS: { id: FunnelPeriod; label: string }[] = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '12m', label: '12 mois' },
  { id: 'all', label: 'Tout' },
]

function pctText(n: number): string {
  return `${(Math.round(n * 10) / 10).toLocaleString('fr-FR')} %`
}

function Funnel() {
  const [period, setPeriod] = useState<FunnelPeriod>('30d')
  const [data, setData] = useState<FunnelResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState('')

  useEffect(() => {
    setLoading(true)
    getFunnel(period)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [period])

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    setExportNote('')
    try {
      const { count, truncated } = await exportAnalyticsCsv(period)
      setExportNote(
        count === 0
          ? 'Aucune donnée sur cette période.'
          : `${count.toLocaleString('fr-FR')} lignes exportées${truncated ? ' (limité à 50 000)' : ''}.`
      )
    } catch {
      setExportNote("L'export a échoué. Réessaie.")
    } finally {
      setExporting(false)
    }
  }

  const ev = data?.events ?? {}
  const base = ev[FUNNEL_STEPS[0].key]?.visitors ?? 0

  return (
    <div className="bg-surface border border-line rounded-xl p-4 mt-8">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <div>
          <h2 className="text-[16px] md:text-[18px] font-semibold text-ink">Parcours des visiteurs</h2>
          <p className="text-[12px] md:text-[13px] text-clay">
            Déperdition à chaque étape (visiteurs uniques).
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FUNNEL_PERIODS.map((p) => (
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

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="text-[13px] md:text-[15px] text-ink-soft">
          Visiteurs uniques : <span className="font-semibold text-ink">{data ? data.uniqueVisitors : '…'}</span>
        </div>
        <div className="flex items-center gap-2">
          {exportNote && <span className="text-[12px] md:text-[13px] text-clay">{exportNote}</span>}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[12px] md:text-[13px] font-medium text-ink-soft hover:border-ember-400 disabled:opacity-60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {exporting ? 'Export…' : 'Exporter CSV'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-clay text-center py-8">Chargement…</p>
      ) : base === 0 ? (
        <p className="text-[13px] text-clay text-center py-8">Pas encore de données de parcours.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {FUNNEL_STEPS.map((step, i) => {
            const visitors = ev[step.key]?.visitors ?? 0
            const share = base ? (visitors / base) * 100 : 0
            const prev = i > 0 ? ev[FUNNEL_STEPS[i - 1].key]?.visitors ?? 0 : 0
            const stepConv = i > 0 && prev > 0 ? (visitors / prev) * 100 : null
            const dropped = i > 0 && prev > 0 ? prev - visitors : 0
            return (
              <div key={step.key}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[13px] md:text-[14px] text-ink">
                    {i + 1}. {step.label}
                  </span>
                  <span className="text-[12px] md:text-[13px] text-clay tabular-nums">
                    <span className="font-semibold text-ink">{visitors}</span> · {pctText(share)}
                    {stepConv !== null && (
                      <span className="text-ember-700"> · {pctText(stepConv)} de l'étape</span>
                    )}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-ember-600 rounded-full"
                    style={{ width: `${Math.max(share, visitors > 0 ? 2 : 0)}%` }}
                  />
                </div>
                {dropped > 0 && (
                  <div className="text-[11px] md:text-[12px] text-clay mt-0.5">
                    −{dropped} perdu{dropped > 1 ? 's' : ''} à cette étape
                  </div>
                )}
              </div>
            )
          })}

          {/* Conversions clés (hors ligne principale) */}
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-line">
            <div>
              <div className="text-[12px] text-clay">Comptes créés</div>
              <div className="font-display text-[18px] md:text-[20px] font-semibold text-ink">
                {ev['account_created']?.visitors ?? 0}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-clay">Passés au paiement</div>
              <div className="font-display text-[18px] md:text-[20px] font-semibold text-ink">
                {ev['payment']?.visitors ?? 0}
              </div>
            </div>
          </div>

          {/* Pages d'auth dédiées : arrivées vs complétion (qui arrive mais ne finit pas). */}
          <div className="mt-4 pt-3 border-t border-line">
            <div className="text-[12px] md:text-[13px] text-clay mb-2">Pages Connexion / Inscription</div>
            <div className="flex flex-col gap-1.5">
              {[
                { label: 'Inscription', arrived: 'signup_view', done: 'account_created' },
                { label: 'Connexion', arrived: 'login_view', done: 'login' },
              ].map((r) => {
                const a = ev[r.arrived]?.visitors ?? 0
                const d = ev[r.done]?.visitors ?? 0
                const conv = a ? (d / a) * 100 : 0
                return (
                  <div key={r.label} className="flex items-baseline justify-between gap-2 text-[13px] md:text-[14px]">
                    <span className="text-ink">{r.label}</span>
                    <span className="text-clay tabular-nums">
                      <span className="font-semibold text-ink">{a}</span> arrivée{a > 1 ? 's' : ''} ·{' '}
                      <span className="font-semibold text-ink">{d}</span> terminée{d > 1 ? 's' : ''}
                      {a > 0 && <span className="text-ember-700"> · {pctText(conv)}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] md:text-[12px] text-clay mt-1.5">
              « Terminée » pour l'inscription = comptes créés toutes sources (une approximation).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminHome() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [period, setPeriod] = useState<PeriodKey>('7d')
  const [metric, setMetric] = useState<'songs' | 'revenue'>('songs')
  const [series, setSeries] = useState<SeriesPoint[]>([])

  useEffect(() => {
    getStats().then(setStats).catch(() => setStats(null))
  }, [])

  useEffect(() => {
    getSeries(period).then(setSeries).catch(() => setSeries([]))
  }, [period])

  const chartData = series.map((p) => ({
    label: p.label,
    value: metric === 'songs' ? p.songs : p.revenueFcfa,
  }))

  return (
    <div>
      <h1 className="text-[22px] md:text-[26px] mb-1">Tableau de bord</h1>
      <p className="text-[13px] md:text-[15px] text-ink-soft mb-6">Vue d'ensemble de la plateforme.</p>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <StatCard label="Utilisateurs" value={stats ? String(stats.users) : '…'} />
        <StatCard label="Chansons générées" value={stats ? String(stats.songs) : '…'} />
        <StatCard label="Téléchargements" value={stats ? String(stats.downloads) : '…'} />
        <StatCard label="Crédits vendus" value={stats ? String(stats.creditsSold) : '…'} />
        <StatCard
          label="Revenus"
          value={stats ? `${stats.revenueFcfa.toLocaleString('fr-FR')} F` : '…'}
        />
      </div>

      {/* Évolution par période */}
      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex gap-1.5">
            {(['songs', 'revenue'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1.5 rounded-lg text-[12px] md:text-[13px] font-medium ${
                  metric === m ? 'bg-ember-600 text-cream' : 'text-ink-soft hover:bg-ember-50'
                }`}
              >
                {m === 'songs' ? 'Chansons' : 'Revenus'}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
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
        {series.length === 0 ? (
          <p className="text-[13px] text-clay text-center py-10">Pas encore de données.</p>
        ) : (
          <BarChart
            data={chartData}
            format={metric === 'revenue' ? (n) => `${n.toLocaleString('fr-FR')} F` : undefined}
          />
        )}
      </div>

      {/* Analyse comportementale : le funnel de conversion du parcours. */}
      <Funnel />
    </div>
  )
}
