import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { track, type TrackEvent } from '../lib/analytics'

// Associe une URL du parcours à une étape du funnel. Les pages hors parcours
// (espace connecté /app, admin…) ne sont pas suivies ici.
const PATH_TO_STEP: Record<string, TrackEvent> = {
  '/': 'landing',
  '/occasion': 'occasion',
  '/creer/details': 'details',
  '/creer/paroles-perso': 'details',
  '/creer/style': 'style',
  '/creer/ameliorer': 'improve',
  '/creer/paroles': 'lyrics',
  '/creer/compte': 'account',
  '/creer/paiement': 'payment',
  // Pages d'auth autonomes.
  '/inscription': 'signup_view',
  '/connexion': 'login_view',
}

// Émet automatiquement l'étape de funnel correspondant à l'URL courante
// (une fois par étape et par session de parcours). Monté sous le Router.
export default function RouteTracker() {
  const { pathname } = useLocation()
  useEffect(() => {
    const step = PATH_TO_STEP[pathname]
    if (step) track(step, undefined, { once: true })
  }, [pathname])
  return null
}
