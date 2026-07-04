import type { ReactNode } from 'react'
import Logo from './Logo'

interface ShellProps {
  children: ReactNode
  footer?: ReactNode
  // Affiche le logo Mamélodie en haut (image de marque sur le tunnel de
  // création). Cliquable : → dashboard si connecté, sinon landing (le brouillon
  // est conservé en localStorage, donc rien n'est perdu).
  logo?: boolean
  // Repère de contexte affiché à droite du logo (ex. « Créer une chanson »),
  // pour situer l'utilisateur dans le parcours. Passer '' pour le masquer.
  flowLabel?: string
}

// Le contenu défile normalement avec la page ; le footer (en général le
// bouton d'action principal) reste épinglé en bas du viewport via
// `sticky bottom-0`, donc toujours visible sans avoir à scroller. La
// largeur et le padding s'élargissent progressivement à partir de `md`
// pour que l'app se sente conçue pour le desktop plutôt que comme une
// version mobile étirée au milieu d'un grand écran.
export default function Shell({ children, footer, logo = false, flowLabel = 'Créer une chanson' }: ShellProps) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div
        className={`max-w-[420px] md:max-w-[640px] mx-auto w-full flex-1 flex flex-col px-5 md:px-10 pt-8 md:pt-16 ${footer ? 'pb-4' : 'pb-10 md:pb-16'}`}
      >
        {logo && (
          <div className="flex items-center justify-between gap-3 mb-6">
            <Logo to="/" size="sm" />
            {flowLabel && (
              <span className="text-[12px] md:text-[13px] font-medium text-clay">
                {flowLabel}
              </span>
            )}
          </div>
        )}
        {children}
      </div>
      {footer && (
        <div className="sticky bottom-0 bg-bg/95 backdrop-blur border-t border-line">
          <div
            className="max-w-[420px] md:max-w-[640px] mx-auto px-5 md:px-10 pt-3 md:pt-4"
            style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        </div>
      )}
    </div>
  )
}
