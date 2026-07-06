import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useSongHistory } from '../lib/useSongHistory'
import { getUsername, getCachedUsername } from '../lib/api/profile'
import { STYLES, OCCASIONS } from '../lib/types'

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function styleLabel(id: string) {
  return STYLES.find((s) => s.id === id)?.label ?? id
}
function occasionLabel(id: string) {
  return OCCASIONS.find((o) => o.id === id)?.label ?? id
}

export default function Dashboard() {
  const { songs, songsRemaining, loading } = useSongHistory()
  // On initialise depuis le cache (affichage instantané au retour sur l'accueil) ;
  // null seulement à la toute première visite -> skeleton. Rafraîchi en fond.
  const [name, setName] = useState<string | null>(() => {
    const c = getCachedUsername()
    return c ? capitalize(c) : null
  })

  useEffect(() => {
    getUsername().then((u) => setName(capitalize(u)))
  }, [])

  // Aperçu : les plus récentes d'abord (tri décroissant par date), limité à 5.
  const RECENT_LIMIT = 5
  const recentSongs = [...songs]
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, RECENT_LIMIT)

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="text-[13px] md:text-[15px] text-clay">Bonjour</div>
          {name === null ? (
            <span className="inline-block w-32 h-6 md:h-7 mt-1 rounded-md bg-white/10 animate-pulse" />
          ) : (
            // truncate : certains pseudos (ex. issus de Google) sont très longs ;
            // on tronque avec « … » pour ne pas casser la mise en page ni pousser
            // le badge de solde hors de l'écran.
            <h1 className="text-[22px] md:text-[26px] truncate">{name || 'toi'}</h1>
          )}
        </div>
        {/* Badge de solde (remplace l'avatar : le profil est dans la nav basse).
            Toujours visible, chiffre en orange, clic -> recharge. */}
        <Link
          to="/creer/paiement?topup=1"
          className="shrink-0 flex items-center gap-1.5 rounded-full bg-surface border border-line px-3 py-2 hover:border-ember-400 transition-colors"
          aria-label={`${songsRemaining} crédits — recharger`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 8H6a2 2 0 0 1 0-4h11v4" />
            <path d="M3 6v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5" />
            <circle cx="16.5" cy="13.5" r="1.2" fill="var(--color-ink-soft)" stroke="none" />
          </svg>
          <span className="text-[14px] font-semibold text-ember-600">{songsRemaining}</span>
        </Link>
      </div>

      {/* Onboarding uniquement : tant qu'il n'y a AUCUNE chanson (et une fois le
          chargement terminé, pour ne pas flasher l'état vide), on montre un CTA
          de création. Dès qu'un historique existe, le "+" suffit. */}
      {!loading && songs.length === 0 && (
        <Link
          to="/occasion"
          className="flex items-center gap-3 bg-surface-2 border border-ember-600/50 rounded-xl px-4 py-3.5 mb-7 hover:border-ember-600 transition-colors"
        >
          <span className="w-9 h-9 rounded-lg bg-ember-600 flex items-center justify-center shrink-0 text-cream">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </span>
          <div className="flex-1">
            <div className="font-display text-[15px] md:text-[17px] font-semibold text-ink">
              Créer une chanson
            </div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ember-600)" strokeWidth="1.8">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}

      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[13px] md:text-[15px] text-clay">Tes chansons</div>
        {!loading && songs.length > 0 && (
          <Link to="/app/chansons" className="text-[13px] md:text-[15px] text-ember-700">
            Voir tout
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {loading ? (
          // Skeleton pendant le chargement : évite l'apparition brusque des
          // chansons (et le clignotement de l'état « vide »).
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 border border-line bg-surface rounded-xl px-3 py-2.5"
            >
              <div className="w-9 h-9 rounded-lg bg-white/10 animate-pulse shrink-0" />
              <div className="flex-1">
                <div className="h-3.5 w-1/2 rounded bg-white/10 animate-pulse mb-1.5" />
                <div className="h-2.5 w-1/3 rounded bg-white/10 animate-pulse" />
              </div>
            </div>
          ))
        ) : (
          <>
            {recentSongs.map((song) => (
              <Link
                key={song.id}
                to={`/app/chansons/${song.id}`}
                className="flex items-center gap-3 border border-line bg-surface rounded-xl px-3 py-2.5 hover:border-ember-400 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-ember-50 flex items-center justify-center shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--color-ember-600)">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-[13px] md:text-[15px] font-semibold text-ink">{song.title}</div>
                  <div className="text-[11px] md:text-[12px] text-clay">
                    {occasionLabel(song.occasion)}, {styleLabel(song.style)}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-clay)" strokeWidth="1.8">
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
            {songs.length === 0 && (
              <p className="text-[12px] md:text-[13px] text-clay py-4">Ta bibliothèque est encore vide.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
