import { NavLink, useNavigate } from 'react-router-dom'

const tabIcon = {
  home: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  songs: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 18V5l11-2v13" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  ),
  profile: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
}

export default function BottomNav() {
  const navigate = useNavigate()
  return (
    <nav className="sticky bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-line">
      <div className="max-w-[420px] md:max-w-[640px] mx-auto flex items-center justify-around py-2.5 md:py-3.5">
        <NavLink
          to="/app"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? 'text-ember-600' : 'text-clay'}`
          }
        >
          {tabIcon.home}
          <span className="text-[11px] md:text-[12px] font-medium">Accueil</span>
        </NavLink>

        <button
          onClick={() => navigate('/occasion')}
          className="flex flex-col items-center -mt-6"
          aria-label="Créer une chanson"
        >
          <span className="fab-button">
            {tabIcon.plus}
          </span>
        </button>

        <NavLink
          to="/app/profil"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? 'text-ember-600' : 'text-clay'}`
          }
        >
          {tabIcon.profile}
          <span className="text-[11px] md:text-[12px] font-medium">Profil</span>
        </NavLink>
      </div>
    </nav>
  )
}
