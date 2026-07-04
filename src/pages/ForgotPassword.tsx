import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Shell from '../components/Shell'
import Button from '../components/Button'
import BackButton from '../components/BackButton'
import { requestPasswordReset } from '../lib/api/auth'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    if (!email.includes('@')) return
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Shell
      footer={
        sent ? (
          <Button className="w-full" onClick={() => navigate('/connexion')}>
            Retour à la connexion
          </Button>
        ) : (
          <Button className="w-full" disabled={!email.includes('@') || loading} onClick={handleSubmit}>
            {loading ? 'Envoi…' : 'Recevoir le lien'}
          </Button>
        )
      }
    >
      <BackButton onClick={() => navigate(-1)} className="mb-5" />

      <div className="text-center mb-7">
        <h1 className="text-[22px] md:text-[26px] mb-1">Mot de passe oublié</h1>
        <p className="text-[14px] md:text-[16px] text-ink-soft">
          {sent
            ? 'Si un compte existe pour cet email, un lien de réinitialisation vient d’être envoyé.'
            : 'Entre ton email, on t’envoie un lien pour choisir un nouveau mot de passe.'}
        </p>
      </div>

      {!sent && (
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
      )}
    </Shell>
  )
}
