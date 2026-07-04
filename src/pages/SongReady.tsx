import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Shell from '../components/Shell'
import Logo from '../components/Logo'
import Button from '../components/Button'
import AudioPlayer from '../components/AudioPlayer'
import { useSongDraft } from '../lib/SongDraftContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { addDemoSong } from '../lib/songsStore'
import { styleLabel, ambianceLabel, type SongGeneration } from '../lib/types'

export default function SongReady() {
  const navigate = useNavigate()
  const { draft, songGenerationId, resetDraft } = useSongDraft()

  const versions = [
    sessionStorage.getItem('mamelodie:lastAudioUrl') || '',
    sessionStorage.getItem('mamelodie:lastAudioUrl2') || '',
  ].filter(Boolean)

  const title = draft.songTitle?.trim() || `Pour ${draft.recipientName || 'toi'}`
  const subtitle = [styleLabel(draft.customStyle || draft.style), draft.ambiance && ambianceLabel(draft.ambiance)]
    .filter(Boolean)
    .join(' · ')

  // En démo, on enregistre la chanson terminée dans la bibliothèque locale
  // pour qu'elle apparaisse dans "Mes chansons" et reste jouable. En mode
  // réel, elle est déjà persistée en base par le pipeline de génération.
  useEffect(() => {
    if (isSupabaseConfigured || !songGenerationId || !draft.occasion) return
    const song: SongGeneration = {
      id: songGenerationId,
      phone: '',
      occasion: draft.occasion,
      recipientName: draft.recipientName,
      style: draft.customStyle || draft.style,
      status: 'completed',
      title,
      audioUrl: versions[0],
      audioUrl2: versions[1],
      createdAt: new Date().toISOString().slice(0, 10),
    }
    addDemoSong(song)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songGenerationId])

  function startAnother() {
    resetDraft()
    navigate('/occasion')
  }

  return (
    <Shell
      footer={
        <>
          <Button className="w-full" onClick={() => navigate('/app/chansons')}>
            Voir mes chansons
          </Button>
          <button
            onClick={startAnother}
            className="w-full text-[13px] md:text-[15px] text-ember-700 mt-2.5"
          >
            Créer une autre chanson
          </button>
        </>
      }
    >
      <div className="mb-8">
        <Logo to="/app" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <span className="text-[12px] md:text-[13px] font-semibold text-ember-700 bg-ember-50 px-3 py-1 rounded-full mb-5">
          Chanson prête
        </span>
        <h1 className="text-[24px] md:text-[28px] mb-1">{title}</h1>
        <p className="text-[13px] md:text-[15px] text-clay mb-6">{subtitle}</p>

        <AudioPlayer title={title} versions={versions} songId={songGenerationId ?? undefined} />
      </div>
    </Shell>
  )
}
