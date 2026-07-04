import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { googleOAuthUrl, signInWithGoogleRedirect } from '../lib/api/auth'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Bouton « Continuer avec Google ». Compromis utilisé par les grandes plateformes :
//   • Desktop  -> POPUP OAuth (l'utilisateur reste sur la page), puis retour auto.
//   • Mobile   -> REDIRECTION plein écran (popups peu fiables), retour auto.
// Détection de succès robuste : on n'attend PAS le postMessage de la popup (que
// la politique COOP peut couper après l'aller-retour cross-origin). On écoute
// onAuthStateChange (supabase synchronise la session entre fenêtres via
// localStorage) + un repli quand la popup se ferme.
export default function GoogleButton({
  redirectTo = '/app',
  label = 'Continuer avec Google',
}: {
  redirectTo?: string
  label?: string
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  async function handle() {
    if (loading) return
    setLoading(true)

    if (!isSupabaseConfigured) {
      sessionStorage.setItem('mamelodie:demo-authed', '1')
      navigate(redirectTo)
      return
    }

    // NB : /oauth/callback (pas /auth/...) pour ne PAS collisionner avec le proxy
    // Caddy « /auth/* -> Kong » en prod (sinon la page tombe sur le dashboard Kong).
    const base = `${window.location.origin}/oauth/callback?next=${encodeURIComponent(redirectTo)}`
    const useRedirect = window.matchMedia('(max-width: 767px)').matches

    // --- Mobile : redirection plein écran ---
    if (useRedirect) {
      try {
        await signInWithGoogleRedirect(base)
      } catch {
        setLoading(false)
      }
      return
    }

    // Callback marqué « popup » : la page de retour saura qu'elle doit se fermer
    // et NE PAS lancer la suite elle-même (c'est cette fenêtre qui naviguera).
    const callback = `${base}&popup=1`

    // --- Desktop : popup ---
    // On ouvre la fenêtre SYNCHRONE (dans le geste de clic) pour éviter le blocage
    // des popups, puis on y charge l'URL Google une fois obtenue.
    const w = 480
    const h = 640
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2)
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2)
    const popup = window.open('about:blank', 'mamelodie-oauth', `width=${w},height=${h},left=${left},top=${top}`)

    let url: string
    try {
      url = await googleOAuthUrl(callback)
    } catch {
      setLoading(false)
      popup?.close()
      return
    }

    if (!popup || popup.closed) {
      // Popup bloquée par le navigateur -> repli en redirection plein écran.
      window.location.href = url
      return
    }
    popup.location.href = url

    let done = false
    function succeed() {
      if (done) return
      done = true
      cleanup()
      // Dans le tunnel de création, on signale « retour OAuth » pour afficher un
      // écran de chargement au lieu du formulaire pendant l'enchaînement.
      if (redirectTo.startsWith('/creer')) {
        try { sessionStorage.setItem('mamelodie:oauth-return', '1') } catch { /* ignore */ }
      }
      // La session est en localStorage : on (re)charge la destination, ce qui
      // enchaîne la suite (ex. /creer/compte -> génération via son useEffect).
      window.location.assign(redirectTo)
    }
    function cleanup() {
      sub.data.subscription.unsubscribe()
      window.removeEventListener('message', onMessage)
      try { bc.close() } catch { /* ignore */ }
      window.clearInterval(watch)
      try {
        popup?.close()
      } catch {
        /* ignore */
      }
    }
    function onMessage(e: MessageEvent) {
      if (e.origin === window.location.origin && e.data === 'mamelodie-auth-success') succeed()
    }

    // Signal principal : BroadcastChannel depuis la popup (fiable même quand
    // window.opener est coupé par COOP après l'aller-retour Google).
    const bc = new BroadcastChannel('mamelodie-auth')
    bc.onmessage = (e) => { if (e.data === 'success') succeed() }
    // Filet : supabase synchronise la session entre fenêtres -> SIGNED_IN ici.
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') succeed()
    })
    window.addEventListener('message', onMessage)

    // Repli : quand la popup se ferme, on vérifie qu'une session existe bien.
    const watch = window.setInterval(async () => {
      if (!popup.closed) return
      window.clearInterval(watch)
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          succeed()
          return
        }
      } catch {
        /* ignore */
      }
      cleanup()
      setLoading(false)
    }, 500)
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="w-full h-12 md:h-[52px] rounded-xl bg-surface border border-line text-ink font-semibold text-[14px] md:text-[16px] flex items-center justify-center gap-2 hover:border-ember-400 transition-colors disabled:opacity-50"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.1 14.7 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c5.9 0 9.8-4.1 9.8-9.9 0-.7-.1-1.2-.2-1.7H12z" />
      </svg>
      {loading ? 'Connexion…' : label}
    </button>
  )
}
