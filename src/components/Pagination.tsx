// Barre de pagination (précédent / page X sur Y / suivant). Ne s'affiche pas
// s'il n'y a qu'une seule page. `total` (optionnel) précise le nombre d'éléments.
export default function Pagination({
  page,
  pageCount,
  onChange,
  total,
  className = '',
}: {
  page: number
  pageCount: number
  onChange: (p: number) => void
  total?: number
  className?: string
}) {
  if (pageCount <= 1) return null
  return (
    <div className={`flex items-center justify-center gap-2 mt-4 ${className}`}>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-line text-[13px] font-medium text-ink-soft disabled:opacity-40 hover:border-ember-400 transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Précédent
      </button>
      <span className="text-[12px] md:text-[13px] text-clay tabular-nums px-1">
        Page {page} / {pageCount}
        {typeof total === 'number' ? ` · ${total.toLocaleString('fr-FR')}` : ''}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-line text-[13px] font-medium text-ink-soft disabled:opacity-40 hover:border-ember-400 transition-colors"
      >
        Suivant
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
