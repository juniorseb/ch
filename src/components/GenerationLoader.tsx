import { useEffect, useState } from 'react'
import Shell from './Shell'

// Écran de chargement animé (spinner orange + note de musique) avec des
// phrases qui défilent, pour matérialiser un processus en cours (écriture des
// paroles, composition de la musique).
//
// `estimatedMs` (optionnel) : durée estimée du process -> affiche une barre de
// progression qui monte régulièrement et se cale ~95 % en attendant la fin
// réelle (rassure le client sans mentir sur l'achèvement).
export default function GenerationLoader({
  title,
  phrases,
  estimatedMs,
}: {
  title: string
  phrases: string[]
  estimatedMs?: number
}) {
  const [i, setI] = useState(0)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    if (phrases.length <= 1) return
    const id = setInterval(() => setI((n) => (n + 1) % phrases.length), 2400)
    return () => clearInterval(id)
  }, [phrases.length])

  useEffect(() => {
    if (!estimatedMs) return
    const start = Date.now()
    const id = setInterval(() => {
      const t = (Date.now() - start) / estimatedMs
      // Montée rapide au début puis ralentit, plafonnée à 95 %.
      const p = Math.min(95, Math.round(95 * (1 - Math.exp(-2.2 * t))))
      setPct(p)
    }, 400)
    return () => clearInterval(id)
  }, [estimatedMs])

  return (
    <Shell logo>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="relative w-20 h-20 mb-7">
          {/* Anneau qui tourne */}
          <svg className="w-20 h-20 animate-spin" viewBox="0 0 50 50" fill="none" style={{ animationDuration: '1.1s' }}>
            <circle cx="25" cy="25" r="20" stroke="var(--color-line)" strokeWidth="4" />
            <path d="M25 5a20 20 0 0 1 20 20" stroke="var(--color-ember-600)" strokeWidth="4" strokeLinecap="round" />
          </svg>
          {/* Note de musique qui pulse au centre */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--color-ember-600)" className="animate-pulse">
              <path d="M9 18V5l10-2v13" stroke="var(--color-ember-600)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="16" cy="16" r="3" />
            </svg>
          </div>
        </div>

        <h1 className="text-[20px] md:text-[23px] mb-2">{title}</h1>
        <p key={i} className="text-[14px] md:text-[16px] text-ink-soft animate-fadein min-h-[1.5em]">
          {phrases[i]}
        </p>

        {estimatedMs ? (
          /* Barre de progression estimée (durée longue : composition musicale) */
          <div className="w-full max-w-[280px] mt-6">
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-ember-600 transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[12px] md:text-[13px] text-clay mt-2">{pct}%</div>
          </div>
        ) : (
          /* Points de progression sous les phrases (process court) */
          <div className="flex gap-1.5 mt-5">
            {phrases.map((_, n) => (
              <span
                key={n}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  n === i ? 'w-5 bg-ember-600' : 'w-1.5 bg-white/15'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
