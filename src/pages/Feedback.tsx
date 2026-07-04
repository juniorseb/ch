import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import Button from '../components/Button'
import { submitFeedback } from '../lib/api/feedback'

const MAX = 600

export default function Feedback() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!message.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      await submitFeedback(message, rating || null)
      setSent(true)
    } catch {
      setError("Impossible d'envoyer ton avis pour le moment. Réessaie dans un instant.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="pb-8 flex flex-col items-center justify-center text-center py-16">
        <div className="w-16 h-16 rounded-full bg-ember-50 flex items-center justify-center mb-5">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--color-ember-600)" strokeWidth="2.4">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[22px] md:text-[26px] mb-1">Merci pour ton retour !</h1>
        <p className="text-[14px] md:text-[16px] text-ink-soft mb-6">Ton avis nous aide à améliorer Mamélodie.</p>
        <Button onClick={() => navigate('/app')}>Retour à l'accueil</Button>
      </div>
    )
  }

  return (
    <div className="pb-8">
      <BackButton onClick={() => navigate(-1)} className="mb-5" />

      <h1 className="text-[22px] md:text-[26px] mb-1">Ton avis</h1>
      <p className="text-[14px] md:text-[16px] text-ink-soft mb-6">
        Une suggestion, un bug, une idée ? Dis-nous tout, ça nous aide à améliorer Mamélodie.
      </p>

      <div className="mb-4">
        <div className="text-[13px] md:text-[15px] text-clay mb-2">Ta note <span className="text-clay">· facultatif</span></div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n === rating ? 0 : n)}
              aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
              className="p-1"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill={n <= rating ? 'var(--color-ember-600)' : 'none'}
                stroke={n <= rating ? 'var(--color-ember-600)' : 'var(--color-line)'}
                strokeWidth="1.6"
              >
                <path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
        rows={6}
        placeholder="Ex : une idée, un bug, un mot gentil 😊"
        className="w-full rounded-xl border border-line bg-surface p-4 text-[14px] md:text-[16px] leading-relaxed resize-none focus:border-ember-600 outline-none"
      />
      <div className="text-[11px] md:text-[12px] text-clay text-right mt-1">{message.length} / {MAX}</div>

      {error && <p className="text-[12px] md:text-[13px] text-ember-700 mt-2">{error}</p>}

      <Button className="w-full mt-4" loading={loading} disabled={!message.trim()} onClick={handleSubmit}>
        {loading ? 'Envoi…' : 'Envoyer mon avis'}
      </Button>
    </div>
  )
}
