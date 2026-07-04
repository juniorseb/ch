import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import Logo from '../../components/Logo'
import { isAdmin } from '../../lib/api/admin'

export default function AdminLayout() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'checking' | 'ok' | 'denied'>('checking')

  useEffect(() => {
    isAdmin().then((ok) => setStatus(ok ? 'ok' : 'denied'))
  }, [])

  if (status === 'checking') return null
  if (status === 'denied') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-[20px] md:text-[23px] mb-2">Accès réservé</h1>
        <p className="text-[14px] text-ink-soft mb-6">Cet espace est réservé aux administrateurs.</p>
        <button onClick={() => navigate('/app')} className="text-ember-700 text-[14px]">
          ← Retour à l'application
        </button>
      </div>
    )
  }

  const tab = (to: string, label: string, end?: boolean) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-3 py-1.5 rounded-lg text-[13px] md:text-[15px] font-medium ${
          isActive ? 'bg-ember-600 text-cream' : 'text-ink-soft hover:bg-ember-50'
        }`
      }
    >
      {label}
    </NavLink>
  )

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[900px] mx-auto px-5 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo to="/app" size="sm" />
            <span className="text-[11px] md:text-[12px] bg-deep text-cream px-2 py-0.5 rounded-md">ADMIN</span>
          </div>
          <button onClick={() => navigate('/app')} className="text-[12px] md:text-[13px] text-clay">
            ← L'application
          </button>
        </div>
        <div className="max-w-[900px] mx-auto px-5 md:px-8 pb-2 flex gap-1.5">
          {tab('/admin/portail-8x4k', 'Tableau de bord', true)}
          {tab('/admin/portail-8x4k/chansons', 'Chansons')}
          {tab('/admin/portail-8x4k/utilisateurs', 'Utilisateurs')}
          {tab('/admin/portail-8x4k/avis', 'Avis')}
          {tab('/admin/portail-8x4k/technique', 'Technique')}
          {tab('/admin/portail-8x4k/reglages', 'Réglages')}
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-5 md:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
