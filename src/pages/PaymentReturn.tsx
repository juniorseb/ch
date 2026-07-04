import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import Button from '../components/Button'
import GenerationError from '../components/GenerationError'
import { useSongDraft } from '../lib/SongDraftContext'
import { setActiveGeneration } from '../lib/activeGeneration'
import { getCurrentUser } from '../lib/api/auth'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { OccasionId } from '../lib/types'

const KEY = 'mamelodie:pendingSongId'
const MAX_TRIES = 20 // ~60s à 3s d'intervalle

// Écran de retour après le checkout mobile money (redirection pleine page).
// Deux cas :
//  - MÊME navigateur (session présente) : on retrouve la chanson via localStorage,
//    on restaure le contexte et on route selon le statut réel (le webhook a pu
//    déjà confirmer et lancer la génération).
//  - AUTRE navigateur (ex. Wave -> Safari, pas de session) : impossible de lire
//    la chanson (RLS). Le paiement étant déjà confirmé côté serveur (webhook),
//    on affiche un succès et on invite à se connecter pour la retrouver.
export default function PaymentReturn() {
  const navigate = useNavigate()
  const { setDraft, setSongGenerationId } = useSongDraft()
  const [failed, setFailed] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      navigate('/app', { replace: true })
      return
    }
    let cancelled = false

    ;(async () => {
      // Paramètres du retour (glissés dans l'URL par create-payment) :
      //  - login : jeton magic-link -> auto-connexion (session absente dans un
      //    autre navigateur, ex. Wave -> Safari)
      //  - song  : id de la chanson (le pendingSongId du localStorage n'existe
      //    pas dans l'autre navigateur)
      const params = new URLSearchParams(window.location.search)
      const loginToken = params.get('login')
      const songFromUrl = params.get('song')
      if (loginToken) {
        try {
          await supabase.auth.verifyOtp({ token_hash: loginToken, type: 'magiclink' })
        } catch {
          /* jeton expiré/déjà utilisé -> on tombera sur l'écran « connecte-toi » */
        }
      }
      // On retire les paramètres sensibles de l'URL (hygiène).
      if (loginToken || songFromUrl) window.history.replaceState({}, '', window.location.pathname)

      const user = await getCurrentUser()
      if (cancelled) return

      // Toujours pas de session (jeton absent/expiré) : le paiement est confirmé
      // côté serveur ; on invite juste à se connecter.
      if (!user) {
        setNeedsLogin(true)
        return
      }

      const songId =
        songFromUrl || (typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null)
      if (!songId) {
        // Connecté mais rien à reprendre (ex. recharge de crédits) -> dashboard.
        navigate('/app', { replace: true })
        return
      }

      setSongGenerationId(songId)
      let tries = 0

      async function check() {
        if (cancelled) return
        const { data } = await supabase
          .from('song_generations')
          .select('occasion, recipient_name, sender_name, relation, marriage_type, meet_context, style, voice, ambiance, language, story, title, status')
          .eq('id', songId!)
          .maybeSingle()

        if (data) {
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
            // La composition tourne côté serveur : suivi via la bannière en
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
          // 'pending_payment' : le webhook n'a pas encore confirmé -> on réessaie.
        }

        tries += 1
        if (tries >= MAX_TRIES) {
          setTimedOut(true)
          return
        }
        setTimeout(check, 3000)
      }

      check()
    })()

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

  // Retour sans session (autre navigateur) : succès + invite à se connecter.
  if (needsLogin) {
    return (
      <Shell footer={<Button className="w-full" onClick={() => navigate('/connexion')}>Se connecter</Button>}>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-leaf-100 flex items-center justify-center mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-leaf-600)" strokeWidth="2.4">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[20px] md:text-[23px] mb-1">Paiement confirmé 🎉</h1>
          <p className="text-[14px] md:text-[16px] text-ink-soft max-w-[320px]">
            Tes crédits sont ajoutés et ta chanson est en préparation. Connecte-toi pour la retrouver dans « Mes chansons ».
          </p>
        </div>
      </Shell>
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
