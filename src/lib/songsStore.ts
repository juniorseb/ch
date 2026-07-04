import type { SongGeneration } from './types'

// Mémoire locale des chansons créées en mode démo (pas encore de Supabase).
// En mode réel, la bibliothèque vient de la table song_generations ; ici on
// garde les chansons générées pendant la session pour qu'elles apparaissent
// tout de suite dans "Mes chansons" et restent jouables.
const KEY = 'mamelodie:songs'

export function readDemoSongs(): SongGeneration[] {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SongGeneration[]) : []
  } catch {
    return []
  }
}

export function addDemoSong(song: SongGeneration): void {
  const all = readDemoSongs()
  if (all.some((s) => s.id === song.id)) return
  sessionStorage.setItem(KEY, JSON.stringify([song, ...all]))
}
