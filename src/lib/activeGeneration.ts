// Génération musicale « en cours » suivie en arrière-plan : on la mémorise en
// localStorage pour que la bannière du dashboard puisse la suivre même après
// navigation ou rechargement (la génération, elle, tourne côté serveur).
export interface ActiveGeneration {
  id: string
  title: string
  startedAt: number
}

const KEY = 'mamelodie:activeGeneration'

export function setActiveGeneration(g: ActiveGeneration): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(g))
  } catch {
    /* ignore */
  }
}

export function getActiveGeneration(): ActiveGeneration | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ActiveGeneration) : null
  } catch {
    return null
  }
}

export function clearActiveGeneration(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
