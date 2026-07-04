interface BarChartProps {
  data: { label: string; value: number }[]
  format?: (n: number) => string
}

// Petit graphique à barres en CSS pur (pas de librairie externe). Les labels
// s'éclaircissent automatiquement quand il y a beaucoup de barres.
export default function BarChart({ data, format }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const labelEvery = data.length > 12 ? Math.ceil(data.length / 8) : 1

  return (
    <div className="flex items-end gap-1 h-44">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full">
          <div className="flex-1 w-full flex items-end">
            <div
              className="w-full bg-ember-600 rounded-t transition-all hover:bg-ember-700"
              style={{ height: `${max ? (d.value / max) * 100 : 0}%`, minHeight: d.value > 0 ? 3 : 0 }}
              title={`${d.label} : ${format ? format(d.value) : d.value}`}
            />
          </div>
          <span className="text-[9px] md:text-[10px] text-clay truncate w-full text-center h-3">
            {i % labelEvery === 0 ? d.label : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
