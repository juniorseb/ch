import { Outlet } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import Logo from '../components/Logo'
import ActiveGenerationBanner from '../components/ActiveGenerationBanner'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="max-w-[420px] md:max-w-[640px] mx-auto w-full flex-1 flex flex-col px-5 md:px-10 pt-6 md:pt-10">
        {/* Logo visible sur toute la partie connectée (accueil, chansons, profil). */}
        <div className="mb-5">
          <Logo to="/app" size="sm" />
        </div>
        {/* Suivi de la chanson en cours de composition (arrière-plan). */}
        <ActiveGenerationBanner />
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
