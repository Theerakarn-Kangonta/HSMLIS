import type { OrderSummary } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { STAGES, isLate, stageOf } from '../lib/journey'

/**
 * Where an order's specimen is, drawn as a little test tube moving along a track:
 * ordered → collected → received → testing → approved. Amber when it is running late.
 */
export function JourneyTrack({ order }: { order: Pick<OrderSummary, 'status' | 'urgent' | 'orderedAt' | 'collectedCount' | 'receivedCount' | 'enteredCount'> }) {
  const { t } = useI18n()
  if (order.status === 'Cancelled') return <span className="text-xs font-medium text-ink-subtle line-through">{t('orderStatus.Cancelled')}</span>

  const stage = stageOf(order)
  const late = isLate(order)
  const done = stage === STAGES.length - 1
  const color = late ? 'text-amber-500' : done ? 'text-emerald-500' : 'text-brand-600'
  const label = t(`journey.${STAGES[stage]}`)
  return (
    <span className="inline-flex flex-col gap-1" role="img" aria-label={`${label}${late ? ` · ${t('journey.late')}` : ''}`}>
      <span className={`relative flex h-4 w-28 items-center justify-between ${color}`}>
        <span className="absolute inset-x-1 h-0.5 rounded-full bg-slate-200" aria-hidden />
        <span className="absolute left-1 h-0.5 rounded-full bg-current transition-[width] duration-500" style={{ width: `calc(${(stage / (STAGES.length - 1)) * 100}% - 0.5rem)` }} aria-hidden />
        {STAGES.map((s, i) =>
          i === stage ? (
            <span key={s} className="relative h-4 w-2.5 rounded-b-full border-2 border-current bg-surface" aria-hidden>
              <span className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-full bg-current" />
            </span>
          ) : (
            <span key={s} className={`relative size-2 rounded-full ${i < stage ? 'bg-current' : 'border-2 border-slate-300 bg-surface'}`} aria-hidden />
          ),
        )}
      </span>
      <span className={`text-xs font-medium ${late ? 'text-amber-700' : 'text-ink-muted'}`}>
        {label}
        {late ? ` · ${t('journey.late')}` : ''}
      </span>
    </span>
  )
}
