// Icônes colorées des chips "Pour qui ?" de la landing. En SVG (couleurs
// intrinsèques) plutôt qu'en emoji, pour un rendu identique sur tous les OS.
type Name = 'cake' | 'woman' | 'heart' | 'peace' | 'rings' | 'friends' | 'sparkles'

const icons: Record<Name, React.ReactNode> = {
  // Gâteau d'anniversaire (assiette, génoise rose, glaçage, bougie allumée)
  cake: (
    <>
      <path d="M4 12.5h16V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" fill="#F9A8D4" />
      <path d="M4 12.8c1.1.9 2.2.9 3.3 0s2.2-.9 3.4 0 2.2.9 3.3 0 2.2-.9 3.4 0 .8.6.6.9c-.5-.4-1.4-.4-2 .1-1.2.9-2.3.9-3.4 0s-2.2-.9-3.3 0-2.2.9-3.4 0-2.2-.9-3.3 0c-.6-.5-.9-.6-.9-.9s.2-.3.3-.1z" fill="#FBCFE8" />
      <rect x="11.25" y="6.6" width="1.5" height="4.4" rx="0.75" fill="#FDE68A" />
      <path d="M12 3.2c1 .9 1.3 1.8.5 2.6-.6.6-1.6.3-1.8-.5-.2-.7.3-1.4 1.3-2.1z" fill="#F97316" />
      <rect x="3.2" y="19.4" width="17.6" height="1.8" rx="0.9" fill="#E7A24C" />
    </>
  ),
  // Silhouette de dame (Maman) : cheveux, visage, robe
  woman: (
    <>
      <path d="M8.9 6.2C8.9 4 10.3 2.4 12 2.4s3.1 1.6 3.1 3.8c0 1-.3 1.9-.9 2.6-.4-1.4-1.2-2.2-2.2-2.2s-1.8.8-2.2 2.2c-.6-.7-.9-1.6-.9-2.6z" fill="#4B3A34" />
      <circle cx="12" cy="6.6" r="2.7" fill="#F3C79B" />
      <path d="M12 8.6c-2.5 0-4.2 1.8-4.8 4.6L6 20.4a1 1 0 0 0 1 1.2h10a1 1 0 0 0 1-1.2l-1.2-7.2c-.6-2.8-2.3-4.6-4.8-4.6z" fill="#D64C93" />
      <path d="M12 8.6c-1 0-1.9.3-2.6.8L12 14l2.6-4.6c-.7-.5-1.6-.8-2.6-.8z" fill="#E86FAC" />
    </>
  ),
  // Cœur rouge (Amour)
  heart: (
    <path
      d="M12 20.7l-1.5-1.4C5.4 14.7 2 11.6 2 7.9 2 5.1 4.2 3 6.9 3c1.6 0 3.1.7 4.1 2 1-1.3 2.5-2 4.1-2C17.8 3 20 5.1 20 7.9c0 3.7-3.4 6.8-8.5 11.4L12 20.7z"
      fill="#EF4444"
    />
  ),
  // Mains jointes (Pardon / prière)
  peace: (
    <>
      <path d="M12 3.1c-.5 0-.9.4-1.1 1L8.1 13c-.3 1-.9 1.6-1.8 2-.9.4-1.5 1.1-1.5 2.1v1.4A1.5 1.5 0 0 0 6.3 21H12z" fill="#F3C79B" />
      <path d="M12 3.1c.5 0 .9.4 1.1 1L15.9 13c.3 1 .9 1.6 1.8 2 .9.4 1.5 1.1 1.5 2.1v1.4A1.5 1.5 0 0 1 17.7 21H12z" fill="#E3AC78" />
      <path d="M9.9 15.3c.7-.3 1.5-.2 2.1.3-.6.5-1.4.6-2.1.3z" fill="#E3AC78" />
      <path d="M14.1 15.3c-.7-.3-1.5-.2-2.1.3.6.5 1.4.6 2.1.3z" fill="#D69A63" />
    </>
  ),
  // Deux alliances + diamant (Mariage)
  rings: (
    <>
      <circle cx="9" cy="14.5" r="4.2" fill="none" stroke="#F59E0B" strokeWidth="2" />
      <circle cx="15" cy="13" r="4.2" fill="none" stroke="#FBBF24" strokeWidth="2" />
      <path d="M15 3l2.1 2.3L15 8.1 12.9 5.3z" fill="#7DD3FC" />
      <path d="M15 3l2.1 2.3H12.9z" fill="#BAE6FD" />
    </>
  ),
  // Deux personnes (Ami·e)
  friends: (
    <>
      <circle cx="8.4" cy="8" r="3.1" fill="#60A5FA" />
      <path d="M3.4 20v-.6a5 5 0 0 1 10 0V20a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1z" fill="#60A5FA" />
      <circle cx="15.6" cy="8" r="3.1" fill="#F472B6" />
      <path d="M10.6 20v-.6a5 5 0 0 1 10 0V20a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1z" fill="#F472B6" />
    </>
  ),
  // Étincelles dorées (Autre)
  sparkles: (
    <>
      <path d="M12 3l1.7 5.1c.2.5.5.8 1 1L20 11l-5.3 1.9c-.5.2-.8.5-1 1L12 19l-1.7-5.1c-.2-.5-.5-.8-1-1L4 11l5.3-1.9c.5-.2.8-.5 1-1z" fill="#FBBF24" />
      <path d="M18.7 3.6l.6 1.9c.1.2.2.3.4.4l1.9.6-1.9.7c-.2.1-.3.2-.4.4l-.6 1.9-.7-1.9c-.1-.2-.2-.3-.4-.4l-1.9-.7 1.9-.6c.2-.1.3-.2.4-.4z" fill="#FCD34D" />
    </>
  ),
}

export default function AudienceIcon({ name, className = '' }: { name: Name; className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {icons[name]}
    </svg>
  )
}

export type { Name as AudienceIconName }
