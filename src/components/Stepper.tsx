interface StepperProps {
  steps: string[]
  current: number // index de l'étape en cours (0-based)
}

// Fil d'Ariane visuel du parcours de création : montre où on en est pour que
// le client se sente guidé et jamais perdu.
export default function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="flex items-center gap-1.5 mb-6" aria-label={`Étape ${current + 1} sur ${steps.length}`}>
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={`h-1.5 w-full rounded-full transition-colors ${
                done || active ? 'bg-ember-600' : 'bg-line'
              }`}
            />
            <span
              className={`text-[10px] md:text-[12px] font-medium ${
                active ? 'text-ember-700' : done ? 'text-ink-soft' : 'text-clay'
              }`}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
