import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
  children: ReactNode
}

const variants = {
  primary: 'bg-ember-600 text-cream hover:bg-ember-700 active:scale-[0.98]',
  secondary: 'bg-surface text-ink border border-line hover:border-ember-400 active:scale-[0.98]',
  ghost: 'bg-transparent text-ink-soft hover:bg-ember-50',
}

export default function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`h-12 md:h-[52px] px-5 md:px-6 rounded-xl font-semibold text-[15px] md:text-[17px] transition-all disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {loading && (
          <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
        {children}
      </span>
    </button>
  )
}
