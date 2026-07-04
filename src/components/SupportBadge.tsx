// Lien vers le support WhatsApp, affiché au centre des pages Connexion et
// Inscription pour qu'un utilisateur bloqué (email, mot de passe…) puisse nous
// joindre directement, sans avoir de compte. Même numéro que dans le Profil.
export default function SupportBadge() {
  return (
    <a
      href="https://wa.me/2250102761670?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide..."
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-1 py-1 text-[13px] md:text-[15px] text-ink-soft hover:text-ink transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-leaf-600)" strokeWidth="1.8">
        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 20l1.4-4.2A8.38 8.38 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Une question ? Contacte le support</span>
    </a>
  )
}
