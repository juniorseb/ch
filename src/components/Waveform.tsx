interface WaveformProps {
  className?: string
  animated?: boolean
  bars?: number
  color?: string
}

// The recurring signature element: a hand-tuned waveform, never a generic
// audio-bar icon. Heights are fixed (not random) so it reads the same way
// every time it appears -- under the hero headline, and idle behind the
// player on the "song ready" screen.
const HEIGHTS = [6, 14, 9, 22, 13, 28, 16, 34, 19, 30, 14, 24, 10, 18, 7, 13, 9, 20, 12, 6]

export default function Waveform({ className = '', animated = false, bars = 20, color = 'var(--color-ember-600)' }: WaveformProps) {
  const heights = HEIGHTS.slice(0, bars)
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden="true">
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: h,
            background: color,
            borderRadius: 2,
            opacity: 0.35 + (h / 34) * 0.65,
            animation: animated ? `wave 1.2s ease-in-out ${i * 0.05}s infinite` : undefined,
          }}
        />
      ))}
      {animated && (
        <style>{`
          @keyframes wave {
            0%, 100% { transform: scaleY(0.6); }
            50% { transform: scaleY(1); }
          }
          @media (prefers-reduced-motion: reduce) {
            div[style*="animation"] { animation: none !important; }
          }
        `}</style>
      )}
    </div>
  )
}
