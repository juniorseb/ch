// Helpers partagés ApiPass (Suno) : parsing des réponses (callback webhook OU
// polling recordInfo) et finalisation d'une chanson (MAJ base + broadcast).
// Réf : https://apipass.dev/fr/document/suno-api-integration-guide
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// Extrait les URLs des (jusqu'à) 2 variantes audio, en tolérant plusieurs
// formes de clés (audio_url / audioUrl / url).
export function extractAudioUrls(resultData: unknown): [string | undefined, string | undefined] {
  const arr = Array.isArray(resultData) ? resultData : []
  const url = (x: unknown) => {
    const o = (x ?? {}) as Record<string, unknown>
    return (o.audio_url ?? o.audioUrl ?? o.url) as string | undefined
  }
  return [url(arr[0]), url(arr[1])]
}

export type TaskState =
  | { state: 'success'; urls: [string | undefined, string | undefined] }
  | { state: 'fail'; message: string }
  | { state: 'pending' }

// Interroge ApiPass une fois (recordInfo) pour connaître l'état d'une tâche.
// Court (un seul appel) -> utilisable dans une fonction à réponse rapide.
export async function pollApipass(taskId: string, apiKey: string): Promise<TaskState> {
  // NB : recordInfo (polling de statut) n'est PAS facturé par ApiPass — on ne le
  // compte donc pas dans les métriques (sinon le compteur « ApiPass » gonflerait
  // bien au-delà du nombre réel de générations débitées). Seul createTask compte.
  const res = await fetch(
    `https://api.apipass.dev/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { 'Authorization': `Bearer ${apiKey}` } }
  )
  if (!res.ok) return { state: 'pending' }
  return readTaskState(await res.json())
}

// Interprète un corps ApiPass (callback OU recordInfo) : réussite / échec / en
// cours. L'état global est dans data.state ('success' | 'fail') et les audios
// dans data.resultJson.data[] (voir guide §5).
export function readTaskState(body: Record<string, unknown>): TaskState {
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
    return { state: 'success', urls: extractAudioUrls(resultData) }
  }
  return { state: 'pending' }
}

// Ré-héberge un fichier audio du prestataire vers NOTRE stockage (Supabase
// Storage, bucket public "songs") : le lien devient celui de notre domaine
// (masque le prestataire) et l'audio est persistant (les liens du CDN externe
// peuvent expirer). Best-effort : en cas d'échec, on garde l'URL d'origine.
async function rehostAudio(
  supabase: SupabaseClient,
  songId: string,
  url: string,
  idx: number
): Promise<string> {
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

// Marque une chanson comme terminée (idempotent) et diffuse le résultat en
// Realtime pour l'écran de génération. N'écrase pas une chanson déjà finalisée.
export async function markCompleted(
  supabase: SupabaseClient,
  songId: string,
  urls: [string | undefined, string | undefined]
): Promise<void> {
  const [u1, u2] = urls
  // On ré-héberge sur notre stockage avant d'enregistrer les URLs finales.
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
