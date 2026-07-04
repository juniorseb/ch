import { useRef } from 'react'

interface OtpInputProps {
  value: string[]
  onChange: (value: string[]) => void
}

export default function OtpInput({ value, onChange }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function updateDigit(i: number, digit: string) {
    if (!/^\d?$/.test(digit)) return
    const next = [...value]
    next[i] = digit
    onChange(next)
    if (digit && i < value.length - 1) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus()
  }

  return (
    <div className="flex justify-center gap-2.5">
      {value.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          value={d}
          onChange={(e) => updateDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          maxLength={1}
          inputMode="numeric"
          className="w-[48px] h-[52px] text-center text-[20px] md:text-[23px] rounded-lg border border-line bg-surface focus:border-ember-600 outline-none"
        />
      ))}
    </div>
  )
}
