import { supabase, isSupabaseConfigured } from './supabase'

// Suivi des téléchargements de chansons (pour les stats admin). En démo, un
// simple compteur local ; en réel, une RPC security-definer qui incrémente
// song_generations.download_count pour la chanson de l'utilisateur.
const KEY = 'mamelodie:downloads'

export function readDemoDownloads(): number {
  return Number(localStorage.getItem(KEY) ?? '0')
}

export async function recordDownload(songId?: string): Promise<void> {
  if (!isSupabaseConfigured) {
    localStorage.setItem(KEY, String(readDemoDownloads() + 1))
    return
  }
  if (!songId) return
  // Best-effort : on n'interrompt pas le téléchargement si l'appel échoue.
  try {
    await supabase.rpc('record_download', { p_song: songId })
  } catch {
    /* ignore */
  }
}
