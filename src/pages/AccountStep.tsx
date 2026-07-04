import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import Button from '../components/Button'
import OtpInput from '../components/OtpInput'
import BackButton from '../components/BackButton'
import OccasionBadge from '../components/OccasionBadge'
import GoogleButton from '../components/GoogleButton'
import GenerationLoader from '../components/GenerationLoader'
import { useSongDraft } from '../lib/SongDraftContext'
import { useProceedToGeneration } from '../lib/useProceedToGeneration'
import { track } from '../lib/analytics'
import {
  signUp,
  signIn,
  sendSignupOtp,
  verifySignupOtp,
  completeSignupWithoutOtp,
  getCurrentUser,
} from '../lib/api/auth'
import { isOtpEnabled } from '../lib/settings'

export default function AccountStep() {
  const navigate = useNavigate()
  const { draft } = useSongDraft()
  const proceed = useProceedToGeneration()

  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [phase, setPhase] = useState<'form' | 'otp'>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState(['', '', '', ''])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Retour OAuth : affiche un écran de chargement immédiat (pas le flash du
  // formulaire) le temps d'enchaîner. Initialisé SYNCHRONE depuis un drapeau posé
  // avant la redirection de retour, pour éviter tout clignotement.
  const [finishing, setFinishing] = useState(() => {
    try { return sessionStorage.getItem('mamelodie:oauth-return') === '1' } catch { return false }
  })

  // Retour d'une connexion qui recharge l'app (ex. Google OAuth) : si on est
  // déjà authentifié et qu'un brouillon existe, on enchaîne directement.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const user = await getCurrentUser()
      if (cancelled) return
      try { sessionStorage.removeItem('mamelodie:oauth-return') } catch { /* ignore */ }
      if (user && draft.occasion) {
        setFinishing(true)
        try {
          await proceed(draft)
        } catch {
          if (!cancelled) {
            setFinishing(false)
            setError('Impossible de lancer la génération, réessaie.')
          }
        }
      } else if (!cancelled) {
        setFinishing(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSubmit = email.includes('@') && password.length >= (mode === 'signup' ? 8 : 1)

  function authed() {
    sessionStorage.setItem('mamelodie:demo-authed', '1')
  }

  async function handleSubmit() {
    if (!canSubmit || loading) return
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        await signIn(email, password)
        authed()
        await proceed(draft)
        return
      }
      // Inscription
      const res = await signUp(email, password)
      setUserId(res.userId)
      if (await isOtpEnabled()) {
        await sendSignupOtp(res.userId, email)
        setPhase('otp')
        setLoading(false)
        return
      }
      await completeSignupWithoutOtp(res.userId)
      // Connexion explicite : garantit une VRAIE session persistée (sinon elle
      // peut être perdue au rechargement, ex. retour de paiement -> /inscription).
      await signIn(email, password)
      track('account_created')
      authed()
      await proceed(draft)
    } catch {
      setError('Impossible de continuer. Cet email est peut-être déjà utilisé, ou le mot de passe est trop faible.')
      setLoading(false)
    }
  }

  async function handleVerify() {
    setLoading(true)
    setError('')
    const ok = await verifySignupOtp(userId, code.join(''))
    if (ok) {
      track('account_created')
      // Établit la vraie session (l'email est confirmé côté serveur par
      // verify-email-otp) avant d'enchaîner.
      await signIn(email, password)
      authed()
      await proceed(draft)
    } else {
      setError('Code incorrect, réessaie.')
      setLoading(false)
    }
  }

  // Retour OAuth réussi : on lance la chanson en fond, sans réafficher le
  // formulaire (évite le « la page connexion réapparaît » qui fait douter).
  if (finishing) {
    return (
      <GenerationLoader
        title="Un instant…"
        phrases={['Connexion réussie ✓', 'On prépare ta chanson…']}
      />
    )
  }

  if (phase === 'otp') {
    return (
      <Shell
        logo
        footer={
          <Button className="w-full" loading={loading} disabled={code.some((d) => !d)} onClick={handleVerify}>
            {loading ? 'Vérification…' : 'Vérifier et générer'}
          </Button>
        }
      >
        <BackButton onClick={() => setPhase('form')} label="Modifier" className="mb-4" />
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h1 className="text-[20px] md:text-[23px] mb-1">Vérifie ton email</h1>
          <p className="text-[13px] md:text-[15px] text-ink-soft mb-7">Code envoyé à {email}</p>
          <OtpInput value={code} onChange={(v) => { setCode(v); setError('') }} />
          {error && <p className="text-[12px] md:text-[13px] text-ember-700 mt-3">{error}</p>}
        </div>
      </Shell>
    )
  }

  return (
    <Shell
      logo
      footer={
        <>
          <Button className="w-full" loading={loading} disabled={!canSubmit} onClick={handleSubmit}>
            {loading
              ? 'Création de ta chanson…'
              : mode === 'signup'
                ? 'Créer mon compte et générer'
                : 'Se connecter et générer'}
          </Button>
          <p className="text-[12px] md:text-[13px] text-clay text-center mt-2">
            {mode === 'signup' ? (
              <>Déjà un compte ?{' '}
                <button onClick={() => { setMode('login'); setError('') }} className="text-ember-700">Se connecter</button>
              </>
            ) : (
              <>Pas encore de compte ?{' '}
                <button onClick={() => { setMode('signup'); setError('') }} className="text-ember-700">En créer un</button>
              </>
            )}
          </p>
        </>
      }
    >
      <BackButton onClick={() => navigate('/creer/paroles')} className="mb-4" />

      <div className="text-center mb-6">
        <span className="text-[12px] md:text-[13px] font-semibold text-ember-700 bg-ember-50 px-3 py-1 rounded-full">
          Dernière étape
        </span>
        <h1 className="text-[22px] md:text-[26px] mt-3 mb-1">Ta chanson est prête à être créée</h1>
        <p className="text-[14px] md:text-[16px] text-ink-soft mb-4">
          Crée ton compte pour lancer la musique et retrouver ta chanson.
        </p>
        <OccasionBadge />
      </div>

      {/* Google : popup sur desktop / redirection sur mobile. Le retour se fait
          sur /creer/compte où le useEffect ci-dessus enchaîne la génération. */}
      <div className="mb-4">
        <GoogleButton redirectTo="/creer/compte" />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="flex-1 h-px bg-line" />
        <span className="text-[12px] text-clay">ou</span>
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
            placeholder={mode === 'signup' ? '8 caractères minimum' : 'Ton mot de passe'}
            className="w-full h-12 md:h-[52px] rounded-lg border border-line px-3 md:px-4 text-[15px] md:text-[17px] bg-surface focus:border-ember-600 outline-none"
          />
        </div>
        {error && <p className="text-[12px] md:text-[13px] text-ember-700">{error}</p>}
      </div>
    </Shell>
  )
}
