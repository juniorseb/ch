import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import GenerationError from '../components/GenerationError'
import GenerationLoader from '../components/GenerationLoader'
import { useSongDraft } from '../lib/SongDraftContext'
import { checkSongStatus } from '../lib/api/song'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function Generating() {
  const navigate = useNavigate()
  const { songGenerationId } = useSongDraft()
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !songGenerationId) {
      const t = setTimeout(() => {
        setDone(true)
        sessionStorage.setItem(
          'mamelodie:lastAudioUrl',
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
        )
        sessionStorage.setItem(
          'mamelodie:lastAudioUrl2',
          'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
        )
        setTimeout(() => navigate('/creer/pret'), 500)
      }, 2200)
      return () => clearTimeout(t)
    }

    // songGenerationId est garanti non-null ici (garde ci-dessus).
    const id = songGenerationId

    // Une seule finalisation, quel que soit le canal qui arrive en premier
    // (broadcast Realtime OU sondage de secours).
    let finished = false
    function complete(audioUrl?: string, audioUrl2?: string) {
      if (finished) return
      finished = true
      setDone(true)
      sessionStorage.setItem('mamelodie:lastAudioUrl', audioUrl ?? '')
      sessionStorage.setItem('mamelodie:lastAudioUrl2', audioUrl2 ?? '')
      setTimeout(() => navigate('/creer/pret'), 500)
    }
    function fail() {
      if (finished) return
      finished = true
      setFailed(true)
    }

    // Fait avancer la génération : l'Edge Function interroge ApiPass et finalise
    // si prêt (moteur de progression en local ; en prod le callback peut finir
    // avant, on verra alors 'completed' directement).
    async function checkStatus() {
      try {
        const res = await checkSongStatus(id)
        if (res.status === 'completed') complete(res.audioUrl, res.audioUrl2)
        else if (res.status === 'failed') fail()
      } catch {
        /* on réessaiera au prochain tick */
      }
    }

    // Chemin principal : broadcast Realtime (émis par le callback ApiPass ou le
    // polling serveur).
    const channel = supabase
      .channel(`song:${id}`)
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        if (payload.status === 'completed') complete(payload.audioUrl, payload.audioUrl2)
        else if (payload.status === 'failed') fail()
      })
      .subscribe()

    // Filet de secours : on relit l'état en base tout de suite puis toutes les
    // 5 s (couvre un broadcast manqué, quel que soit le timing).
    checkStatus()
    const poll = setInterval(() => {
      if (finished) return
      checkStatus()
    }, 5000)

    // Garde-fou ultime : au-delà de ~4 min sans résultat, on arrête d'attendre
    // et on propose de réessayer (évite un chargement infini).
    const timeout = setTimeout(() => fail(), 240000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
      clearTimeout(timeout)
    }
  }, [songGenerationId, navigate])

  async function handleRetry() {
    if (!songGenerationId) return
    setRetrying(true)
    setFailed(false)
    // generate-audio réutilise les paroles déjà stockées si on ne les repasse pas.
    const { error } = await supabase.functions.invoke('generate-audio', { body: { songGenerationId } })
    setRetrying(false)
    if (error) setFailed(true)
  }

  if (failed) {
    return (
      <GenerationError
        message="La musique n'a pas pu être générée."
        onRetry={handleRetry}
        retrying={retrying}
      />
    )
  }

  if (done) {
    return (
      <Shell logo>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-ember-50 flex items-center justify-center mb-6">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--color-ember-600)" strokeWidth="2.4">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[20px] md:text-[23px]">C’est prêt !</h1>
        </div>
      </Shell>
    )
  }

  return (
    <GenerationLoader
      title="On compose ta musique"
      estimatedMs={150000}
      phrases={[
        'On choisit la mélodie…',
        'On pose le rythme et les instruments…',
        'On enregistre la voix…',
        'On prépare deux versions pour toi…',
        'Encore quelques instants…',
      ]}
    />
  )
}
