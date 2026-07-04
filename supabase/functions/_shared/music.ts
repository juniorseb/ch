// Couche musique multi-fournisseurs : SunoAPI.org (principal) + ApiPass (secours),
// activables/ordonnables depuis l'admin (app_settings). Chaque fournisseur wrappe
// Suno mais avec des formats différents ; on unifie tout ici.
//
// Réglages : music_sunoapi_enabled, music_apipass_enabled, music_primary,
//            music_sunoapi_model (défaut V4_5).
// Secrets  : sunoapi_api_key, apipass_api_key.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { loadSettings, settingBool, settingStr } from './settings.ts'
import { recordApiCall } from './metrics.ts'

export type MusicProvider = 'sunoapi' | 'apipass'

export type TaskState =
  | { state: 'success'; urls: [string | undefined, string | undefined] }
  | { state: 'fail'; message: string }
  // En cours : `previewUrl` = flux d'écoute anticipée (SunoAPI streamAudioUrl),
  // dispo bien avant le MP3 final. Absent pour ApiPass.
  | { state: 'pending'; previewUrl?: string }

// Contraintes Suno : style <= 200, prompt (paroles) <= 3000.
const MAX_STYLE = 200
const MAX_PROMPT = 3000

// -------------------------------------------------------------------------
// Réglages & sélection du fournisseur
// -------------------------------------------------------------------------
export interface MusicSettings {
  sunoapiEnabled: boolean
  apipassEnabled: boolean
  primary: MusicProvider
  sunoapiModel: string
}

export async function loadMusicSettings(): Promise<MusicSettings> {
  const s = await loadSettings()
  return {
    sunoapiEnabled: settingBool(s, 'music_sunoapi_enabled', true),
    apipassEnabled: settingBool(s, 'music_apipass_enabled', true),
    primary: settingStr(s, 'music_primary', 'sunoapi') === 'apipass' ? 'apipass' : 'sunoapi',
    sunoapiModel: settingStr(s, 'music_sunoapi_model', 'V5_5'),
  }
}

// Ordre d'essai (principal puis secours), en ne gardant que les fournisseurs activés.
export function providerOrder(s: MusicSettings): MusicProvider[] {
  const order: MusicProvider[] = s.primary === 'apipass' ? ['apipass', 'sunoapi'] : ['sunoapi', 'apipass']
  return order.filter((p) => (p === 'sunoapi' ? s.sunoapiEnabled : s.apipassEnabled))
}

// Nom du secret (app_secrets) + variable d'env de repli, par fournisseur.
export function secretKeyFor(p: MusicProvider): { key: string; env: string } {
  return p === 'sunoapi'
    ? { key: 'sunoapi_api_key', env: 'SUNOAPI_API_KEY' }
    : { key: 'apipass_api_key', env: 'APIPASS_API_KEY' }
}

// -------------------------------------------------------------------------
// SunoAPI.org  (POST /api/v1/generate ; GET /api/v1/generate/record-info)
// body plat ; data.status ; audios dans data.response.sunoData[].audioUrl
// -------------------------------------------------------------------------
const SUNOAPI_BASE = 'https://api.sunoapi.org/api/v1'
const SUNOAPI_FAIL = new Set([
  'CREATE_TASK_FAILED', 'GENERATE_AUDIO_FAILED', 'CALLBACK_EXCEPTION', 'SENSITIVE_WORD_ERROR',
])

async function createSunoapi(
  lyrics: string, style: string, title: string, apiKey: string, model: string, callBackUrl?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    customMode: true,
    instrumental: false,
    model,
    prompt: lyrics.slice(0, MAX_PROMPT),
    style: style.slice(0, MAX_STYLE),
    title: title.slice(0, MAX_STYLE),
  }
  if (callBackUrl) body.callBackUrl = callBackUrl
  const res = await fetch(`${SUNOAPI_BASE}/generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await recordApiCall('sunoapi', res.ok, res.status)
  const data = await res.json().catch(() => ({} as Record<string, unknown>))
  if (!res.ok || (data as { code?: number }).code !== 200) {
    throw new Error(`SunoAPI generate ${res.status}: ${JSON.stringify(data).slice(0, 300)}`)
  }
  const taskId = (data as { data?: { taskId?: string } }).data?.taskId
  if (!taskId) throw new Error('SunoAPI : taskId manquant dans la réponse')
  return taskId
}

// Interprète le corps de record-info (ou d'un callback) SunoAPI.
export function readSunoapiState(dataField: Record<string, unknown>): TaskState {
  const status = dataField?.status as string | undefined
  if (status && SUNOAPI_FAIL.has(status)) {
    const msg = (dataField?.errorMessage as string) || status
    return { state: 'fail', message: msg }
  }
  const arr = ((dataField?.response as Record<string, unknown>)?.sunoData ?? []) as Array<Record<string, unknown>>
  if (status === 'SUCCESS') {
    return { state: 'success', urls: [arr[0]?.audioUrl as string, arr[1]?.audioUrl as string] }
  }
  // Intermédiaire (PENDING / TEXT_SUCCESS / FIRST_SUCCESS) : le flux d'aperçu
  // apparaît dès que la 1re piste commence (avant le MP3 final).
  return { state: 'pending', previewUrl: arr[0]?.streamAudioUrl as string | undefined }
}

async function pollSunoapi(taskId: string, apiKey: string): Promise<TaskState> {
  const res = await fetch(`${SUNOAPI_BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) return { state: 'pending' }
  const body = await res.json().catch(() => ({} as Record<string, unknown>))
  return readSunoapiState(((body as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>)
}

// -------------------------------------------------------------------------
// ApiPass  (POST /jobs/createTask ; GET /jobs/recordInfo)
// body dans input ; data.state ; audios dans data.resultJson.data[].audio_url
// -------------------------------------------------------------------------
const APIPASS_BASE = 'https://api.apipass.dev/api/v1/jobs'

async function createApipass(
  lyrics: string, style: string, title: string, apiKey: string, callBackUrl?: string
): Promise<string> {
  const body: Record<string, unknown> = {
    model: 'suno/generate',
    input: {
      prompt: lyrics.slice(0, MAX_PROMPT),
      title: title.slice(0, MAX_STYLE),
      style: style.slice(0, MAX_STYLE),
      customMode: true,
      instrumental: false,
    },
  }
  if (callBackUrl) body.callBackUrl = callBackUrl
  const res = await fetch(`${APIPASS_BASE}/createTask`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await recordApiCall('apipass', res.ok, res.status)
  if (!res.ok) throw new Error(`ApiPass createTask ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const taskId = data.taskId ?? data.data?.taskId ?? data.data?.task_id
  if (!taskId) throw new Error('ApiPass : taskId manquant dans la réponse')
  return taskId as string
}

function extractApipassUrls(resultData: unknown): [string | undefined, string | undefined] {
  const arr = Array.isArray(resultData) ? resultData : []
  const url = (x: unknown) => {
    const o = (x ?? {}) as Record<string, unknown>
    return (o.audio_url ?? o.audioUrl ?? o.url) as string | undefined
  }
  return [url(arr[0]), url(arr[1])]
}

// Interprète le corps de recordInfo (ou d'un callback) ApiPass.
export function readApipassState(body: Record<string, unknown>): TaskState {
  const d = (body.data ?? body) as Record<string, unknown>
  const state = (d.state ?? d.status) as string | undefined
  if (state === 'fail' || state === 'failed') {
    return { state: 'fail', message: String(d.failMsg ?? d.failCode ?? 'échec de génération') }
  }
  if (state === 'success' || state === 'completed') {
    const resultData =
      (d.resultJson as Record<string, unknown> | undefined)?.data ??
      (d.data as unknown) ??
      (body.resultJson as Record<string, unknown> | undefined)?.data
    return { state: 'success', urls: extractApipassUrls(resultData) }
  }
  return { state: 'pending' }
}

async function pollApipass(taskId: string, apiKey: string): Promise<TaskState> {
  const res = await fetch(`${APIPASS_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) return { state: 'pending' }
  return readApipassState(await res.json())
}

// -------------------------------------------------------------------------
// Dispatcher générique
// -------------------------------------------------------------------------
export async function createMusicTask(
  provider: MusicProvider,
  args: { lyrics: string; style: string; title: string; apiKey: string; model: string; callBackUrl?: string }
): Promise<string> {
  return provider === 'sunoapi'
    ? createSunoapi(args.lyrics, args.style, args.title, args.apiKey, args.model, args.callBackUrl)
    : createApipass(args.lyrics, args.style, args.title, args.apiKey, args.callBackUrl)
}

export async function pollMusicTask(provider: MusicProvider, taskId: string, apiKey: string): Promise<TaskState> {
  return provider === 'sunoapi' ? pollSunoapi(taskId, apiKey) : pollApipass(taskId, apiKey)
}

// -------------------------------------------------------------------------
// Finalisation (identique quel que soit le fournisseur) : ré-hébergement de
// l'audio sur NOTRE stockage (masque le prestataire, liens persistants) + MAJ
// base + broadcast Realtime.
// -------------------------------------------------------------------------
async function rehostAudio(supabase: SupabaseClient, songId: string, url: string, idx: number): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const bytes = new Uint8Array(await res.arrayBuffer())
    const path = `${songId}_${idx}.mp3`
    const { error } = await supabase.storage
      .from('songs')
      .upload(path, bytes, { contentType: 'audio/mpeg', upsert: true })
    if (error) return url
    const base = (Deno.env.get('PUBLIC_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')
    return `${base}/storage/v1/object/public/songs/${path}`
  } catch {
    return url
  }
}

export async function markCompleted(
  supabase: SupabaseClient,
  songId: string,
  urls: [string | undefined, string | undefined]
): Promise<void> {
  const [u1, u2] = urls
  const audioUrl = u1 ? await rehostAudio(supabase, songId, u1, 1) : undefined
  const audioUrl2 = u2 ? await rehostAudio(supabase, songId, u2, 2) : undefined
  await supabase
    .from('song_generations')
    .update({ status: 'completed', audio_url: audioUrl, audio_url_2: audioUrl2 })
    .eq('id', songId)
    .neq('status', 'completed')
  await supabase.channel(`song:${songId}`).send({
    type: 'broadcast',
    event: 'status',
    payload: { status: 'completed', audioUrl, audioUrl2 },
  })
}

export async function markFailed(supabase: SupabaseClient, songId: string, message: string): Promise<void> {
  await supabase
    .from('song_generations')
    .update({ status: 'failed', error_message: message })
    .eq('id', songId)
    .neq('status', 'completed')
  await supabase.channel(`song:${songId}`).send({
    type: 'broadcast',
    event: 'status',
    payload: { status: 'failed' },
  })
}
