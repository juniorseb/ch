import { Link } from 'react-router-dom'
import Logo from './Logo'

interface AuthHeaderProps {
  // Si fourni (écran inséré dans le funnel), affiche une flèche retour vers
  // l'étape précédente — sans perdre le brouillon en cours.
  onBack?: () => void
  backLabel?: string
  // Lien d'action à droite (ex. bascule Connexion ↔ Inscription).
  action?: { label: string; to: string }
}

// En-tête des écrans d'auth : logo Mamélodie cliquable (→ landing) toujours
// présent, + flèche retour optionnelle quand on est dans le funnel, + lien
// d'action optionnel aligné à droite.
export default function AuthHeader({ onBack, backLabel, action }: AuthHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {onBack && (
        <button onClick={onBack} aria-label="Retour" className="text-clay text-[18px] leading-none -ml-1">
          ←
        </button>
      )}
      <Logo to="/" size="sm" />
      {onBack && backLabel && (
        <span className="text-[12px] md:text-[13px] text-clay">· {backLabel}</span>
      )}
      {action && (
        <Link
          to={action.to}
          className="ml-auto text-[13px] md:text-[15px] font-semibold text-ink border border-line rounded-full px-4 py-2 hover:border-ember-600/50 hover:text-ember-700 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
