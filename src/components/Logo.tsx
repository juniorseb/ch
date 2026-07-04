import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCurrentUser } from '../lib/api/auth'

interface LogoProps {
  // Destination du clic ; null = pas de lien (logo statique).
  to?: string | null
  // Affiche uniquement l'icône (sans le mot « Mamélodie »).
  iconOnly?: boolean
  size?: 'sm' | 'md'
}

// Logo Mamélodie = icône officielle (badge + onde orange) + wordmark rendu
// dans la police de l'app (plus fiable qu'un texte embarqué dans le SVG, et
// cohérent avec le reste de l'interface).
export default function Logo({ to = '/', iconOnly = false, size = 'md' }: LogoProps) {
  // `sm` = logo de l'app (tunnel, dashboard, connexion, admin) ; `md` = landing.
  // On agrandit légèrement le `sm` sans toucher à la landing.
  const iconH = size === 'sm' ? 'h-[26px]' : 'h-7'
  const textSize = size === 'sm' ? 'text-[17px]' : 'text-[18px] md:text-[20px]'

  // Logo « accueil » (/) : on va DIRECTEMENT au dashboard si l'utilisateur est
  // connecté (sinon la landing), pour éviter le passage-éclair par la landing.
  const [href, setHref] = useState<string | null>(to)
  useEffect(() => {
    let cancelled = false
    if (to === '/') {
      getCurrentUser().then((u) => {
        if (!cancelled) setHref(u ? '/app' : '/')
      })
    } else {
      setHref(to)
    }
    return () => {
      cancelled = true
    }
  }, [to])

  const content = (
    <span className="inline-flex items-center gap-2">
      {/* Icône décorative quand le wordmark texte est présent (évite un double
          « Mamélodie » si l'image ne charge pas). Alt utile seulement en iconOnly. */}
      <img src="/mamelodie-icone.svg" alt={iconOnly ? 'Mamélodie' : ''} className={`${iconH} w-auto`} />
      {!iconOnly && (
        <span className={`font-display font-bold ${textSize} text-ink tracking-tight`}>Mamélodie</span>
      )}
    </span>
  )

  if (!href) return content
  return (
    <Link to={href} aria-label="Mamélodie — accueil" className="inline-flex items-center">
      {content}
    </Link>
  )
}
