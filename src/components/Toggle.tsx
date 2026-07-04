// Interrupteur on/off réutilisable (réglages admin).
export default function Toggle({
  on,
  onChange,
  disabled = false,
}: {
  on: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-pressed={on}
      className={`relative w-14 h-8 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
        on ? 'bg-ember-600' : 'bg-line'
      }`}
    >
      <span
        className={`absolute top-1 w-6 h-6 rounded-full bg-surface transition-all ${on ? 'left-7' : 'left-1'}`}
      />
    </button>
  )
}
