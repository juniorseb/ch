import { useEffect, useState } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { getCurrentUser, isCurrentUserSuspended, signOut } from '../lib/api/auth'

export default function RequireAuth() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'checking' | 'authed' | 'anon' | 'suspended'>('checking')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const user = await getCurrentUser()
      if (cancelled) return
      if (!user) {
        setStatus('anon')
        return
      }
      if (await isCurrentUserSuspended()) {
        if (!cancelled) setStatus('suspended')
        return
      }
      if (!cancelled) setStatus('authed')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'checking') return null
  if (status === 'anon') return <Navigate to="/inscription" replace />

  if (status === 'suspended') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-[20px] md:text-[23px] mb-2">Compte suspendu</h1>
        <p className="text-[14px] text-ink-soft mb-6 max-w-[320px]">
          Ton compte a été suspendu. Contacte le support si tu penses qu'il s'agit d'une erreur.
        </p>
        <button
          onClick={async () => {
            await signOut()
            sessionStorage.removeItem('mamelodie:demo-authed')
            navigate('/')
          }}
          className="text-ember-700 text-[14px]"
        >
          Se déconnecter
        </button>
      </div>
    )
  }

  return <Outlet />
}
