import { useMemo } from 'react'

type Point = { label: string; value: number }

const ACCENT = 'var(--color-accent)'
const GRID = 'var(--color-line)'
const MUTED = 'var(--color-faint)'

export function BarChart({ data, height = 160, format }: { data: Point[]; height?: number; format?: (value: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  if (!data.length) return <div className="py-8 text-center text-xs text-muted">No data in this period</div>
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((point) => (
        <div key={point.label} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] font-medium text-muted opacity-0 transition group-hover:opacity-100">
            {format ? format(point.value) : point.value}
          </span>
          <div
            className="w-full rounded-t-[4px] transition-all"
            style={{
              height: `${Math.max(3, (point.value / max) * 100)}%`,
              background: `linear-gradient(180deg, ${ACCENT}, color-mix(in srgb, ${ACCENT} 55%, transparent))`,
            }}
            title={`${point.label}: ${format ? format(point.value) : point.value}`}
          />
          <span className="truncate text-[10px] text-faint">{point.label}</span>
        </div>
      ))}
    </div>
  )
}

export function LineChart({
  data,
  height = 160,
  format,
  fill = true,
}: {
  data: Point[]
  height?: number
  format?: (value: number) => string
  fill?: boolean
}) {
  const { path, area, max, min } = useMemo(() => {
    const values = data.map((d) => d.value)
    const maxValue = Math.max(1, ...values)
    const minValue = 0
    const width = 100
    const points = data.map((point, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width
      const y = 100 - ((point.value - minValue) / Math.max(1, maxValue - minValue)) * 92 - 4
      return { x, y }
    })
    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    const areaPath = points.length ? `${line} L100,100 L0,100 Z` : ''
    return { path: line, area: areaPath, max: maxValue, min: minValue }
  }, [data])

  if (!data.length) return <div className="py-8 text-center text-xs text-muted">No data in this period</div>
  return (
    <div style={{ height }} className="w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Trend chart">
        {[25, 50, 75].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke={GRID} strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        ))}
        {fill ? <path d={area} fill={`color-mix(in srgb, ${ACCENT} 12%, transparent)`} /> : null}
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-faint">
        <span>
          {data[0].label} · {format ? format(data[0].value) : data[0].value}
        </span>
        <span>
          max {format ? format(max) : max} / min {format ? format(min) : min}
        </span>
      </div>
    </div>
  )
}

export function Donut({
  data,
  size = 150,
  thickness = 16,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color?: string }[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const palette = [ACCENT, '#2563eb', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ca8a04']
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={GRID} strokeWidth={thickness} />
        {total > 0 &&
          data.map((item, index) => {
            const length = (item.value / total) * circumference
            const dash = `${length} ${circumference - length}`
            const element = (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color ?? palette[index % palette.length]}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                strokeLinecap="butt"
              />
            )
            offset += length
            return element
          })}
        <text x="50%" y="47%" textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--color-ink)">
          {centerValue ?? total}
        </text>
        <text x="50%" y="60%" textAnchor="middle" fontSize="9" fill={MUTED}>
          {centerLabel ?? 'total'}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((item, index) => (
          <li key={item.label} className="flex items-center justify-between gap-2 text-[12px]">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: item.color ?? palette[index % palette.length] }} />
              <span className="truncate capitalize text-muted">{item.label}</span>
            </span>
            <span className="font-medium">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value))
  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const width = Math.max(6, (step.value / max) * 100)
        const conversion = index === 0 ? null : Math.round((step.value / Math.max(1, steps[index - 1].value)) * 100)
        return (
          <div key={step.label}>
            <div className="mb-1 flex items-center justify-between text-[11.5px]">
              <span className="capitalize text-muted">{step.label}</span>
              <span className="font-medium">
                {step.value}
                {conversion !== null ? <span className="ml-1.5 text-faint">{conversion}%</span> : null}
              </span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-md bg-surface-2">
              <div
                className="flex h-full items-center rounded-md px-2 text-[10px] font-medium text-white"
                style={{ width: `${width}%`, background: `color-mix(in srgb, ${ACCENT} ${92 - index * 12}%, #1f2937)` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function Sparkline({ values, width = 90, height = 26 }: { values: number[]; width?: number; height?: number }) {
  if (!values.length) return null
  const max = Math.max(1, ...values)
  const step = width / Math.max(1, values.length - 1)
  const points = values.map((value, index) => `${index * step},${height - (value / max) * (height - 4) - 2}`).join(' ')
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline points={points} fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
