// Partage d'une chanson. Utilise l'API native de partage du navigateur
// (feuille de partage mobile) quand elle est dispo, sinon copie le lien dans
// le presse-papiers. Renvoie ce qui s'est réellement passé pour que l'UI
// puisse afficher un retour ("Lien copié").
export type ShareResult = 'shared' | 'copied' | 'unavailable'

export async function shareSong(title: string, url: string): Promise<ShareResult> {
  if (!url) return 'unavailable'
  const data = {
    title: `Mamélodie — ${title}`,
    text: `Écoute cette chanson personnalisée : ${title}`,
    url,
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(data)
      return 'shared'
    } catch {
      // L'utilisateur a annulé la feuille de partage : on ne force pas la copie.
      return 'shared'
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url)
      return 'copied'
    } catch {
      return 'unavailable'
    }
  }
  return 'unavailable'
}
