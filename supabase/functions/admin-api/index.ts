// supabase/functions/admin-api/index.ts
// Endpoints du panel admin : stats, liste des utilisateurs, écriture des
// réglages. Vérifie que l'appelant est bien administrateur (profiles.is_admin)
// avant toute opération, puis utilise le service_role pour agréger les données.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

// Clés secrètes autorisées à l'écriture depuis l'admin (table app_secrets).
// Liste blanche stricte pour empêcher l'écriture de clés arbitraires.
const ALLOWED_SECRETS = new Set([
  // Paiement GeniusPay (sandbox + live)
  'geniuspay_pk_sandbox', 'geniuspay_sk_sandbox', 'geniuspay_whsec_sandbox',
  'geniuspay_pk_live', 'geniuspay_sk_live', 'geniuspay_whsec_live',
  // Fournisseurs IA & services
  'openrouter_api_key', 'groq_api_key', 'sunoapi_api_key', 'apipass_api_key', 'resend_api_key',
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Non authentifié' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return jsonResponse({ error: 'Session invalide' }, 401)

    // Contrôle admin.
    const { data: profile } = await userClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile?.is_admin) return jsonResponse({ error: 'Accès réservé aux administrateurs' }, 403)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { action, key, value, userId, amount, period, page, pageSize } = await req.json()

    // Bornes de pagination serveur (page 1-indexée). pageSize plafonné.
    function pageRange(): { from: number; to: number; size: number } {
      const size = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
      const p = Math.max(Number(page) || 1, 1)
      const from = (p - 1) * size
      return { from, to: from + size - 1, size }
    }

    if (action === 'stats') {
      const [{ count: users }, { count: songs }, { data: payments }, { data: dl }] = await Promise.all([
        admin.from('profiles').select('*', { count: 'exact', head: true }),
        admin.from('song_generations').select('*', { count: 'exact', head: true }).neq('status', 'failed'),
        admin.from('payments').select('amount_fcfa, credits_purchased').eq('status', 'success'),
        admin.from('song_generations').select('download_count'),
      ])
      const creditsSold = (payments ?? []).reduce((s, p) => s + (p.credits_purchased ?? 0), 0)
      const revenueFcfa = (payments ?? []).reduce((s, p) => s + (p.amount_fcfa ?? 0), 0)
      const downloads = (dl ?? []).reduce((s, r) => s + (r.download_count ?? 0), 0)
      return jsonResponse({ users: users ?? 0, songs: songs ?? 0, downloads, creditsSold, revenueFcfa })
    }

    if (action === 'songs') {
      const { from, to } = pageRange()
      const { data: rows, count } = await admin
        .from('song_generations')
        .select('id, title, style, status, download_count, created_at, user_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      // Auteur : email récupéré depuis profiles, borné aux utilisateurs de la page.
      const authorIds = [...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))] as string[]
      const emailById: Record<string, string> = {}
      if (authorIds.length > 0) {
        const { data: profs } = await admin.from('profiles').select('id, email').in('id', authorIds)
        for (const p of profs ?? []) emailById[p.id] = p.email ?? ''
      }

      return jsonResponse({
        rows: (rows ?? []).map((r) => ({
          id: r.id,
          title: r.title ?? 'Sans titre',
          style: r.style ?? 'Automatique',
          status: r.status,
          downloads: r.download_count ?? 0,
          createdAt: (r.created_at as string)?.slice(0, 10) ?? '',
          author: (r.user_id && emailById[r.user_id]) || '—',
        })),
        total: count ?? 0,
      })
    }

    if (action === 'set-suspended') {
      if (!userId) return jsonResponse({ error: 'userId manquant' }, 400)
      const suspended = !!value
      await admin.from('profiles').update({ suspended }).eq('id', userId)
      // Bannit / réactive aussi côté Auth (empêche toute nouvelle session).
      await admin.auth.admin.updateUserById(userId, {
        ban_duration: suspended ? '876000h' : 'none',
      })
      return jsonResponse({ ok: true })
    }

    if (action === 'users') {
      const { from, size } = pageRange()
      // Tri par dernière connexion (last_sign_in_at, dans auth.users) via RPC.
      const { data: recent } = await admin.rpc('admin_users_by_recent', {
        p_limit: size,
        p_offset: from,
      })
      const profiles = (recent ?? []) as {
        id: string; email: string | null; created_at: string
        last_sign_in_at: string | null; suspended: boolean; total_count: number
      }[]
      const count = profiles.length > 0 ? Number(profiles[0].total_count) : 0

      // Agrégation bornée aux SEULS utilisateurs de la page (scalable).
      const ids = profiles.map((p) => p.id)
      const bought: Record<string, number> = {}
      const used: Record<string, number> = {}
      const total: Record<string, number> = {}
      if (ids.length > 0) {
        const [{ data: pays }, { data: songs }] = await Promise.all([
          admin.from('payments').select('user_id, credits_purchased').eq('status', 'success').in('user_id', ids),
          admin.from('song_generations').select('user_id, status').in('user_id', ids),
        ])
        for (const p of pays ?? []) bought[p.user_id] = (bought[p.user_id] ?? 0) + (p.credits_purchased ?? 0)
        for (const s of songs ?? []) {
          total[s.user_id] = (total[s.user_id] ?? 0) + 1
          if (s.status !== 'failed' && s.status !== 'pending_payment') used[s.user_id] = (used[s.user_id] ?? 0) + 1
        }
      }

      const list = profiles.map((p) => ({
        id: p.id,
        email: p.email ?? '',
        createdAt: (p.created_at as string)?.slice(0, 10) ?? '',
        // Dernière connexion (null = jamais connecté depuis l'inscription).
        lastSignInAt: p.last_sign_in_at
          ? String(p.last_sign_in_at).slice(0, 16).replace('T', ' ')
          : null,
        credits: (bought[p.id] ?? 0) - (used[p.id] ?? 0),
        songs: total[p.id] ?? 0,
        suspended: !!p.suspended,
      }))
      return jsonResponse({ rows: list, total: count })
    }

    if (action === 'grant-credits') {
      const n = Math.floor(Number(amount))
      if (!userId || !n || n < 1) return jsonResponse({ error: 'userId ou montant invalide' }, 400)
      // Crédit offert : ligne de paiement 'success' à 0 F -> +N au solde.
      const { error } = await admin.from('payments').insert({
        user_id: userId,
        phone: 'admin',
        tier_id: 'admin_gift',
        credits_purchased: n,
        amount_fcfa: 0,
        status: 'success',
      })
      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ ok: true })
    }

    if (action === 'series') {
      const p: string = period ?? '7d'
      const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
      const pad = (x: number) => String(x).padStart(2, '0')
      const now = new Date()
      const buckets: { key: string; label: string; len: number }[] = []
      if (p === '12m') {
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          buckets.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: months[d.getMonth()], len: 7 })
        }
      } else {
        const n = p === '30d' ? 30 : 7
        for (let i = n - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
          buckets.push({
            key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
            label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
            len: 10,
          })
        }
      }
      const since = buckets[0].key.slice(0, 10)
      const [{ data: songs }, { data: pays }] = await Promise.all([
        admin.from('song_generations').select('created_at').neq('status', 'failed').gte('created_at', since),
        admin.from('payments').select('amount_fcfa, created_at').eq('status', 'success').gte('created_at', since),
      ])
      const series = buckets.map((b) => ({
        label: b.label,
        songs: (songs ?? []).filter((s) => String(s.created_at).slice(0, b.len) === b.key).length,
        revenueFcfa: (pays ?? [])
          .filter((x) => String(x.created_at).slice(0, b.len) === b.key)
          .reduce((sum, x) => sum + (x.amount_fcfa ?? 0), 0),
      }))
      return jsonResponse(series)
    }

    if (action === 'set-setting') {
      if (!key) return jsonResponse({ error: 'clé manquante' }, 400)
      await admin
        .from('app_settings')
        .upsert({ key, value: String(value), updated_at: new Date().toISOString() })
      return jsonResponse({ ok: true })
    }

    // Écriture d'un secret sensible (clé API prestataire) dans app_secrets.
    // Une valeur vide supprime le secret. On ne renvoie jamais la valeur.
    if (action === 'set-secret') {
      if (!key || !ALLOWED_SECRETS.has(key)) return jsonResponse({ error: 'clé secrète invalide' }, 400)
      const v = String(value ?? '').trim()
      if (!v) {
        await admin.from('app_secrets').delete().eq('key', key)
        return jsonResponse({ ok: true, cleared: true })
      }
      await admin
        .from('app_secrets')
        .upsert({ key, value: v, updated_at: new Date().toISOString() })
      return jsonResponse({ ok: true })
    }

    if (action === 'feedback') {
      const { from, to } = pageRange()
      const { data: rows, count } = await admin
        .from('feedback')
        .select('id, email, rating, message, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      return jsonResponse({
        rows: (rows ?? []).map((r) => ({
          id: r.id,
          email: r.email ?? '—',
          rating: (r.rating as number | null) ?? null,
          message: r.message ?? '',
          createdAt: (r.created_at as string)?.slice(0, 16).replace('T', ' ') ?? '',
        })),
        total: count ?? 0,
      })
    }

    // Funnel comportemental : agrégation faite EN BASE (count distinct) via des
    // fonctions SQL -> rapide même avec beaucoup d'événements. `period` :
    // '7d' | '30d' | '12m' | 'all'.
    function sinceFor(p: string): string {
      if (p === 'all') return '1970-01-01T00:00:00.000Z'
      const days = p === '7d' ? 7 : p === '12m' ? 365 : 30
      const d = new Date()
      d.setDate(d.getDate() - days)
      return d.toISOString()
    }

    if (action === 'funnel') {
      const since = sinceFor(period ?? '30d')
      const [{ data: rows }, { data: uniq }] = await Promise.all([
        admin.rpc('analytics_funnel', { since }),
        admin.rpc('analytics_unique_visitors', { since }),
      ])
      const events: Record<string, { visitors: number; total: number }> = {}
      for (const r of (rows ?? []) as { event: string; visitors: number; total: number }[]) {
        events[r.event] = { visitors: Number(r.visitors) || 0, total: Number(r.total) || 0 }
      }
      return jsonResponse({ uniqueVisitors: Number(uniq) || 0, events })
    }

    // Suivi technique : nombre d'appels par API externe + erreurs sur la période.
    if (action === 'api-metrics') {
      const since = sinceFor(period ?? '30d')
      const { data } = await admin.rpc('api_metrics', { since })
      const rows = ((data ?? []) as { api: string; total: number; errors: number }[]).map((r) => ({
        api: r.api,
        total: Number(r.total) || 0,
        errors: Number(r.errors) || 0,
      }))
      return jsonResponse({ rows })
    }

    // Export brut des événements de la période (pour analyse externe / CSV).
    // Plafonné pour éviter une réponse démesurée ; `truncated` signale la coupe.
    if (action === 'analytics-export') {
      const since = sinceFor(period ?? '30d')
      const CAP = 50000
      const { data: rows } = await admin
        .from('analytics_events')
        .select('created_at, event, visitor_id, user_id, path')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(CAP + 1)
      const all = rows ?? []
      const truncated = all.length > CAP
      return jsonResponse({ rows: truncated ? all.slice(0, CAP) : all, truncated })
    }

    // État des secrets (configuré ou non) SANS jamais exposer les valeurs.
    if (action === 'secrets-status') {
      const { data } = await admin.from('app_secrets').select('key')
      const set = new Set((data ?? []).map((r) => r.key as string))
      return jsonResponse(Object.fromEntries([...ALLOWED_SECRETS].map((k) => [k, set.has(k)])))
    }

    return jsonResponse({ error: 'Action inconnue' }, 400)
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
