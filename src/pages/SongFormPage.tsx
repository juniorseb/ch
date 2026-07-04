import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import Shell from '../components/Shell'
import Button from '../components/Button'
import Stepper from '../components/Stepper'
import BackButton from '../components/BackButton'
import { useSongDraft } from '../lib/SongDraftContext'
import { OCCASIONS, MARRIAGE_TYPES } from '../lib/types'

const MAX_STORY = 400

const TITLES: Record<string, string> = {
  anniversaire: 'Parle-nous de la personne fêtée',
  amour: 'Parle-nous de ton amour',
  mariage: 'Parle-nous des mariés',
  autre: 'Décris ta chanson',
}

// Placeholders courts (3-6 mots), toujours préfixés « Ex : ».
const STORY_PLACEHOLDERS: Record<string, string> = {
  anniversaire: 'Ex : elle adore rire et le riz gras 😊',
  amour: 'Ex : notre rencontre à Cocody ❤️',
  mariage: 'Ex : tous nos vœux de bonheur',
  autre: 'Ex : hommage, motivation, merci…',
}

// Choix rapides du lien (chips) : 1 tap, pas de dropdown. On garde les cas les
// plus fréquents ; « Famille » couvre sœur/frère/enfant/cousin/tante/oncle (le
// prénom + le petit mot texte affinent déjà le ton). « Autre » ouvre un champ
// libre pour les cas hors liste.
const PRESET_RELATIONS = ['Maman', 'Papa', 'Conjoint(e)', 'Ami(e)', 'Famille']

// Champ texte. `optional` = allègement visuel (label plus petit/discret, bordure
// plus fine) pour signaler d'un coup d'œil que le champ est secondaire.
function LabelInput(props: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  optional?: boolean
}) {
  return (
    <div>
      <label className="text-[13px] md:text-[15px] text-ink-soft block mb-1.5">
        {props.label}
        {props.optional && <span className="text-clay/70"> · facultatif</span>}
      </label>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={`w-full h-11 md:h-12 rounded-lg px-3 md:px-4 text-[14px] md:text-[16px] bg-surface outline-none focus:border-ember-600 ${
          props.optional ? 'border border-line/50' : 'border border-line'
        }`}
      />
    </div>
  )
}

export default function SongFormPage() {
  const navigate = useNavigate()
  const { draft, setDraft } = useSongDraft()

  // « Autre » ouvert si un lien personnalisé (hors presets) est déjà saisi.
  const [otherOpen, setOtherOpen] = useState(
    () => draft.relation.trim().length > 0 && !PRESET_RELATIONS.includes(draft.relation)
  )

  function pickRelation(r: string) {
    setOtherOpen(false)
    setDraft({ relation: draft.relation === r ? '' : r })
  }

  function toggleOther() {
    if (otherOpen) {
      setOtherOpen(false)
      setDraft({ relation: '' })
    } else {
      setOtherOpen(true)
      // On repart d'un champ vide si un preset était sélectionné.
      if (PRESET_RELATIONS.includes(draft.relation)) setDraft({ relation: '' })
    }
  }

  const occasion = draft.occasion ?? 'autre'
  const occasionLabel = OCCASIONS.find((o) => o.id === occasion)?.label ?? ''

  const nameLabel =
    occasion === 'mariage'
      ? 'Les prénoms des mariés'
      : occasion === 'amour'
        ? "Prénom ou petit nom de l'être aimé"
        : occasion === 'anniversaire'
          ? 'Prénom ou petit nom de la personne fêtée'
          : 'Pour qui (prénom, petit nom, groupe…)'

  const storyLabel =
    occasion === 'amour'
      ? 'Ce que tu veux lui dire du fond du cœur'
      : occasion === 'mariage'
        ? 'Un mot, un vœu pour les mariés'
        : occasion === 'anniversaire'
          ? 'Un petit mot, une qualité, un souvenir'
          : "Décris l'occasion et ton message"

  const needsMarriageType = occasion === 'mariage'
  const canContinue =
    draft.recipientName.trim().length > 0 &&
    draft.story.trim().length > 0 &&
    (!needsMarriageType || draft.marriageType.length > 0)

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

      <Stepper steps={['Occasion', 'Détails', 'Style', 'Paroles']} current={1} />

      <div className="mb-6">
        <div className="text-[13px] md:text-[15px] text-clay mb-1">{occasionLabel}</div>
        <h1 className="text-[22px] md:text-[26px]">{TITLES[occasion]}</h1>
      </div>

      <div className="flex flex-col gap-4">
        <LabelInput
          label={nameLabel}
          value={draft.recipientName}
          onChange={(v) => setDraft({ recipientName: v })}
          placeholder={
            occasion === 'mariage'
              ? 'Ex : Jean & Aïcha'
              : occasion === 'amour'
                ? 'Ex : Aïcha, ma biche, mon cœur'
                : 'Ex : Aïcha, Maman, tonton'
          }
        />

        {occasion === 'mariage' && (
          <div>
            <label className="text-[13px] md:text-[15px] text-ink-soft block mb-1.5">Type de mariage</label>
            <div className="grid grid-cols-1 gap-2">
              {MARRIAGE_TYPES.map((m) => {
                const active = draft.marriageType === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => setDraft({ marriageType: m.id })}
                    className={`rounded-lg px-4 py-3 text-left transition-colors ${
                      active ? 'bg-ember-50 border border-ember-600' : 'bg-surface border border-line'
                    }`}
                  >
                    <span className="block text-[14px] md:text-[16px] font-semibold text-ink">{m.label}</span>
                    <span className="block text-[12px] md:text-[13px] text-clay">{m.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {(occasion === 'anniversaire' || occasion === 'autre') && (
          <div>
            {/* Champ facultatif : label même police que l'obligatoire, la
                distinction se fait par la mention « facultatif » + chips légères. */}
            <label className="text-[13px] md:text-[15px] text-ink-soft block mb-2">
              Ton lien avec {occasion === 'autre' ? 'elle/eux' : 'la personne'}
              <span className="text-clay/70"> · facultatif</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_RELATIONS.map((r) => {
                const active = !otherOpen && draft.relation === r
                return (
                  <button
                    key={r}
                    onClick={() => pickRelation(r)}
                    className={`rounded-full px-3.5 py-2 text-[13px] md:text-[14px] font-medium transition-colors ${
                      active
                        ? 'bg-ember-600 text-cream border border-ember-600'
                        : 'bg-surface border border-line/60 text-ink-soft hover:border-ember-400'
                    }`}
                  >
                    {r}
                  </button>
                )
              })}
              <button
                onClick={toggleOther}
                className={`rounded-full px-3.5 py-2 text-[13px] md:text-[14px] font-medium transition-colors ${
                  otherOpen
                    ? 'bg-ember-600 text-cream border border-ember-600'
                    : 'bg-surface border border-line/60 text-ink-soft hover:border-ember-400'
                }`}
              >
                Autre
              </button>
            </div>

            {/* « Autre » : champ libre inline pour les cas hors liste. */}
            {otherOpen && (
              <input
                autoFocus
                value={draft.relation}
                onChange={(e) => setDraft({ relation: e.target.value })}
                placeholder="Ex : sœur, cousin, enfant"
                className="mt-2 w-full h-11 md:h-12 rounded-lg border border-line/50 px-3 md:px-4 text-[14px] md:text-[16px] bg-surface outline-none focus:border-ember-600"
              />
            )}
          </div>
        )}

        {occasion === 'amour' && (
          <LabelInput
            label="Depuis quand / où vous êtes-vous rencontrés ?"
            value={draft.meetContext}
            onChange={(v) => setDraft({ meetContext: v })}
            placeholder="Ex : depuis 2021, à Cocody"
            optional
          />
        )}

        {occasion !== 'mariage' && (
          <LabelInput
            label="Ton prénom (qui offre la chanson)"
            value={draft.senderName}
            onChange={(v) => setDraft({ senderName: v })}
            placeholder="Ex : Jean"
            optional
          />
        )}

        <div>
          <label className="text-[13px] md:text-[15px] text-ink-soft block mb-1.5">{storyLabel}</label>
          <textarea
            rows={4}
            maxLength={MAX_STORY}
            value={draft.story}
            onChange={(e) => setDraft({ story: e.target.value })}
            placeholder={STORY_PLACEHOLDERS[occasion]}
            className="w-full rounded-lg border border-line p-3 text-[14px] md:text-[16px] bg-surface resize-none outline-none focus:border-ember-600"
          />
          <div className="text-[11px] md:text-[12px] text-clay text-right mt-1">
            {draft.story.length} / {MAX_STORY}
          </div>
        </div>
      </div>
    </Shell>
  )
}
