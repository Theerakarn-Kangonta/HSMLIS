import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { focusRing } from './ui'

// Small charts drawn with SVG and divs: no chart library, so nothing extra to load and
// nothing outside the content security policy.

/** A round axis top a little above the largest value, so the ticks are even numbers: 0, 5, 10, 15, 20. */
export function niceScale(max: number, steps = 4): number[] {
  if (max <= 0) return Array.from({ length: steps + 1 }, (_, i) => i)
  const raw = max / steps
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw) ?? 10) * magnitude
  return Array.from({ length: steps + 1 }, (_, i) => +(i * step).toPrecision(12))
}

export type BarSeries<T> = { label: string; color: string; value: (row: T) => number; format?: (n: number) => string }

/**
 * Bars counted on the left axis and a line on its own right axis (e.g. patients and rejected per day
 * against revenue in baht), with gridlines, axis captions and a tooltip per column.
 */
export function ComboChart<T>({
  data,
  xLabel,
  tooltipLabel = xLabel,
  bars,
  line,
  leftCaption,
  rightCaption,
  formatLeft = String,
  formatRight = String,
  height = 240,
}: {
  data: T[]
  xLabel: (row: T) => string
  tooltipLabel?: (row: T) => string
  bars: BarSeries<T>[]
  line: BarSeries<T>
  leftCaption: string
  rightCaption: string
  formatLeft?: (n: number) => string
  formatRight?: (n: number) => string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const left = niceScale(Math.max(0, ...data.flatMap((row) => bars.map((b) => b.value(row)))))
  const right = niceScale(Math.max(0, ...data.map((row) => line.value(row))))
  const leftMax = left[left.length - 1]
  const rightMax = right[right.length - 1]
  const n = data.length
  // Every column keeps its bars, but crowded axes label only every few columns.
  const every = Math.max(1, Math.ceil(n / 12))
  const point = (row: T, i: number) => ({ x: ((i + 0.5) / n) * 100, y: 100 - (100 * line.value(row)) / rightMax })
  const points = data.map(point)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  const all = [...bars, line]

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        {bars.map((b) => (
          <span key={b.label} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
            {b.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="relative inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: line.color }}>
            <span className="absolute top-1/2 left-1/2 size-2 -translate-1/2 rounded-full border-2 bg-surface" style={{ borderColor: line.color }} />
          </span>
          {line.label}
        </span>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2">
        {/* Axis captions */}
        <span className="pb-1.5 text-right text-[0.6875rem] font-medium text-ink-muted">{leftCaption}</span>
        <span />
        <span className="pb-1.5 text-[0.6875rem] font-medium" style={{ color: line.color }}>
          {rightCaption}
        </span>

        {/* Left axis */}
        <div className="relative min-w-6" style={{ height }}>
          {left.map((tick, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2 text-[0.6875rem] tabular-nums text-ink-subtle" style={{ top: `${100 - (100 * i) / (left.length - 1)}%` }}>
              {formatLeft(tick)}
            </span>
          ))}
        </div>

        {/* Plot */}
        <div className="relative border-b border-rule" style={{ height }} onMouseLeave={() => setHover(null)}>
          {left.map((_, i) => (
            <div key={i} className={`absolute inset-x-0 border-t ${i === 0 ? 'border-transparent' : 'border-dashed border-rule'}`} style={{ top: `${100 - (100 * i) / (left.length - 1)}%` }} />
          ))}

          <div className="absolute inset-0 flex">
            {data.map((row, i) => (
              <div key={i} className={`flex h-full min-w-0 flex-1 justify-center ${hover === i ? 'bg-brand-500/8' : ''}`} onMouseEnter={() => setHover(i)}>
                <div className="flex h-full w-[76%] items-end justify-center gap-[3px]">
                  {bars.map((b) => (
                    <div
                      key={b.label}
                      className="w-full max-w-5 rounded-t-[3px] transition-[height,opacity] duration-300"
                      style={{ height: `${(100 * b.value(row)) / leftMax}%`, backgroundColor: b.color, opacity: hover === null || hover === i ? 1 : 0.4 }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {n > 0 ? (
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              <path d={`${path} L${points[n - 1].x},100 L${points[0].x},100 Z`} fill={line.color} opacity="0.08" />
              <path d={path} fill="none" stroke={line.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
          ) : null}
          {points.map((p, i) => (
            <span
              key={i}
              className={`pointer-events-none absolute -translate-1/2 rounded-full border-2 bg-surface transition-[width,height] ${hover === i ? 'size-3' : n > 31 ? 'size-0' : 'size-2'}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, borderColor: line.color }}
            />
          ))}

          {hover !== null ? (
            <div
              className={`pointer-events-none absolute top-1 z-10 min-w-40 rounded-lg border border-rule bg-surface px-3 py-2 text-xs shadow-lg ${hover < n / 2 ? '' : '-translate-x-full'}`}
              style={{ left: `${((hover + (hover < n / 2 ? 1 : 0)) / n) * 100}%`, marginLeft: hover < n / 2 ? 8 : -8 }}
            >
              <div className="mb-1.5 font-semibold text-ink">{tooltipLabel(data[hover])}</div>
              {all.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4 py-0.5">
                  <span className="inline-flex items-center gap-1.5 text-ink-muted">
                    <span className="size-2 rounded-sm" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">{(s.format ?? String)(s.value(data[hover]))}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Right axis */}
        <div className="relative min-w-8" style={{ height }}>
          {right.map((tick, i) => (
            <span key={i} className="absolute left-0 -translate-y-1/2 text-[0.6875rem] tabular-nums" style={{ top: `${100 - (100 * i) / (right.length - 1)}%`, color: line.color }}>
              {formatRight(tick)}
            </span>
          ))}
        </div>

        {/* X axis */}
        <span />
        <div className="flex pt-1.5">
          {data.map((row, i) => (
            <span key={i} className="flex min-w-0 flex-1 justify-center text-[0.6875rem] whitespace-nowrap text-ink-subtle">
              {i % every === 0 ? xLabel(row) : ''}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  )
}

/** Labelled horizontal bars, longest first, e.g. workload per referring unit. */
export function HorizontalBars({
  rows,
  format = String,
  color = 'var(--color-brand-500)',
}: {
  rows: { label: string; value: number; color?: string | null; to?: string | null }[]
  format?: (n: number) => string
  color?: string
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-1">
      {rows.map((row, i) => {
        const body = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className={`min-w-0 truncate text-ink ${row.to ? 'group-hover:text-brand-600 group-hover:underline' : ''}`}>{row.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">{format(row.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(100 * row.value) / max}%`, backgroundColor: row.color ?? color }} />
            </div>
          </>
        )
        return (
          <li key={`${row.label}-${i}`}>
            {row.to ? (
              <Link to={row.to} className={`group -mx-2 block rounded-md px-2 py-1 hover:bg-page ${focusRing}`}>
                {body}
              </Link>
            ) : (
              <div className="py-1">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** A ring split by share, with the total in the middle and a legend beside it. */
export function Donut({ parts, centerLabel }: { parts: { label: string; value: number; color: string; to?: string | null }[]; centerLabel: string }) {
  const id = useId()
  const total = parts.reduce((s, p) => s + p.value, 0)
  const r = 15.915 // circumference 100, so dash lengths are percentages
  let offset = 25
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 42 42" className="size-32 shrink-0" role="img" aria-labelledby={id}>
        <title id={id}>{parts.map((p) => `${p.label} ${p.value}`).join(', ')}</title>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--color-slate-100)" strokeWidth="5" />
        {total > 0
          ? parts.map((p) => {
              const share = (100 * p.value) / total
              const dash = `${share} ${100 - share}`
              const el = <circle key={p.label} cx="21" cy="21" r={r} fill="none" stroke={p.color} strokeWidth="5" strokeDasharray={dash} strokeDashoffset={offset} />
              offset -= share
              return el
            })
          : null}
        <text x="21" y="20.5" textAnchor="middle" className="fill-ink text-[0.5rem] font-semibold">
          {total}
        </text>
        <text x="21" y="26" textAnchor="middle" className="fill-ink-muted text-[0.22rem]">
          {centerLabel}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {parts.map((p) => {
          const body = (
            <>
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <span className={`truncate text-ink ${p.to ? 'group-hover:text-brand-600 group-hover:underline' : ''}`}>{p.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {p.value} · {total > 0 ? Math.round((100 * p.value) / total) : 0}%
              </span>
            </>
          )
          return (
            <li key={p.label}>
              {p.to ? (
                <Link to={p.to} className={`group -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-0.5 hover:bg-page ${focusRing}`}>
                  {body}
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-3 py-0.5">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
