import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import GenerationError from '../components/GenerationError'
import { useSongDraft } from '../lib/SongDraftContext'
import { setActiveGeneration } from '../lib/activeGeneration'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { OccasionId } from '../lib/types'

const KEY = 'mamelodie:pendingSongId'
const MAX_TRIES = 20 // ~60s à 3s d'intervalle

// Écran de retour après le checkout mobile money (redirection pleine page
// GeniusPay). L'état React ayant été perdu, on retrouve la chanson en attente
// via localStorage, on restaure le contexte, puis on route selon le statut
// réel en base (le webhook a pu déjà confirmer le paiement et lancer les
// paroles). Fin du parcours cassé au retour de paiement.
export default function PaymentReturn() {
  const navigate = useNavigate()
  const { setDraft, setSongGenerationId } = useSongDraft()
  const [failed, setFailed] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const songId = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null

    // Pas de paiement en attente (ou mode démo) : rien à reprendre.
    if (!isSupabaseConfigured || !songId) {
      navigate('/app', { replace: true })
      return
    }

    setSongGenerationId(songId)
    let tries = 0
    let cancelled = false

    async function check() {
      if (cancelled) return
      const { data } = await supabase
        .from('song_generations')
        .select('occasion, recipient_name, sender_name, relation, marriage_type, meet_context, style, voice, ambiance, language, story, title, status')
        .eq('id', songId)
        .maybeSingle()

      if (data) {
        // Restaure le brouillon pour les écrans suivants.
        setDraft({
          occasion: (data.occasion as OccasionId) ?? null,
          recipientName: (data.recipient_name as string) ?? '',
          senderName: (data.sender_name as string) ?? '',
          relation: (data.relation as string) ?? '',
          marriageType: (data.marriage_type as string) ?? '',
          meetContext: (data.meet_context as string) ?? '',
          style: (data.style as string) ?? '',
          voice: (data.voice as string) ?? '',
          ambiance: (data.ambiance as string) ?? '',
          language: (data.language as string) ?? 'francais',
          story: (data.story as string) ?? '',
        })

        const status = data.status as string
        if (status === 'failed') {
          localStorage.removeItem(KEY)
          setFailed(true)
          return
        }
        if (status === 'completed') {
          localStorage.removeItem(KEY)
          navigate(`/app/chansons/${songId}`, { replace: true })
          return
        }
        if (status === 'generating_audio' || status === 'lyrics_ready' || status === 'generating_lyrics') {
          // La composition tourne côté serveur : on la suit via la bannière en
          // arrière-plan (comme le flow crédit), pas l'ancien écran bloquant.
          localStorage.removeItem(KEY)
          setActiveGeneration({
            id: songId as string,
            title: (data.title as string) || `Pour ${(data.recipient_name as string) || 'toi'}`,
            startedAt: Date.now(),
          })
          navigate('/app', { replace: true })
          return
        }
        // status 'pending_payment' : le webhook n'a pas encore confirmé,
        // on continue à interroger.
      }

      tries += 1
      if (tries >= MAX_TRIES) {
        setTimedOut(true)
        return
      }
      setTimeout(check, 3000)
    }

    check()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (failed) {
    return <GenerationError message="Le paiement n'a pas pu être confirmé." />
  }

  if (timedOut) {
    return (
      <GenerationError message="On n'a pas encore reçu la confirmation de ton paiement. Si tu as bien payé, ta chanson apparaîtra dans « Mes chansons » d'ici quelques minutes." />
    )
  }

  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-ember-50 flex items-center justify-center mb-6">
          <span className="w-3 h-3 rounded-full bg-ember-600 animate-pulse" />
        </div>
        <h1 className="text-[20px] md:text-[23px] mb-1">On confirme ton paiement</h1>
        <p className="text-[14px] md:text-[16px] text-ink-soft">Un petit instant…</p>
      </div>
    </Shell>
  )
}
