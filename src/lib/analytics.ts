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

// ---- Source de trafic (attribution « premier contact ») -------------------
// Détermine d'où vient le visiteur (Facebook via ?fbclid, Google, WhatsApp,
// referral…). Calculée à la PREMIÈRE arrivée (quand l'URL porte encore les
// paramètres) puis figée en localStorage : l'attribution « first-touch »
// survit à la navigation qui efface le ?fbclid.
const SRC_KEY = 'mamelodie:src'

export interface TrafficSource {
  source: string
  medium?: string
  campaign?: string
}

// Domaines connus -> nom de source lisible.
function classifyReferrer(host: string): string | null {
  const h = host.toLowerCase().replace(/^www\./, '')
  if (h.includes('facebook') || h === 'fb.com' || h.includes('fb.me') || h.includes('fb.watch')) return 'facebook'
  if (h.includes('instagram')) return 'instagram'
  if (h.includes('whatsapp') || h === 'wa.me' || h.includes('whatsapp.com')) return 'whatsapp'
  if (h.includes('tiktok')) return 'tiktok'
  if (h === 't.co' || h.includes('twitter') || h === 'x.com') return 'twitter'
  if (h.includes('youtube') || h === 'youtu.be') return 'youtube'
  if (h.includes('google')) return 'google'
  if (h.includes('bing')) return 'bing'
  if (h.includes('linkedin') || h.includes('lnkd.in')) return 'linkedin'
  if (h.includes('snapchat')) return 'snapchat'
  if (h.includes('telegram') || h === 't.me') return 'telegram'
  if (h.includes('messenger') || h === 'm.me') return 'messenger'
  return null
}

function computeTrafficSource(): TrafficSource {
  try {
    const params = new URLSearchParams(location.search)
    const clip = (s: string | null, n: number) => (s ? s.toLowerCase().slice(0, n) : undefined)
    const utmSource = clip(params.get('utm_source'), 40)
    const medium = clip(params.get('utm_medium'), 40)
    const campaign = clip(params.get('utm_campaign'), 60)

    // 1) UTM explicites (les plus fiables) — priorité absolue.
    if (utmSource) return { source: utmSource, medium, campaign }
    // 2) Identifiants de clic des régies (marque une visite payante/sociale).
    if (params.has('fbclid')) return { source: 'facebook', medium: medium ?? 'paid', campaign }
    if (params.has('gclid') || params.has('gad_source')) return { source: 'google', medium: medium ?? 'paid', campaign }
    if (params.has('ttclid')) return { source: 'tiktok', medium: medium ?? 'paid', campaign }
    if (params.has('igshid')) return { source: 'instagram', medium: medium ?? 'social', campaign }
    // 3) Site référent (domaine d'où vient le clic), hors navigation interne.
    if (document.referrer) {
      const url = new URL(document.referrer)
      if (url.hostname && url.hostname !== location.hostname) {
        const known = classifyReferrer(url.hostname)
        return { source: known ?? url.hostname.replace(/^www\./, '').slice(0, 40), medium: 'referral' }
      }
    }
  } catch {
    /* URL/referrer illisible -> direct */
  }
  // 4) Rien de tout ça -> accès direct (saisie de l'URL, favori, appli…).
  return { source: 'direct' }
}

export function getTrafficSource(): TrafficSource {
  try {
    const cached = localStorage.getItem(SRC_KEY)
    if (cached) return JSON.parse(cached) as TrafficSource
    const src = computeTrafficSource()
    localStorage.setItem(SRC_KEY, JSON.stringify(src))
    return src
  } catch {
    return { source: 'direct' }
  }
}

// Points d'entrée du site : on y attache la source de trafic (une seule par
// session grâce à { once }). Suffit à reconstituer d'où viennent les visiteurs.
const ENTRY_EVENTS = new Set<TrackEvent>(['landing', 'signup_view', 'login_view'])

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
    // Sur les points d'entrée, on joint la source de trafic (fb, google…).
    const payloadMeta = ENTRY_EVENTS.has(event)
      ? { ...(meta ?? {}), ...getTrafficSource() }
      : meta
    // Fire-and-forget : pas de await, on avale les erreurs.
    supabase.functions.invoke('track', { body: { visitorId, event, path, meta: payloadMeta } }).catch(() => {})
  } catch {
    /* jamais bloquant */
  }
}
