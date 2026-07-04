import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import { MOCK_SONGS } from './mockData'
import { readDemoSongs } from './songsStore'
import { readDemoCredits } from './api/credits'
import type { SongGeneration } from './types'

// En mode réel, la RLS (auth.uid() = user_id) filtre automatiquement aux
// chansons de l'utilisateur connecté -- pas besoin de filtrer côté client.
// Le solde de crédits vient de la vue user_credits (somme des crédits achetés
// moins les chansons générées). En mode démo (pas de projet Supabase encore
// configuré), on retombe sur des données d'exemple et un solde en
// sessionStorage qui démarre à 0, comme un vrai nouveau compte.
// Événement global : quand une chanson vient d'être finalisée (bannière de
// suivi), on demande aux listes déjà montées de se rafraîchir pour l'afficher.
export const SONGS_REFRESH_EVENT = 'mamelodie:songs-refresh'

export function useSongHistory(): { songs: SongGeneration[]; songsRemaining: number; loading: boolean } {
  const [songs, setSongs] = useState<SongGeneration[]>(
    isSupabaseConfigured ? [] : [...readDemoSongs(), ...MOCK_SONGS]
  )
  const [songsRemaining, setSongsRemaining] = useState(isSupabaseConfigured ? 0 : readDemoCredits())
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [reloadKey, setReloadKey] = useState(0)

  // Recharge la liste quand une chanson devient prête (sans remonter la page).
  useEffect(() => {
    const onRefresh = () => setReloadKey((k) => k + 1)
    window.addEventListener(SONGS_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(SONGS_REFRESH_EVENT, onRefresh)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let cancelled = false
    async function load() {
      const [{ data: songRows }, { data: credit }] = await Promise.all([
        supabase
          .from('song_generations')
          .select('id, title, occasion, style, status, audioUrl:audio_url, audioUrl2:audio_url_2, createdAt:created_at')
          .eq('status', 'completed')
          .order('created_at', { ascending: false }),
        supabase.from('user_credits').select('credits_balance').maybeSingle(),
      ])
      if (cancelled) return
      setSongs((songRows as unknown as SongGeneration[]) ?? [])
      setSongsRemaining(credit?.credits_balance ?? 0)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return { songs, songsRemaining, loading }
}
