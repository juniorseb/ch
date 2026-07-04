import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import GenerationLoader from '../components/GenerationLoader'

// Court écran d'anticipation après le clic « Générer » : on lance la
// composition (déjà démarrée côté serveur) puis on redirige vers le dashboard,
// où une bannière suit la progression en arrière-plan.
export default function GenerationStart() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/app', { replace: true }), 2600)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <GenerationLoader
      title="C’est parti !"
      phrases={[
        'On lance la composition de ta chanson…',
        'Tu peux continuer à explorer, on te prévient dès que c’est prêt.',
      ]}
    />
  )
}
