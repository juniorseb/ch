import { useNavigate, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Shell from '../components/Shell'
import Button from '../components/Button'
import AuthHeader from '../components/AuthHeader'
import GoogleButton from '../components/GoogleButton'
import SupportBadge from '../components/SupportBadge'
import { signUp, signIn, sendSignupOtp, completeSignupWithoutOtp, getCurrentUser } from '../lib/api/auth'
import { isOtpEnabled } from '../lib/settings'
import { track } from '../lib/analytics'

export default function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Déjà connecté ? -> dashboard (pas de formulaire d'inscription).
  const [authed, setAuthed] = useState(false)
  useEffect(() => {
    getCurrentUser().then((u) => { if (u) setAuthed(true) })
  }, [])

  const canSubmit = email.includes('@') && password.length >= 8 && password === confirm

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      const otpOn = await isOtpEnabled()
      const { userId } = await signUp(email, password)

      if (!otpOn) {
        // OTP désactivé par l'admin : on entre directement, sans vérification.
        await completeSignupWithoutOtp(userId)
        // Connexion explicite -> session persistée (survit aux rechargements).
        await signIn(email, password)
        track('account_created')
        sessionStorage.setItem('mamelodie:demo-authed', '1')
        navigate('/app')
        return
      }

      await sendSignupOtp(userId, email)
      sessionStorage.setItem('mamelodie:pendingUserId', userId)
      sessionStorage.setItem('mamelodie:pendingEmail', email)
      // Mot de passe passé via l'état de navigation (mémoire, non persisté)
      // pour établir la session après vérification du code.
      navigate('/verification', { state: { password } })
    } catch {
      setError('Cet email est peut-être déjà utilisé, ou le mot de passe est trop faible.')
      setLoading(false)
    }
  }

  if (authed) return <Navigate to="/app" replace />

  return (
    <Shell
      footer={
        <>
          <Button className="w-full" loading={loading} disabled={!canSubmit} onClick={handleSubmit}>
            {loading ? 'Création en cours…' : 'Créer mon compte'}
          </Button>
          <p className="text-[14px] md:text-[16px] text-clay text-center mt-3">
            Déjà un compte ?{' '}
            <a href="/connexion" className="text-ember-700 font-semibold underline underline-offset-2">Se connecter</a>
          </p>
        </>
      }
    >
      <AuthHeader action={{ label: 'Se connecter', to: '/connexion' }} />

      <div className="text-center mb-7">
        <h1 className="text-[22px] md:text-[26px] mb-1">Crée ton compte</h1>
        <p className="text-[14px] md:text-[16px] text-ink-soft">Pour retrouver tes chansons à tout moment</p>
      </div>

      {/* Chemin le plus rapide en premier (un clic, sans mot de passe). */}
      <GoogleButton redirectTo="/app" label="S'inscrire avec Google" />
      <div className="flex items-center gap-3 my-4">
        <span className="flex-1 h-px bg-line" />
        <span className="text-[12px] text-clay">ou avec ton email</span>
        <span className="flex-1 h-px bg-line" />
      </div>

      <div className="flex flex-col gap-3.5">
        <div>
          <label className="text-[13px] md:text-[15px] text-ink-soft block mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ex : aicha@example.com"
            className="w-full h-12 md:h-[52px] rounded-lg border border-line px-3 md:px-4 text-[15px] md:text-[17px] bg-surface focus:border-ember-600 outline-none"
          />
        </div>
        <div>
          <label className="text-[13px] md:text-[15px] text-ink-soft block mb-1.5">Mot de passe</label>
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
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
        <SupportBadge />
      </div>
    </Shell>
  )
}
