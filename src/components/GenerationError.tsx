import { useNavigate } from 'react-router-dom'
import Shell from './Shell'
import Button from './Button'

interface GenerationErrorProps {
  // Message court expliquant l'échec.
  message?: string
  // Relance l'étape qui a échoué. Absent = pas de bouton réessayer.
  onRetry?: () => void
  retrying?: boolean
}

// Écran d'échec de génération. Rassure sur le crédit (non débité en cas
// d'échec, cf. la vue user_credits qui ne compte pas les chansons 'failed')
// et propose de réessayer ou de revenir à l'accueil -- plus jamais de spinner
// infini.
export default function GenerationError({ message, onRetry, retrying }: GenerationErrorProps) {
  const navigate = useNavigate()
  return (
    <Shell
      footer={
        <>
          {onRetry && (
            <Button className="w-full" disabled={retrying} onClick={onRetry}>
              {retrying ? 'Nouvelle tentative…' : 'Réessayer'}
            </Button>
          )}
          <button
            onClick={() => navigate('/app')}
            className="w-full text-[13px] md:text-[15px] text-ember-700 mt-2.5"
          >
            Retour à l'accueil
          </button>
        </>
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-ember-50 flex items-center justify-center mb-6">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-ember-700)" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" strokeLinecap="round" />
            <path d="M12 16v0" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-[20px] md:text-[23px] mb-1">La génération a échoué</h1>
        <p className="text-[14px] md:text-[16px] text-ink-soft max-w-[300px]">
          {message ?? 'Un souci est survenu pendant la création.'} Ton crédit n'a pas été débité.
        </p>
      </div>
    </Shell>
  )
}
