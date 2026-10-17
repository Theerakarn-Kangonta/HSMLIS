import { useQuery } from '@tanstack/react-query'
import { Activity, Banknote, CheckCircle2, ClipboardList, FlaskConical, Hourglass, Printer, RefreshCw, ShieldCheck, TestTube, Timer, TriangleAlert, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ComboChart, Donut, HorizontalBars } from '../components/charts'
import { FilterBar, emptyFilters, filterQuery, linkWithFilters, type Filters } from '../components/FilterBar'
import { Button, Card, CardHeader, ErrorNote, KpiCard, SkeletonCards, Tabs } from '../components/ui'
import { api, type DailyPoint, type OrderStatus, type TatStep } from '../lib/api'
import { useAuth } from '../lib/auth'
import { periodRange, type Period } from '../lib/dates'
import { useI18n } from '../lib/i18n'

const stepIcons = [ClipboardList, TestTube, FlaskConical, Activity, ShieldCheck, CheckCircle2]

export function DashboardPage() {
  const { t, formatMoney, formatNumber, formatDayShort, formatMonthShort, formatDate, formatCompact, formatMinutes } = useI18n()
  const [period, setPeriod] = useState<Period | null>('week')
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters, ...periodRange('week') })
  const [measure, setMeasure] = useState<'avg' | 'median'>('avg')
  const { can } = useAuth()

  const query = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => api.dashboard(filterQuery(filters)),
    placeholderData: (previous) => previous,
  })
  const d = query.data

  const choosePeriod = (p: Period) => {
    setPeriod(p)
    setFilters({ ...filters, ...periodRange(p) })
  }

  const minutesOf = (s: TatStep) => (measure === 'avg' ? s.avgMinutes : s.medianMinutes)
  const bottleneck = d?.steps.reduce<TatStep | null>((worst, s) => ((minutesOf(s) ?? -1) > (worst ? (minutesOf(worst) ?? -1) : -1) ? s : worst), null)
  const maxStep = Math.max(1, ...(d?.steps.map((s) => minutesOf(s) ?? 0) ?? [1]))
  // Every figure opens the list behind it, with the dashboard's dates and filters; no link without access.
  const ordersLink = (extra: Record<string, string | null | undefined> = {}) => (can('orders') ? linkWithFilters('/lab-orders', filters, extra) : undefined)
  const statusLink = (status: OrderStatus) => ordersLink({ status })
  const scrollToTat = () => document.getElementById('tat')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Long ranges (e.g. a year) are drawn per month so the columns stay readable.
  const byMonth = (d?.daily.length ?? 0) > 62
  const trend: DailyPoint[] = !d
    ? []
    : byMonth
      ? Object.values(
          d.daily.reduce<Record<string, DailyPoint>>((months, x) => {
            const key = `${x.day.slice(0, 7)}-01`
            const m = (months[key] ??= { day: key, patients: 0, revenue: 0, rejected: 0 })
            m.patients += x.patients
            m.revenue += x.revenue
            m.rejected += x.rejected
            return months
          }, {}),
        )
      : d.daily

  const stageLabels = ['ordered', 'collected', 'received', 'entered', 'verified', 'approved'] as const

  return (
    <div className="space-y-4">
      {/* One bar for everything that chooses what the page shows: period, dates, filters, refresh, print. */}
      <Card className="flex flex-wrap items-center gap-2 px-3 py-2.5 print:hidden">
        <h1 className="mr-1 pl-1 text-lg font-semibold tracking-tight text-ink" title={t('dash.subtitle')}>
          {t('dash.title')}
        </h1>
        <Tabs
          value={period ?? ('' as Period)}
          onChange={choosePeriod}
          tabs={(['today', 'week', 'month', 'year'] as const).map((p) => ({ value: p, label: t(`period.${p}`) }))}
        />
        <FilterBar
          compact
          value={filters}
          onChange={(f) => {
            // Changing only a dropdown keeps the chosen period; emptied dates go back to this week.
            const reset = !f.from && !f.to
            if (reset) setPeriod('week')
            else if (f.from !== filters.from || f.to !== filters.to) setPeriod(null)
            setFilters(reset ? { ...f, ...periodRange('week') } : f)
          }}
          show={['dates', 'referrer', 'department']}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={() => query.refetch()} loading={query.isFetching} aria-label={t('common.refresh')} title={t('common.refresh')} className="px-2.5">
            <RefreshCw className="size-4" />
          </Button>
          <Button variant="secondary" onClick={() => window.print()} aria-label={t('common.print')} title={t('common.print')} className="px-2.5">
            <Printer className="size-4" />
          </Button>
        </div>
      </Card>
      {/* On paper the bar is hidden, so say which days the figures cover. */}
      <p className="hidden text-sm print:block">
        <span className="font-semibold">{t('dash.title')}</span> · {filters.from ? formatDate(filters.from) : ''} – {filters.to ? formatDate(filters.to) : ''}
      </p>

      <ErrorNote error={query.error} />
      {!d ? (
        <SkeletonCards count={6} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <KpiCard
              label={t('dash.revenue')}
              value={`฿${formatNumber(Math.round(d.kpis.revenue))}`}
              hint={t('dash.billed', { amount: `฿${formatNumber(Math.round(d.kpis.billed))}` })}
              icon={Banknote}
              tone="success"
              to={can('billing') ? linkWithFilters('/billing', { ...filters, departmentId: '', testId: '' }) : undefined}
            />
            <KpiCard label={t('dash.patients')} value={formatNumber(d.kpis.patients)} icon={Users} tone="info" to={can('patients') ? '/patients' : undefined} />
            <KpiCard label={t('dash.completedTests')} value={formatNumber(d.kpis.completedTests)} icon={CheckCircle2} tone="success" to={statusLink('Completed')} />
            <KpiCard
              label={t('dash.specimensReceived')}
              value={formatNumber(d.kpis.specimensReceived)}
              icon={TestTube}
              tone="warn"
              to={can('checkin') ? linkWithFilters('/check-in', filters, { tab: 'Received' }) : undefined}
            />
            <KpiCard label={t('dash.avgTat')} value={d.kpis.avgTatHours === null ? '–' : formatNumber(d.kpis.avgTatHours)} hint={t('dash.hours')} icon={Timer} tone="violet" onClick={scrollToTat} />
            <KpiCard label={t('dash.pending')} value={formatNumber(d.kpis.pending)} hint={t('dash.orders')} icon={Hourglass} tone="danger" to={ordersLink({ status: 'open' })} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title={t(byMonth ? 'dash.trendMonth' : 'dash.trend')} description={t(byMonth ? 'dash.trendHintMonth' : 'dash.trendHint')} />
              <div className="p-5">
                <ComboChart
                  data={trend}
                  xLabel={(row) => (byMonth ? formatMonthShort(row.day) : formatDayShort(row.day))}
                  tooltipLabel={(row) => (byMonth ? formatMonthShort(row.day) : formatDate(row.day))}
                  bars={[
                    { label: t('dash.seriesPatients'), color: '#6366f1', value: (row) => row.patients, format: formatNumber },
                    { label: t('dash.seriesRejected'), color: '#ef4444', value: (row) => row.rejected, format: formatNumber },
                  ]}
                  line={{ label: t('dash.seriesRevenue'), color: '#10b981', value: (row) => row.revenue, format: (n) => formatMoney(n) }}
                  leftCaption={t('dash.axisCount')}
                  rightCaption={t('dash.axisBaht')}
                  formatLeft={formatNumber}
                  formatRight={formatCompact}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title={t('dash.workload')} description={t('dash.workloadHint')} />
              <div className="p-5">
                {d.workload.length === 0 ? (
                  <p className="text-sm text-ink-muted">{t('dash.noData')}</p>
                ) : (
                  <HorizontalBars rows={d.workload.map((w) => ({ label: w.name || t('dash.walkIn'), value: w.count, to: w.id ? ordersLink({ referrerId: w.id }) : null }))} />
                )}
              </div>
            </Card>
          </div>

          <Card id="tat" className="scroll-mt-4">
            <CardHeader title={t('dash.tatTitle')} description={t('dash.tatHint')}>
              <Tabs value={measure} onChange={setMeasure} tabs={[{ value: 'avg', label: t('dash.average') }, { value: 'median', label: t('dash.median') }]} />
            </CardHeader>
            <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.4fr]">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-lg bg-page p-4">
                  <p className="text-xs text-ink-muted">{t('dash.tatTotal')}</p>
                  <p className="mt-1 text-figure font-semibold tabular-nums text-ink">{d.tatTotalAvgHours === null ? '–' : formatNumber(d.tatTotalAvgHours)}</p>
                  <p className="text-xs text-ink-muted">{t('dash.hoursOrderToApprove')}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-4">
                  <p className="text-xs text-amber-900">{t('dash.bottleneck')}</p>
                  <p className="mt-1 flex items-center gap-1.5 font-semibold text-amber-900">
                    <TriangleAlert className="size-4 shrink-0" aria-hidden />
                    {bottleneck && minutesOf(bottleneck) !== null ? t(`step.${bottleneck.step}`) : '–'}
                  </p>
                  <p className="text-xs text-amber-900">{bottleneck && minutesOf(bottleneck) !== null ? formatMinutes(minutesOf(bottleneck)!) : ''}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-4">
                  <p className="text-xs text-emerald-800">{t('dash.withinTarget')}</p>
                  <p className="mt-1 text-figure font-semibold tabular-nums text-emerald-800">{d.withinTargetPercent === null ? '–' : `${formatNumber(d.withinTargetPercent)}%`}</p>
                  <p className="text-xs text-emerald-800">{t('dash.withinTargetHint')}</p>
                </div>
              </div>
              <div>
                <ol className="mb-5 flex items-start justify-between gap-1 overflow-x-auto pb-1">
                  {stageLabels.map((stage, i) => {
                    const Icon = stepIcons[i]
                    const count = i === 0 ? d.status.total - d.status.cancelled : d.steps[i - 1].count
                    return (
                      <li key={stage} className="flex min-w-16 flex-1 flex-col items-center text-center">
                        <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="mt-1.5 text-xs font-medium text-ink">{t(`stage.${stage}`)}</span>
                        <span className="text-xs tabular-nums text-ink-muted">{formatNumber(count)}</span>
                      </li>
                    )
                  })}
                </ol>
                <p className="mb-2 text-xs font-semibold text-ink-muted">{t('dash.perStep')}</p>
                <ul className="space-y-2.5">
                  {d.steps.map((s) => {
                    const minutes = minutesOf(s)
                    const worst = s === bottleneck && minutes !== null
                    return (
                      <li key={s.step}>
                        <div className="mb-1 flex justify-between gap-3 text-xs">
                          <span className="text-ink">{t(`step.${s.step}`)}</span>
                          <span className={`font-semibold tabular-nums ${worst ? 'text-amber-600' : 'text-ink'}`}>{minutes === null ? '–' : formatMinutes(minutes)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${worst ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${(100 * (minutes ?? 0)) / maxStep}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title={t('dash.statusTitle')} />
              <div className="p-5">
                <Donut
                  centerLabel={t('dash.orders')}
                  parts={[
                    { label: t('orderStatus.Completed'), value: d.status.completed, color: '#10b981', to: statusLink('Completed') },
                    { label: t('orderStatus.InProgress'), value: d.status.inProgress, color: '#6366f1', to: statusLink('InProgress') },
                    { label: t('orderStatus.AwaitingCollection'), value: d.status.awaiting, color: '#f59e0b', to: statusLink('AwaitingCollection') },
                    { label: t('orderStatus.Cancelled'), value: d.status.cancelled, color: '#94a3b8', to: statusLink('Cancelled') },
                  ]}
                />
                <p className="mt-4 border-t border-rule pt-3 text-xs text-ink-muted">
                  {can('checkin') ? (
                    <Link to={linkWithFilters('/check-in', filters, { tab: 'Rejected' })} className="hover:text-brand-600 hover:underline">
                      {t('dash.rejectionRate')}: <span className="font-semibold text-ink">{formatNumber(d.status.rejectionRate)}%</span>
                    </Link>
                  ) : (
                    <>
                      {t('dash.rejectionRate')}: <span className="font-semibold text-ink">{formatNumber(d.status.rejectionRate)}%</span>
                    </>
                  )}
                </p>
              </div>
            </Card>
            <Card>
              <CardHeader title={t('dash.topTests')} />
              <div className="p-5">
                {d.topTests.length === 0 ? <p className="text-sm text-ink-muted">{t('dash.noData')}</p> : <HorizontalBars rows={d.topTests.map((x) => ({ label: x.name, value: x.count, to: x.id ? ordersLink({ testId: x.id }) : null }))} />}
              </div>
            </Card>
            <Card>
              <CardHeader title={t('dash.revenueByDepartment')} description={t('dash.revenueByDepartmentHint')} />
              <div className="p-5">
                {d.revenueByDepartment.length === 0 ? (
                  <p className="text-sm text-ink-muted">{t('dash.noData')}</p>
                ) : (
                  <HorizontalBars rows={d.revenueByDepartment.map((x) => ({ label: x.name, value: x.amount, color: x.color, to: x.id ? ordersLink({ departmentId: x.id }) : null }))} format={formatMoney} />
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
