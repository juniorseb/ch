import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Shell from '../components/Shell'
import Button from '../components/Button'
import AuthHeader from '../components/AuthHeader'
import GoogleButton from '../components/GoogleButton'
import SupportBadge from '../components/SupportBadge'
import { signIn } from '../lib/api/auth'
import { track } from '../lib/analytics'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!email.includes('@') || !password) return
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
      track('login')
      sessionStorage.setItem('mamelodie:demo-authed', '1')
      navigate('/app')
    } catch {
      setError('Email ou mot de passe incorrect.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Shell
      footer={
        <>
          <Button className="w-full" loading={loading} disabled={!email.includes('@') || !password} onClick={handleSubmit}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </Button>
          <p className="text-[14px] md:text-[16px] text-clay text-center mt-3">
            Pas encore de compte ?{' '}
            <a href="/inscription" className="text-ember-700 font-semibold underline underline-offset-2">En créer un</a>
          </p>
        </>
      }
    >
      <AuthHeader action={{ label: "S'inscrire", to: '/inscription' }} />

      <div className="text-center mb-7">
        <h1 className="text-[22px] md:text-[26px] mb-1">Content de te revoir</h1>
        <p className="text-[14px] md:text-[16px] text-ink-soft">Connecte-toi pour retrouver tes chansons</p>
      </div>

      {/* Chemin le plus rapide en premier (un clic, sans mot de passe). */}
      <GoogleButton redirectTo="/app" label="Se connecter avec Google" />
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
            placeholder="Ton mot de passe"
            className="w-full h-12 md:h-[52px] rounded-lg border border-line px-3 md:px-4 text-[15px] md:text-[17px] bg-surface focus:border-ember-600 outline-none"
          />
        </div>
        {error && <p className="text-[12px] md:text-[13px] text-ember-700">{error}</p>}
        <a href="/mot-de-passe-oublie" className="text-[12px] md:text-[13px] text-ember-700 text-center">
          Mot de passe oublié ?
        </a>
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
        <SupportBadge />
      </div>
    </Shell>
  )
}
