// Bouton retour réutilisable et bien visible : flèche dans un cercle bordé +
// libellé. Remplace les anciens "← Retour" en gris peu lisibles.
export default function BackButton({
  onClick,
  label = 'Retour',
  className = '',
}: {
  onClick: () => void
  label?: string
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`inline-flex items-center gap-2 text-ink-soft hover:text-ink transition-colors ${className}`}
    >
      <span className="w-8 h-8 rounded-full border border-line bg-surface flex items-center justify-center shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-[14px] md:text-[16px] font-medium">{label}</span>
    </button>
  )
}
