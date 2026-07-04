import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSongHistory } from '../lib/useSongHistory'
import { signOut, getCurrentUser, hasPasswordIdentity, getCachedHasPassword } from '../lib/api/auth'
import { isAdmin, getCachedIsAdmin } from '../lib/api/admin'
import { getUsername, setUsername, getCachedUsername, getCachedEmail } from '../lib/api/profile'
import Button from '../components/Button'

export default function Profile() {
  const navigate = useNavigate()
  const { songsRemaining } = useSongHistory()
  // Initialisés depuis le cache pour éviter le "vide"/clignotement à l'arrivée.
  const [email, setEmail] = useState(() => getCachedEmail() ?? '')
  const [admin, setAdmin] = useState(() => getCachedIsAdmin() ?? false)
  const [username, setUsernameState] = useState(() => getCachedUsername() ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  // false = compte Google sans mot de passe -> on propose « Définir ». Par
  // défaut true (et cache) : on ne bascule jamais à tort sur « Définir ».
  const [hasPw, setHasPw] = useState(() => getCachedHasPassword() ?? true)

  useEffect(() => {
    getCurrentUser().then((user) => {
      const u = user as { email?: string } | null
      setEmail(u?.email ?? 'compte de démonstration')
    })
    getUsername().then(setUsernameState)
    isAdmin().then(setAdmin)
    hasPasswordIdentity().then(setHasPw).catch(() => setHasPw(true))
  }, [])

  async function saveUsername() {
    const name = draft.trim()
    if (!name || saving) return
    setSaving(true)
    try {
      await setUsername(name)
      setUsernameState(name)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await signOut()
    sessionStorage.removeItem('mamelodie:demo-authed')
    navigate('/')
  }

  return (
    <div className="pb-8">
      <h1 className="text-[22px] md:text-[26px] mb-6">Profil</h1>

      <div className="bg-ember-50 rounded-xl p-4 mb-5 flex items-center justify-between">
        <div>
          <div className="text-[13px] md:text-[15px] text-ink font-semibold">{songsRemaining} crédit{songsRemaining > 1 ? 's' : ''} restant{songsRemaining > 1 ? 's' : ''}</div>
          <div className="text-[12px] md:text-[13px] text-ember-700/80">1 crédit = 1 chanson</div>
        </div>
        <Button
          variant="secondary"
          className="h-9 px-3 text-[12px] md:text-[13px]"
          onClick={() => navigate('/creer/paiement?topup=1')}
        >
          Acheter des crédits
        </Button>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 mb-3">
        <div className="text-[13px] md:text-[15px] text-clay mb-0.5">Nom d'utilisateur</div>
        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 h-10 rounded-lg border border-line px-3 text-[15px] bg-surface-2 outline-none focus:border-ember-600"
            />
            <button onClick={saveUsername} disabled={saving} className="text-[13px] font-semibold rounded-lg px-3 py-2 bg-ember-600 text-cream disabled:opacity-50">
              OK
            </button>
            <button onClick={() => setEditing(false)} className="text-[13px] text-clay px-1">✕</button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-[15px] md:text-[17px] font-semibold text-ink">{username || '—'}</div>
            <button
              onClick={() => { setDraft(username); setEditing(true) }}
              className="text-[13px] md:text-[15px] text-ember-700"
            >
              Modifier
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 mb-5">
        <div className="text-[13px] md:text-[15px] text-clay mb-0.5">Email</div>
        <div className="text-[15px] md:text-[17px] font-semibold text-ink">{email}</div>
      </div>

      <div className="text-[13px] md:text-[15px] text-clay mb-2">Paramètres</div>
      <div className="flex flex-col bg-surface border border-line rounded-xl overflow-hidden mb-8">
        {admin && (
          <button
            onClick={() => navigate('/admin/portail-8x4k')}
            className="text-left px-4 py-3.5 text-[14px] md:text-[16px] text-ember-700 font-semibold border-b border-line hover:bg-surface flex items-center justify-between"
          >
            Espace admin
            <span className="text-[11px] md:text-[12px] bg-deep text-cream px-2 py-0.5 rounded-md">ADMIN</span>
          </button>
        )}
        <button
          onClick={() => navigate('/app/profil/paiements')}
          className="text-left px-4 py-3.5 text-[14px] md:text-[16px] text-ink border-b border-line hover:bg-surface"
        >
          Historique des paiements
        </button>
        <button
          onClick={() => navigate('/app/profil/mot-de-passe')}
          className="text-left px-4 py-3.5 text-[14px] md:text-[16px] text-ink border-b border-line hover:bg-surface"
        >
          {hasPw ? 'Changer mon mot de passe' : 'Définir un mot de passe'}
        </button>
        <button
          onClick={() => navigate('/app/avis')}
          className="text-left px-4 py-3.5 text-[14px] md:text-[16px] text-ink border-b border-line hover:bg-surface flex items-center justify-between"
        >
          Donner mon avis
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ember-600)" strokeWidth="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <a
          href="https://wa.me/2250102761670?text=Bonjour%2C%20j%27ai%20un%20souci..."
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-3.5 text-[14px] md:text-[16px] text-ink border-b border-line hover:bg-surface flex items-center justify-between"
        >
          Support
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-leaf-600)" strokeWidth="1.8">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 20l1.4-4.2A8.38 8.38 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <button onClick={handleLogout} className="text-left px-4 py-3.5 text-[14px] md:text-[16px] text-ember-700 hover:bg-surface">
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
