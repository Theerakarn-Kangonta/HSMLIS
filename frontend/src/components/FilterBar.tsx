import { CalendarRange, Filter, X } from 'lucide-react'
import { useDepartments, useLabTests, useReferrers } from '../lib/catalog'
import { useI18n } from '../lib/i18n'
import { Button, Field, Input, Select } from './ui'

export type Filters = { from: string; to: string; referrerId: string; departmentId: string; testId: string }

export const emptyFilters: Filters = { from: '', to: '', referrerId: '', departmentId: '', testId: '' }

/**
 * The filters most lab lists share: dates, referring unit, department and test.
 * `compact` drops the labels above the controls and renders them inline, for a one-line toolbar.
 */
export function FilterBar({ value, onChange, show = ['dates', 'referrer', 'department', 'test'], compact = false }: {
  value: Filters
  onChange: (value: Filters) => void
  show?: ('dates' | 'referrer' | 'department' | 'test')[]
  compact?: boolean
}) {
  const { t } = useI18n()
  const referrers = useReferrers()
  const departments = useDepartments()
  const tests = useLabTests()
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch })
  const used = Object.values(value).filter(Boolean).length
  const visibleTests = (tests.data ?? []).filter((x) => !value.departmentId || x.departmentId === value.departmentId)

  if (compact) {
    const dateClass = 'h-full w-[8.25rem] bg-transparent px-1.5 text-sm text-ink outline-none'
    return (
      <>
        {show.includes('dates') ? (
          <div className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-surface pl-2.5 transition-[border-color,box-shadow] hover:border-slate-400 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
            <CalendarRange className="size-4 shrink-0 text-ink-subtle" aria-hidden />
            <input type="date" aria-label={t('filter.from')} title={t('filter.from')} value={value.from} max={value.to || undefined} onChange={(e) => set({ from: e.target.value })} className={dateClass} />
            <span className="text-ink-subtle" aria-hidden>
              –
            </span>
            <input type="date" aria-label={t('filter.to')} title={t('filter.to')} value={value.to} min={value.from || undefined} onChange={(e) => set({ to: e.target.value })} className={dateClass} />
          </div>
        ) : null}
        {show.includes('referrer') ? (
          <Select aria-label={t('filter.referrer')} title={t('filter.referrer')} value={value.referrerId} onChange={(e) => set({ referrerId: e.target.value })} className="w-48">
            <option value="">{t('filter.allReferrers')}</option>
            {(referrers.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} · {r.name}
              </option>
            ))}
          </Select>
        ) : null}
        {show.includes('department') ? (
          <Select aria-label={t('filter.department')} title={t('filter.department')} value={value.departmentId} onChange={(e) => set({ departmentId: e.target.value, testId: '' })} className="w-44">
            <option value="">{t('filter.allDepartments')}</option>
            {(departments.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameTh ?? d.nameEn}
              </option>
            ))}
          </Select>
        ) : null}
        {value.referrerId || value.departmentId || value.testId ? (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...emptyFilters, from: value.from, to: value.to })} aria-label={t('common.clearFilters')} title={t('common.clearFilters')} className="px-2">
            <X className="size-4" />
          </Button>
        ) : null}
      </>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <span className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
        <Filter className="size-4" aria-hidden />
        {t('filter.title')}
        {used > 0 ? <span className="rounded-full bg-brand-600 px-1.5 text-[0.6875rem] text-white">{used}</span> : null}
      </span>
      {show.includes('dates') ? (
        <>
          <Field label={t('filter.from')}>
            <Input type="date" value={value.from} max={value.to || undefined} onChange={(e) => set({ from: e.target.value })} className="w-40" />
          </Field>
          <Field label={t('filter.to')}>
            <Input type="date" value={value.to} min={value.from || undefined} onChange={(e) => set({ to: e.target.value })} className="w-40" />
          </Field>
        </>
      ) : null}
      {show.includes('referrer') ? (
        <Field label={t('filter.referrer')}>
          <Select value={value.referrerId} onChange={(e) => set({ referrerId: e.target.value })} className="w-56">
            <option value="">{t('common.all')}</option>
            {(referrers.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} · {r.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {show.includes('department') ? (
        <Field label={t('filter.department')}>
          <Select value={value.departmentId} onChange={(e) => set({ departmentId: e.target.value, testId: '' })} className="w-44">
            <option value="">{t('common.all')}</option>
            {(departments.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameTh ?? d.nameEn}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {show.includes('test') ? (
        <Field label={t('filter.test')}>
          <Select value={value.testId} onChange={(e) => set({ testId: e.target.value })} className="w-48">
            <option value="">{t('common.all')}</option>
            {visibleTests.map((x) => (
              <option key={x.id} value={x.id}>
                {x.code} · {x.nameEn}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {used > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(emptyFilters)} className="mb-0.5">
          <X className="size-4" />
          {t('common.clearFilters')}
        </Button>
      ) : null}
    </div>
  )
}

/** The filters as query parameters, leaving out the empty ones. */
export const filterQuery = (f: Filters) => ({
  from: f.from || undefined,
  to: f.to || undefined,
  referrerId: f.referrerId || undefined,
  departmentId: f.departmentId || undefined,
  testId: f.testId || undefined,
})

/** Filters read from a link's query string, e.g. one the dashboard opened. */
export const filtersFromParams = (params: URLSearchParams): Filters => ({
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
  referrerId: params.get('referrerId') ?? '',
  departmentId: params.get('departmentId') ?? '',
  testId: params.get('testId') ?? '',
})

/** A link to a list page with these filters (and any extra parameters) in its query string. */
export function linkWithFilters(path: string, f: Filters, extra: Record<string, string | null | undefined> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...filterQuery(f), ...extra })) if (value) params.set(key, value)
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}
