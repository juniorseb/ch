import { supabase, isSupabaseConfigured } from '../supabase'
import { isOtpEnabled, setOtpEnabledDemo, getCreditTiers, isGeniuspaySandbox } from '../settings'
import type { CreditTier } from '../types'
import { readDemoSongs } from '../songsStore'
import { readDemoDownloads } from '../downloads'
import { addCreditsDemo } from './credits'
import { MOCK_SONGS } from '../mockData'
import { styleLabel } from '../types'

// Le statut admin a UNE SEULE source de vérité : profiles.is_admin (le même
// contrôle que l'Edge Function admin-api côté serveur). Pas d'email en dur
// côté client -> l'UI reflète exactement l'autorisation réelle.
// Cache l'état admin pour afficher le lien instantanément au retour (sans
// clignotement). Purement cosmétique : l'accès réel reste gardé côté serveur
// (admin-api vérifie is_admin à chaque appel).
const IS_ADMIN_KEY = 'mamelodie:isAdmin'

export function getCachedIsAdmin(): boolean | null {
  try {
    const v = localStorage.getItem(IS_ADMIN_KEY)
    return v == null ? null : v === '1'
  } catch {
    return null
  }
}

export async function isAdmin(): Promise<boolean> {
  // Démo (local, sans backend) : accès ouvert pour explorer le panel.
  if (!isSupabaseConfigured) return true
  const { data } = await supabase.from('profiles').select('is_admin').maybeSingle()
  const result = !!data?.is_admin
  try { localStorage.setItem(IS_ADMIN_KEY, result ? '1' : '0') } catch { /* ignore */ }
  return result
}

export interface AdminStats {
  users: number
  songs: number
  downloads: number
  creditsSold: number
  revenueFcfa: number
}

export interface AdminUser {
  id: string
  email: string
  createdAt: string
  // Dernière connexion (chaîne « AAAA-MM-JJ HH:MM ») ou null si jamais connecté.
  lastSignInAt: string | null
  credits: number
  songs: number
  suspended: boolean
}

export interface AdminSong {
  id: string
  title: string
  style: string
  status: string
  downloads: number
  createdAt: string
  // Email de l'auteur (utilisateur qui a créé la chanson), « — » si inconnu.
  author: string
}

function readDemoPayments(): { amountFcfa: number; creditsPurchased: number; createdAt?: string }[] {
  try {
    return JSON.parse(sessionStorage.getItem('mamelodie:payments') ?? '[]')
  } catch {
    return []
  }
}

export type PeriodKey = '7d' | '30d' | '12m'
export interface SeriesPoint {
  label: string
  songs: number
  revenueFcfa: number
}

const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const pad = (n: number) => String(n).padStart(2, '0')

// Construit les tranches temporelles (jours ou mois) de la période demandée.
function buildBuckets(period: PeriodKey): { key: string; label: string; len: number }[] {
  const now = new Date()
  if (period === '12m') {
    const out = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      out.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: MONTHS_FR[d.getMonth()], len: 7 })
    }
    return out
  }
  const n = period === '7d' ? 7 : 30
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    out.push({
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
      len: 10,
    })
  }
  return out
}

export async function getSeries(period: PeriodKey): Promise<SeriesPoint[]> {
  if (!isSupabaseConfigured) {
    const buckets = buildBuckets(period)
    const songs = [...readDemoSongs(), ...MOCK_SONGS]
    const pays = readDemoPayments()
    return buckets.map((b) => ({
      label: b.label,
      songs: songs.filter((s) => (s.createdAt ?? '').slice(0, b.len) === b.key).length,
      revenueFcfa: pays
        .filter((p) => (p.createdAt ?? '').slice(0, b.len) === b.key)
        .reduce((sum, p) => sum + (p.amountFcfa ?? 0), 0),
    }))
  }
  const { data, error } = await supabase.functions.invoke('admin-api', { body: { action: 'series', period } })
  if (error) throw error
  return (data as SeriesPoint[]) ?? []
}

// Offre des crédits à un utilisateur (sans paiement). En réel, une ligne de
// paiement 'success' à 0 F crédite son solde via la vue user_credits.
export async function grantCredits(userId: string, amount: number): Promise<void> {
  if (amount < 1) return
  if (!isSupabaseConfigured) {
    addCreditsDemo(Math.floor(amount))
    return
  }
  const { error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'grant-credits', userId, amount: Math.floor(amount) },
  })
  if (error) throw error
}

// ---- Funnel comportemental (analyse du parcours) --------------------------
export type FunnelPeriod = '7d' | '30d' | '12m' | 'all'

export interface FunnelResult {
  uniqueVisitors: number
  // event -> { visitors distincts, total d'événements }
  events: Record<string, { visitors: number; total: number }>
}

// Données de démonstration (sans backend) : un funnel plausible en entonnoir.
function demoFunnel(): FunnelResult {
  const events: FunnelResult['events'] = {
    landing: { visitors: 100, total: 240 },
    occasion: { visitors: 62, total: 88 },
    details: { visitors: 48, total: 70 },
    style: { visitors: 40, total: 55 },
    lyrics: { visitors: 33, total: 61 },
    account: { visitors: 21, total: 27 },
    account_created: { visitors: 15, total: 15 },
    payment: { visitors: 12, total: 14 },
    generation_started: { visitors: 14, total: 18 },
    song_completed: { visitors: 13, total: 16 },
  }
  return { uniqueVisitors: 100, events }
}

export async function getFunnel(period: FunnelPeriod): Promise<FunnelResult> {
  if (!isSupabaseConfigured) return demoFunnel()
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'funnel', period },
  })
  if (error) throw error
  return data as FunnelResult
}

interface AnalyticsRow {
  created_at: string
  event: string
  visitor_id: string
  user_id: string | null
  path: string | null
}

// Échappement CSV : guillemets doublés, champ entre guillemets si nécessaire.
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Exporte les événements bruts de la période en CSV et déclenche le
// téléchargement. Renvoie le nombre de lignes exportées (et si c'était tronqué).
export async function exportAnalyticsCsv(period: FunnelPeriod): Promise<{ count: number; truncated: boolean }> {
  let rows: AnalyticsRow[] = []
  let truncated = false

  if (!isSupabaseConfigured) {
    // Démo : un petit échantillon illustratif.
    rows = [
      { created_at: '2026-07-03T10:00:00Z', event: 'landing', visitor_id: 'demo-1', user_id: null, path: '/' },
      { created_at: '2026-07-03T10:01:00Z', event: 'occasion', visitor_id: 'demo-1', user_id: null, path: '/occasion' },
    ]
  } else {
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action: 'analytics-export', period },
    })
    if (error) throw error
    rows = (data?.rows as AnalyticsRow[]) ?? []
    truncated = !!data?.truncated
  }

  const header = ['created_at', 'event', 'visitor_id', 'user_id', 'path']
  const lines = [
    header.join(','),
    ...rows.map((r) => [r.created_at, r.event, r.visitor_id, r.user_id, r.path].map(csvCell).join(',')),
  ]
  // BOM UTF-8 pour qu'Excel affiche correctement les accents.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mamelodie-analytics-${period}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)

  return { count: rows.length, truncated }
}

// ---- Suivi technique (appels API externes) --------------------------------
export interface ApiMetric {
  api: string
  total: number
  errors: number
}

export async function getApiMetrics(period: FunnelPeriod): Promise<ApiMetric[]> {
  if (!isSupabaseConfigured) {
    return [
      { api: 'openrouter', total: 128, errors: 3 },
      { api: 'apipass', total: 342, errors: 12 },
      { api: 'resend', total: 54, errors: 1 },
      { api: 'geniuspay', total: 47, errors: 2 },
      { api: 'groq', total: 9, errors: 0 },
    ]
  }
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'api-metrics', period },
  })
  if (error) throw error
  return (data?.rows as ApiMetric[]) ?? []
}

export async function getStats(): Promise<AdminStats> {
  if (!isSupabaseConfigured) {
    const payments = readDemoPayments()
    return {
      users: 1,
      songs: readDemoSongs().length + MOCK_SONGS.length,
      downloads: readDemoDownloads(),
      creditsSold: payments.reduce((s, p) => s + (p.creditsPurchased ?? 0), 0),
      revenueFcfa: payments.reduce((s, p) => s + (p.amountFcfa ?? 0), 0),
    }
  }
  const { data, error } = await supabase.functions.invoke('admin-api', { body: { action: 'stats' } })
  if (error) throw error
  return data as AdminStats
}

// Résultat paginé (pagination serveur) : tranche courante + total global.
export interface Paged<T> {
  rows: T[]
  total: number
}

function demoPage<T>(all: T[], page: number, pageSize: number): Paged<T> {
  const from = (page - 1) * pageSize
  return { rows: all.slice(from, from + pageSize), total: all.length }
}

export async function listUsers(page = 1, pageSize = 20): Promise<Paged<AdminUser>> {
  if (!isSupabaseConfigured) {
    return demoPage(
      [
        {
          id: 'demo-user',
          email: 'compte de démonstration',
          createdAt: '2026-06-30',
          lastSignInAt: '2026-07-04 09:30',
          credits: 0,
          songs: readDemoSongs().length + MOCK_SONGS.length,
          suspended: false,
        },
      ],
      page,
      pageSize
    )
  }
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'users', page, pageSize },
  })
  if (error) throw error
  return data as Paged<AdminUser>
}

export async function listSongs(page = 1, pageSize = 20): Promise<Paged<AdminSong>> {
  if (!isSupabaseConfigured) {
    const all = [...readDemoSongs(), ...MOCK_SONGS].map((s) => ({
      id: s.id,
      title: s.title,
      style: styleLabel(s.style),
      status: s.status,
      downloads: 0,
      createdAt: s.createdAt,
      author: 'compte de démonstration',
    }))
    return demoPage(all, page, pageSize)
  }
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'songs', page, pageSize },
  })
  if (error) throw error
  return data as Paged<AdminSong>
}

export interface FeedbackItem {
  id: string
  email: string
  rating: number | null
  message: string
  createdAt: string
}

export async function listFeedback(page = 1, pageSize = 20): Promise<Paged<FeedbackItem>> {
  if (!isSupabaseConfigured) {
    let all: FeedbackItem[] = []
    try {
      all = JSON.parse(localStorage.getItem('mamelodie:feedback') ?? '[]') as FeedbackItem[]
    } catch {
      all = []
    }
    return demoPage(all, page, pageSize)
  }
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'feedback', page, pageSize },
  })
  if (error) throw error
  return data as Paged<FeedbackItem>
}

export async function setUserSuspended(userId: string, suspended: boolean): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'set-suspended', userId, value: suspended },
  })
  if (error) throw error
}

export async function setOtpEnabled(value: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    setOtpEnabledDemo(value)
    return
  }
  const { error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'set-setting', key: 'otp_enabled', value: String(value) },
  })
  if (error) throw error
}

// Réglages des fournisseurs (IA paroles + musique), pilotés depuis l'admin.
// Paroles : OpenAI (gpt-4o-mini) principal, Groq (llama-3.3) secours.
// Musique : SunoAPI.org principal, ApiPass secours (ordre réglable).
export type MusicProvider = 'sunoapi' | 'apipass'

export interface ProviderSettings {
  lyricsOpenaiEnabled: boolean
  lyricsGroqEnabled: boolean
  musicSunoapiEnabled: boolean
  musicApipassEnabled: boolean
  musicPrimary: MusicProvider
}

// Uniquement les bascules booléennes (musicPrimary est géré à part).
export type ProviderToggle = 'lyricsOpenaiEnabled' | 'lyricsGroqEnabled' | 'musicSunoapiEnabled' | 'musicApipassEnabled'

const PROVIDER_KEYS: Record<ProviderToggle, string> = {
  lyricsOpenaiEnabled: 'lyrics_openai_enabled',
  lyricsGroqEnabled: 'lyrics_groq_enabled',
  musicSunoapiEnabled: 'music_sunoapi_enabled',
  musicApipassEnabled: 'music_apipass_enabled',
}

export async function getProviderSettings(): Promise<ProviderSettings> {
  const primaryOf = (v: string | undefined): MusicProvider => (v === 'apipass' ? 'apipass' : 'sunoapi')
  if (!isSupabaseConfigured) {
    const bDemo = (k: string, d: boolean) =>
      (localStorage.getItem(`mamelodie:setting:${k}`) ?? String(d)) === 'true'
    return {
      lyricsOpenaiEnabled: bDemo('lyrics_openai_enabled', true),
      lyricsGroqEnabled: bDemo('lyrics_groq_enabled', true),
      musicSunoapiEnabled: bDemo('music_sunoapi_enabled', true),
      musicApipassEnabled: bDemo('music_apipass_enabled', true),
      musicPrimary: primaryOf(localStorage.getItem('mamelodie:setting:music_primary') ?? 'sunoapi'),
    }
  }
  const { data } = await supabase.from('app_settings').select('key, value')
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]))
  const b = (k: string, d: boolean) => (map.get(k) ?? String(d)) === 'true'
  return {
    lyricsOpenaiEnabled: b('lyrics_openai_enabled', true),
    lyricsGroqEnabled: b('lyrics_groq_enabled', true),
    musicSunoapiEnabled: b('music_sunoapi_enabled', true),
    musicApipassEnabled: b('music_apipass_enabled', true),
    musicPrimary: primaryOf(map.get('music_primary')),
  }
}

export async function setProviderSetting(field: ProviderToggle, value: boolean): Promise<void> {
  const key = PROVIDER_KEYS[field]
  if (!isSupabaseConfigured) {
    localStorage.setItem(`mamelodie:setting:${key}`, String(value))
    return
  }
  const { error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'set-setting', key, value: String(value) },
  })
  if (error) throw error
}

// Choix du fournisseur musical principal (l'autre devient le secours).
export async function setMusicPrimary(provider: MusicProvider): Promise<void> {
  if (!isSupabaseConfigured) {
    localStorage.setItem('mamelodie:setting:music_primary', provider)
    return
  }
  const { error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'set-setting', key: 'music_primary', value: provider },
  })
  if (error) throw error
}

// Grille de crédits éditable depuis l'admin.
export async function setCreditTiers(tiers: CreditTier[]): Promise<void> {
  const value = JSON.stringify(tiers)
  if (!isSupabaseConfigured) {
    localStorage.setItem('mamelodie:setting:credit_tiers', value)
    return
  }
  const { error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'set-setting', key: 'credit_tiers', value },
  })
  if (error) throw error
}

// Secrets prestataires (clés GeniusPay sandbox/live) : stockés dans une table
// sécurisée (app_secrets), jamais lisibles côté client. On ne récupère que
// l'ÉTAT (configuré ou non), jamais la valeur.
export interface SecretsStatus {
  geniuspay_pk_sandbox: boolean
  geniuspay_sk_sandbox: boolean
  geniuspay_whsec_sandbox: boolean
  geniuspay_pk_live: boolean
  geniuspay_sk_live: boolean
  geniuspay_whsec_live: boolean
  openrouter_api_key: boolean
  groq_api_key: boolean
  sunoapi_api_key: boolean
  apipass_api_key: boolean
  resend_api_key: boolean
}

const EMPTY_SECRETS: SecretsStatus = {
  geniuspay_pk_sandbox: false,
  geniuspay_sk_sandbox: false,
  geniuspay_whsec_sandbox: false,
  geniuspay_pk_live: false,
  geniuspay_sk_live: false,
  geniuspay_whsec_live: false,
  openrouter_api_key: false,
  groq_api_key: false,
  sunoapi_api_key: false,
  apipass_api_key: false,
  resend_api_key: false,
}

export async function getSecretsStatus(): Promise<SecretsStatus> {
  if (!isSupabaseConfigured) return EMPTY_SECRETS
  const { data, error } = await supabase.functions.invoke('admin-api', { body: { action: 'secrets-status' } })
  if (error) throw error
  return { ...EMPTY_SECRETS, ...(data as Partial<SecretsStatus>) }
}

// Enregistre (ou efface si vide) un secret. La valeur ne fait qu'aller vers le
// serveur, jamais l'inverse.
export async function setSecret(key: keyof SecretsStatus, value: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'set-secret', key, value },
  })
  if (error) throw error
}

// Mode GeniusPay (sandbox de test / production) piloté depuis l'admin.
export async function setGeniuspaySandbox(value: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    localStorage.setItem('mamelodie:setting:geniuspay_sandbox', String(value))
    return
  }
  const { error } = await supabase.functions.invoke('admin-api', {
    body: { action: 'set-setting', key: 'geniuspay_sandbox', value: String(value) },
  })
  if (error) throw error
}

// Réexport pratique pour l'écran admin.
export { isOtpEnabled, getCreditTiers, isGeniuspaySandbox }
