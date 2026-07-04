import { supabase, isSupabaseConfigured } from '../supabase'
import type { SongDraft } from '../types'

// Crée une chanson en consommant un crédit déjà disponible, sans passer par
// le paiement. En mode réel, l'Edge Function `create-song` revérifie le solde
// côté serveur (source de vérité), insère la ligne song_generations en
// statut generating_lyrics et déclenche la génération des paroles.
// Génère un aperçu des paroles AVANT tout compte/paiement (moment de valeur).
// En réel, une Edge Function publique (preview-lyrics) renvoie les paroles à
// partir du brouillon, sans rien écrire en base. En démo, l'écran gère son
// propre exemple.
export async function generateLyricsPreview(draft: SongDraft): Promise<string> {
  if (!isSupabaseConfigured) return ''
  const { data, error } = await supabase.functions.invoke('preview-lyrics', { body: { draft } })
  if (error) throw error
  return (data?.lyrics as string) ?? ''
}

// Démo : structure légèrement un texte brut (ajoute des balises de section)
// pour illustrer l'amélioration quand il n'y a pas d'IA branchée.
function scaffoldDemo(text: string): string {
  if (text.includes('[')) return text
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return text
  const out = [
    '[Intro]', lines[0],
    '', '[Couplet 1]', ...lines.slice(1, 4),
    '', '[Refrain]', ...(lines.slice(4, 7).length ? lines.slice(4, 7) : [lines[0]]),
    '', '[Outro]', lines[lines.length - 1],
  ]
  return out.filter((x) => x !== undefined).join('\n')
}

// Améliore/structure les paroles de l'utilisateur via l'IA (flow "mes paroles").
export async function improveLyrics(draft: SongDraft): Promise<string> {
  const base = draft.ownLyrics ?? ''
  if (!isSupabaseConfigured) {
    await new Promise((r) => setTimeout(r, 900))
    return scaffoldDemo(base)
  }
  const { data, error } = await supabase.functions.invoke('preview-lyrics', { body: { draft, improve: true } })
  if (error) throw error
  return (data?.lyrics as string) || base
}

export interface SongStatusResult {
  status: 'pending' | 'generating_audio' | 'completed' | 'failed'
  audioUrl?: string
  audioUrl2?: string
}

// Fait avancer une chanson en cours : l'Edge Function interroge ApiPass une
// fois et finalise si prêt (moteur de progression en local, filet en prod).
export async function checkSongStatus(songGenerationId: string): Promise<SongStatusResult> {
  const { data, error } = await supabase.functions.invoke('check-song-status', {
    body: { songGenerationId },
  })
  if (error) throw error
  return data as SongStatusResult
}

// Supprime définitivement une chanson (et son audio stocké). Sécurisé côté
// serveur : la fonction vérifie que l'appelant est bien le propriétaire.
export async function deleteSong(songGenerationId: string): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.functions.invoke('delete-song', {
    body: { songGenerationId },
  })
  if (error) throw error
}

export async function createSongFromCredit(draft: SongDraft): Promise<{ songGenerationId: string }> {
  if (!isSupabaseConfigured) {
    return { songGenerationId: `demo_${Date.now()}` }
  }
  const { data, error } = await supabase.functions.invoke('create-song', { body: { draft } })
  if (error) throw error
  return { songGenerationId: data.songGenerationId }
}
