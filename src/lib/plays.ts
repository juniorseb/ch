import { supabase, isSupabaseConfigured } from './supabase'

// Suivi des écoutes de chansons (pour les stats admin). En démo, un simple
// compteur local ; en réel, une RPC security-definer qui incrémente
// song_generations.play_count pour la chanson de l'utilisateur.
const KEY = 'mamelodie:plays'

export function readDemoPlays(): number {
  return Number(localStorage.getItem(KEY) ?? '0')
}

export async function recordPlay(songId?: string): Promise<void> {
  if (!isSupabaseConfigured) {
    localStorage.setItem(KEY, String(readDemoPlays() + 1))
    return
  }
  if (!songId) return
  // Best-effort : on n'interrompt jamais la lecture si l'appel échoue.
  try {
    await supabase.rpc('record_play', { p_song: songId })
  } catch {
    /* ignore */
  }
}
