import { supabase, isSupabaseConfigured } from './supabase'

// Identifiant de visiteur anonyme (persistant), pour relier les étapes du
// parcours d'une même personne AVANT qu'elle n'ait un compte. Stocké en
// localStorage : survit aux rechargements et à la navigation.
const VID_KEY = 'mamelodie:vid'

export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VID_KEY)
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `v_${Date.now()}_${Math.round(Math.random() * 1e9)}`)
      localStorage.setItem(VID_KEY, id)
    }
    return id
  } catch {
    return 'anon'
  }
}

// Anti-doublon : on n'émet chaque étape qu'une fois par visiteur et par
// « session de parcours » (évite de recompter au simple retour arrière).
const sentThisSession = new Set<string>()

export type TrackEvent =
  | 'landing'
  | 'occasion'
  | 'details'
  | 'style'
  | 'improve'
  | 'lyrics'
  | 'account'
  | 'account_created'
  | 'payment'
  | 'generation_started'
  | 'song_completed'
  // Pages d'auth autonomes (hors tunnel) : arrivée vs complétion.
  | 'signup_view'
  | 'login_view'
  | 'login'

// Journalise un événement de parcours. Best-effort et non bloquant : on
// n'attend jamais la réponse, et toute erreur est silencieuse (le tracking ne
// doit jamais gêner l'utilisateur).
export function track(event: TrackEvent, meta?: Record<string, unknown>, opts?: { once?: boolean }): void {
  try {
    // Étapes de type "vue" : une seule fois par session. Les conversions
    // (generation_started, song_completed, account_created) passent à chaque fois.
    if (opts?.once) {
      if (sentThisSession.has(event)) return
      sentThisSession.add(event)
    }
    if (!isSupabaseConfigured) return
    const visitorId = getVisitorId()
    const path = typeof location !== 'undefined' ? location.pathname : undefined
    // Fire-and-forget : pas de await, on avale les erreurs.
    supabase.functions.invoke('track', { body: { visitorId, event, path, meta } }).catch(() => {})
  } catch {
    /* jamais bloquant */
  }
}
