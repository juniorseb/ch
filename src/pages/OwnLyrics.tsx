import { useNavigate } from 'react-router-dom'
import Shell from '../components/Shell'
import Button from '../components/Button'
import Stepper from '../components/Stepper'
import BackButton from '../components/BackButton'
import { useSongDraft } from '../lib/SongDraftContext'

export default function OwnLyrics() {
  const navigate = useNavigate()
  const { draft, setDraft } = useSongDraft()

  const wordCount = draft.ownLyrics.trim() ? draft.ownLyrics.trim().split(/\s+/).length : 0
  const canContinue = draft.ownLyrics.trim().length > 0

  return (
    <Shell
      logo
      footer={
        <Button className="w-full" disabled={!canContinue} onClick={() => navigate('/creer/style')}>
          Continuer
        </Button>
      }
    >
      <BackButton onClick={() => navigate(-1)} className="mb-4" />

      <Stepper steps={['Occasion', 'Tes paroles', 'Style', 'Musique']} current={1} />

      <h1 className="text-[22px] md:text-[26px] mb-1">Colle tes paroles</h1>
      <p className="text-[13px] md:text-[15px] text-ink-soft mb-5">
        On s'occupe de la musique. Tu pourras encore les ajuster juste après.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[13px] md:text-[15px] text-ink-soft block mb-1.5">
            Titre de la chanson <span className="text-clay">· facultatif</span>
          </label>
          <input
            value={draft.songTitle}
            onChange={(e) => setDraft({ songTitle: e.target.value })}
            placeholder="Ex : Ma déclaration"
            className="w-full h-11 md:h-12 rounded-lg border border-line px-3 md:px-4 text-[14px] md:text-[16px] bg-surface focus:border-ember-600 outline-none"
          />
        </div>

        <div>
          <label className="text-[13px] md:text-[15px] text-ink-soft block mb-1.5">Tes paroles</label>
          <textarea
            rows={12}
            value={draft.ownLyrics}
            onChange={(e) => setDraft({ ownLyrics: e.target.value })}
            placeholder={'Ex :\n[Couplet]\n…\n[Refrain]\n…'}
            className="w-full rounded-xl border border-line p-4 text-[14px] md:text-[16px] leading-relaxed bg-surface resize-none focus:border-ember-600 outline-none"
          />
          <div className="text-[11px] md:text-[12px] text-clay text-right mt-1">{wordCount} mots</div>
        </div>
      </div>
    </Shell>
  )
}
