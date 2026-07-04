import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getVisitorId } from '../lib/analytics'

// Page de retour OAuth. Supabase échange le code présent dans l'URL pour établir
// la session. Deux modes, distingués par le paramètre `popup` de l'URL (fiable —
// contrairement à window.opener que la politique COOP peut couper) :
//   • popup=1 (desktop) : on signale le succès à la fenêtre principale via
//     BroadcastChannel puis on se ferme. On NE lance PAS la suite ici (sinon la
//     génération partirait en double, dans la popup ET dans la fenêtre parente).
//   • sinon (mobile, redirection plein écran) : on continue vers `next`.
export default function AuthCallback() {
  const [closable, setClosable] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function finish() {
      // Attend que la session soit établie (échange du code), max ~6 s.
      for (let i = 0; i < 30 && !cancelled; i++) {
        const { data } = await supabase.auth.getSession()
        if (data.session) break
        await new Promise((r) => setTimeout(r, 200))
      }

      // Tracking : une connexion Google sur un NOUVEAU compte = inscription.
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const created = Date.parse(user.created_at ?? '')
          const last = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : created
          const isNewAccount = Number.isFinite(created) && Math.abs(last - created) < 10000
          if (isNewAccount) {
            await supabase.functions.invoke('track', {
              body: { visitorId: getVisitorId(), event: 'account_created', path: '/auth/callback' },
            })
          }
        }
      } catch {
        /* le tracking ne doit jamais bloquer le retour */
      }

      const params = new URLSearchParams(window.location.search)
      const next = params.get('next') || '/app'
      const isPopup = params.get('popup') === '1'

      if (isPopup) {
        // Signale le succès à la fenêtre principale (BroadcastChannel = fiable
        // même si window.opener est coupé). Elle se charge de la navigation.
        try {
          const bc = new BroadcastChannel('mamelodie-auth')
          bc.postMessage('success')
          bc.close()
        } catch {
          /* pas de BroadcastChannel : on tente le postMessage classique */
        }
        try {
          if (window.opener) window.opener.postMessage('mamelodie-auth-success', window.location.origin)
        } catch {
          /* origines : ignore */
        }
        window.close()
        // Si le navigateur refuse de fermer : message, mais on NE navigue PAS
        // vers `next` (éviterait de relancer la génération dans la popup).
        setTimeout(() => { if (!cancelled) setClosable(true) }, 400)
      } else {
        // Mobile (redirection plein écran) : dans le tunnel, on signale le retour
        // OAuth pour afficher un chargement au lieu du formulaire.
        if (next.startsWith('/creer')) {
          try { sessionStorage.setItem('mamelodie:oauth-return', '1') } catch { /* ignore */ }
        }
        window.location.replace(next)
      }
    }

    finish()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg text-clay text-[14px] md:text-[15px] text-center px-6">
      {closable ? 'Connexion réussie ✓ Tu peux fermer cette fenêtre.' : 'Connexion en cours…'}
    </div>
  )
}
