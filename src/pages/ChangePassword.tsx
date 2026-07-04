import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Button from '../components/Button'
import BackButton from '../components/BackButton'
import { updatePassword, hasPasswordIdentity, getCachedHasPassword } from '../lib/api/auth'

export default function ChangePassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  // Initialisé depuis le cache (pas de bascule visible « Changer » -> « Définir »).
  // null = inconnu à la 1re visite -> on affiche « Changer » par défaut.
  const [hasPw, setHasPw] = useState<boolean | null>(() => getCachedHasPassword())

  useEffect(() => {
    hasPasswordIdentity().then(setHasPw).catch(() => setHasPw(true))
  }, [])

  // Libellés adaptés : « Définir » pour un compte Google sans mot de passe.
  const isSet = hasPw === false
  const title = isSet ? 'Définir un mot de passe' : 'Changer mon mot de passe'

  const canSubmit = password.length >= 8 && password === confirm

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      await updatePassword(password)
      setDone(true)
    } catch {
      setError('La mise à jour a échoué, réessaie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pb-8">
      <BackButton onClick={() => navigate(-1)} className="mb-5" />

      <h1 className="text-[22px] md:text-[26px] mb-6">{title}</h1>

      {done ? (
        <div className="bg-leaf-100 text-leaf-900 rounded-xl p-4 text-[14px] md:text-[16px]">
          {isSet
            ? 'Ton mot de passe est défini. Tu peux maintenant aussi te connecter par email.'
            : 'Ton mot de passe a été mis à jour.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {isSet && (
            <p className="text-[13px] md:text-[15px] text-ink-soft -mt-2 mb-1">
              Ton compte utilise Google. Définis un mot de passe pour pouvoir aussi te connecter par email.
            </p>
          )}
          <div>
            <label className="text-[13px] md:text-[15px] text-ink-soft block mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
              className="w-full h-12 md:h-[52px] rounded-lg border border-line px-3 md:px-4 text-[15px] md:text-[17px] bg-surface focus:border-ember-600 outline-none"
            />
          </div>
          <div>
            <label className="text-[13px] md:text-[15px] text-ink-soft block mb-1.5">Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Retape ton mot de passe"
              className="w-full h-12 md:h-[52px] rounded-lg border border-line px-3 md:px-4 text-[15px] md:text-[17px] bg-surface focus:border-ember-600 outline-none"
            />
          </div>
          {error && <p className="text-[12px] md:text-[13px] text-ember-700">{error}</p>}
          <Button className="w-full mt-2" disabled={!canSubmit || loading} onClick={handleSubmit}>
            {loading ? 'Mise à jour…' : 'Enregistrer'}
          </Button>
        </div>
      )}
    </div>
  )
}
