import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { SongDraftProvider } from './lib/SongDraftContext'
import RequireAuth from './components/RequireAuth'
import RouteTracker from './components/RouteTracker'

import Landing from './pages/Landing'
import Signup from './pages/Signup'
import VerifyEmail from './pages/VerifyEmail'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import ForgotPassword from './pages/ForgotPassword'
import Occasion from './pages/Occasion'
import SongFormPage from './pages/SongFormPage'
import OwnLyrics from './pages/OwnLyrics'
import StyleStep from './pages/StyleStep'
import ImproveChoice from './pages/ImproveChoice'
import AccountStep from './pages/AccountStep'
import Payment from './pages/Payment'
import LyricsEdit from './pages/LyricsEdit'
import GenerationStart from './pages/GenerationStart'
import Generating from './pages/Generating'
import PaymentReturn from './pages/PaymentReturn'
import SongReady from './pages/SongReady'
import AppLayout from './pages/AppLayout'
import Dashboard from './pages/Dashboard'
import MySongs from './pages/MySongs'
import SongDetail from './pages/SongDetail'
import Profile from './pages/Profile'
import ChangePassword from './pages/ChangePassword'
import PaymentHistory from './pages/PaymentHistory'
import Feedback from './pages/Feedback'
import AdminLayout from './pages/admin/AdminLayout'
import AdminHome from './pages/admin/AdminHome'
import AdminSongs from './pages/admin/AdminSongs'
import AdminUsers from './pages/admin/AdminUsers'
import AdminSettings from './pages/admin/AdminSettings'
import AdminFeedback from './pages/admin/AdminFeedback'
import AdminTech from './pages/admin/AdminTech'

export default function App() {
  return (
    <SongDraftProvider>
      <BrowserRouter>
        <RouteTracker />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/inscription" element={<Signup />} />
          <Route path="/verification" element={<VerifyEmail />} />
          <Route path="/connexion" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />

          {/* Parcours de création : PUBLIC (sans compte) jusqu'aux paroles.
              Le compte + paiement n'apparaissent qu'au clic "Générer la musique". */}
          <Route path="/occasion" element={<Occasion />} />
          <Route path="/creer/details" element={<SongFormPage />} />
          <Route path="/creer/paroles-perso" element={<OwnLyrics />} />
          <Route path="/creer/style" element={<StyleStep />} />
          <Route path="/creer/ameliorer" element={<ImproveChoice />} />
          <Route path="/creer/paroles" element={<LyricsEdit />} />
          <Route path="/creer/compte" element={<AccountStep />} />

          <Route element={<RequireAuth />}>
            <Route path="/creer/paiement" element={<Payment />} />
            <Route path="/creer/retour" element={<PaymentReturn />} />
            <Route path="/creer/lancement" element={<GenerationStart />} />
            <Route path="/creer/generation" element={<Generating />} />
            <Route path="/creer/pret" element={<SongReady />} />

            <Route path="/admin/portail-8x4k" element={<AdminLayout />}>
              <Route index element={<AdminHome />} />
              <Route path="chansons" element={<AdminSongs />} />
              <Route path="utilisateurs" element={<AdminUsers />} />
              <Route path="avis" element={<AdminFeedback />} />
              <Route path="technique" element={<AdminTech />} />
              <Route path="reglages" element={<AdminSettings />} />
            </Route>

            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="chansons" element={<MySongs />} />
              <Route path="chansons/:id" element={<SongDetail />} />
              <Route path="profil" element={<Profile />} />
              <Route path="profil/mot-de-passe" element={<ChangePassword />} />
              <Route path="profil/paiements" element={<PaymentHistory />} />
              <Route path="avis" element={<Feedback />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </SongDraftProvider>
  )
}
