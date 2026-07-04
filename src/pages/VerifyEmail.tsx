import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Shell from '../components/Shell'
import Button from '../components/Button'
import OtpInput from '../components/OtpInput'
import { verifySignupOtp, sendSignupOtp, signIn } from '../lib/api/auth'
import { track } from '../lib/analytics'

const RESEND_COOLDOWN = 45

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const password = (location.state as { password?: string } | null)?.password ?? ''
  const [code, setCode] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const userId = sessionStorage.getItem('mamelodie:pendingUserId') ?? ''
  const email = sessionStorage.getItem('mamelodie:pendingEmail') ?? ''

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function handleVerify() {
    setVerifying(true)
    const ok = await verifySignupOtp(userId, code.join(''))
    if (ok) {
      // Établit la session réelle après vérification (mot de passe transmis
      // depuis l'inscription via l'état de navigation).
      if (password) await signIn(email, password)
      track('account_created')
      sessionStorage.setItem('mamelodie:demo-authed', '1')
      navigate('/app')
    } else {
      setError('Code incorrect, réessaie.')
      setVerifying(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending || !userId || !email) return
    setResending(true)
    setError('')
    setInfo('')
    try {
      await sendSignupOtp(userId, email)
      setCode(['', '', '', ''])
      setInfo('Nouveau code envoyé.')
      setCooldown(RESEND_COOLDOWN)
    } catch {
      setError("Impossible d'envoyer le code, réessaie.")
    } finally {
      setResending(false)
    }
  }

  return (
    <Shell
      footer={
        <Button className="w-full" disabled={code.some((d) => !d) || verifying} onClick={handleVerify}>
          {verifying ? 'Vérification…' : 'Vérifier'}
        </Button>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.6" className="mb-2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1 className="text-[20px] md:text-[23px] mb-1">Vérifie ton email</h1>
        <p className="text-[13px] md:text-[15px] text-ink-soft mb-1">
          Code envoyé à <span className="text-ink">{email}</span>
        </p>
        <button
          type="button"
          onClick={() => navigate('/inscription')}
          className="text-[12px] md:text-[13px] text-ember-700 underline underline-offset-2 mb-7"
        >
          Modifier l'email
        </button>

        <OtpInput value={code} onChange={(v) => { setCode(v); setError(''); setInfo('') }} />

        {error && <p className="text-[12px] md:text-[13px] text-ember-700 mt-3">{error}</p>}
        {info && !error && <p className="text-[12px] md:text-[13px] text-ink-soft mt-3">{info}</p>}

        <div className="mt-6 text-[12px] md:text-[13px] text-ink-soft">
          Pas reçu de code ?{' '}
          {cooldown > 0 ? (
            <span className="text-clay">Renvoyer dans {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-ember-700 underline underline-offset-2 disabled:opacity-50"
            >
              {resending ? 'Envoi…' : 'Renvoyer le code'}
            </button>
          )}
        </div>
      </div>
    </Shell>
  )
}
