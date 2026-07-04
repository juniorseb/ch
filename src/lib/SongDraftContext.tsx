import { createContext, useContext, useState, type ReactNode } from 'react'
import type { SongDraft } from './types'

const emptyDraft: SongDraft = {
  occasion: null,
  lyricsMode: 'guided',
  recipientName: '',
  senderName: '',
  relation: '',
  marriageType: '',
  meetContext: '',
  story: '',
  ownLyrics: '',
  lyrics: '',
  lyricsSignature: '',
  lyricsRegenCount: 0,
  songTitle: '',
  style: '',
  customStyle: '',
  voice: '',
  ambiance: '',
  language: 'francais',
  customLanguage: '',
}

// Le brouillon est persisté en localStorage : le parcours de création survit
// à un rechargement de page ET au retour d'une connexion Google (OAuth), qui
// recharge complètement l'app.
const DRAFT_KEY = 'mamelodie:draft'

function loadDraft(): SongDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return { ...emptyDraft, ...(JSON.parse(raw) as Partial<SongDraft>) }
  } catch {
    /* ignore */
  }
  return emptyDraft
}

function persist(draft: SongDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

interface SongDraftContextValue {
  draft: SongDraft
  setDraft: (patch: Partial<SongDraft>) => void
  resetDraft: () => void
  songGenerationId: string | null
  setSongGenerationId: (id: string | null) => void
}

const SongDraftContext = createContext<SongDraftContextValue | null>(null)

export function SongDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<SongDraft>(loadDraft)
  const [songGenerationId, setSongGenerationId] = useState<string | null>(null)

  function setDraft(patch: Partial<SongDraft>) {
    setDraftState((prev) => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }

  function resetDraft() {
    setDraftState(emptyDraft)
    setSongGenerationId(null)
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* ignore */
    }
  }

  return (
    <SongDraftContext.Provider
      value={{ draft, setDraft, resetDraft, songGenerationId, setSongGenerationId }}
    >
      {children}
    </SongDraftContext.Provider>
  )
}

export function useSongDraft() {
  const ctx = useContext(SongDraftContext)
  if (!ctx) throw new Error('useSongDraft must be used within SongDraftProvider')
  return ctx
}
