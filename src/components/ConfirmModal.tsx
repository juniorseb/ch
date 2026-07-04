import { useEffect } from 'react'

// Modal de confirmation réutilisable (fond assombri + carte centrée). Fermeture
// par Échap, clic sur le fond, ou bouton Annuler. Le bouton de confirmation
// peut afficher un état de chargement et être désactivé pendant l'action.
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  loading = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  error?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  // Échap pour fermer + on bloque le scroll de l'arrière-plan quand c'est ouvert.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Fond assombri (clic = annuler, sauf pendant l'action) */}
      <div
        className="absolute inset-0 bg-black/60 animate-fadein"
        onClick={() => !loading && onCancel()}
      />

      {/* Carte */}
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-surface-2 p-6 animate-fadein">
        <h2 className="text-[18px] md:text-[20px] font-semibold text-ink mb-1.5">{title}</h2>
        {message && <p className="text-[13px] md:text-[15px] text-ink-soft mb-4">{message}</p>}
        {error && <p className="text-[12px] md:text-[13px] text-ember-700 mb-4">{error}</p>}

        <div className="flex gap-2 mt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-11 rounded-lg border border-line text-[14px] font-semibold text-ink-soft disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-11 rounded-lg bg-ember-600 text-cream text-[14px] font-semibold disabled:opacity-60"
          >
            {loading ? 'Un instant…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
