import { useQuery } from '@tanstack/react-query'
import { BellRing, CheckCheck, ClipboardPen, Microscope, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FilterBar, filterQuery, filtersFromParams, type Filters } from '../../components/FilterBar'
import { OrderStatusBadge, UrgentBadge } from '../../components/lab'
import {
  Badge,
  Card,
  ColorDot,
  DataTable,
  EmptyState,
  ErrorNote,
  KpiCard,
  LinkButton,
  PageHeader,
  Pager,
  ProgressBar,
  SearchInput,
  SkeletonRows,
  Tabs,
  Toolbar,
  tableBodyClass,
  tableHeadClass,
  tableRowClass,
  tdClass,
  thClass,
  useDebounced,
} from '../../components/ui'
import { api, type WorklistRow, type WorklistStage } from '../../lib/api'
import { useI18n } from '../../lib/i18n'
import { PatientPhoto } from '../../components/PatientPhoto'

const STAGES: WorklistStage[] = ['All', 'Entry', 'Verify', 'Approve', 'Critical']

/** Where a worklist row leads: the order's result screen, opened on that one department. */
const resultEntryLink = (orderId: string, departmentId: string) => `/lab-results/${orderId}?dep=${departmentId}`

export function ResultsPage() {
  const { t, formatNumber } = useI18n()
  const [params, setParams] = useSearchParams()
  const stage = (STAGES.includes(params.get('stage') as WorklistStage) ? params.get('stage') : 'All') as WorklistStage
  const [search, setSearch] = useState(() => params.get('search') ?? '')
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(params))
  const [page, setPage] = useState(1)
  const debounced = useDebounced(search)

  const kpi = useQuery({ queryKey: ['results-kpi'], queryFn: api.resultsKpi, refetchInterval: 30_000 })
  const list = useQuery({
    queryKey: ['worklist', stage, debounced, filters, page],
    queryFn: () => api.worklist({ stage, search: debounced, ...filterQuery(filters), page, pageSize: 20 }),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  })
  const setStage = (next: WorklistStage) => {
    setParams({ stage: next })
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('results.title')} description={t('result.oneDepartmentHint')} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t('results.kpiEntry')} value={formatNumber(kpi.data?.pendingEntry ?? 0)} icon={ClipboardPen} tone="accent" onClick={() => setStage('Entry')} active={stage === 'Entry'} />
        <KpiCard label={t('results.kpiVerify')} value={formatNumber(kpi.data?.pendingVerify ?? 0)} icon={CheckCheck} tone="info" onClick={() => setStage('Verify')} active={stage === 'Verify'} />
        <KpiCard label={t('results.kpiApprove')} value={formatNumber(kpi.data?.pendingApprove ?? 0)} icon={ShieldCheck} tone="success" onClick={() => setStage('Approve')} active={stage === 'Approve'} />
        <KpiCard label={t('results.kpiCritical')} value={formatNumber(kpi.data?.criticalOpen ?? 0)} hint={t('results.kpiCriticalHint')} icon={BellRing} tone="danger" onClick={() => setStage('Critical')} active={stage === 'Critical'} />
      </div>
      <Card>
        <Toolbar>
          <Tabs value={stage} onChange={setStage} tabs={STAGES.map((s) => ({ value: s, label: t(`stageTab.${s}`) }))} />
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder={t('orders.searchPlaceholder')} className="w-full sm:w-72" />
          <FilterBar compact value={filters} onChange={(f) => (setFilters(f), setPage(1))} />
        </Toolbar>
        <ErrorNote error={list.error} />
        {list.data && list.data.total === 0 ? (
          <EmptyState icon={Microscope} title={t('results.emptyTitle')} hint={t('results.emptyHint')} />
        ) : (
          <WorklistTable rows={list.data?.items} loading={list.isLoading} />
        )}
        <Pager page={page} pageSize={20} total={list.data?.total ?? 0} onPage={setPage} />
      </Card>
    </div>
  )
}

/** One row per order and department; each row opens the result screen for that department only. */
function WorklistTable({ rows, loading }: { rows: WorklistRow[] | undefined; loading: boolean }) {
  const { t, formatDateTime } = useI18n()
  const navigate = useNavigate()
  return (
    <DataTable>
      <thead className={tableHeadClass}>
        <tr>
          <th className={thClass}>{t('order.no')}</th>
          <th className={thClass}>{t('test.department')}</th>
          <th className={thClass}>{t('patient.hn')}</th>
          <th className={thClass}>{t('patient.name')}</th>
          <th className={thClass}>{t('order.referrer')}</th>
          <th className={thClass}>{t('order.orderedAt')}</th>
          <th className={thClass}>{t('order.status')}</th>
          <th className={`${thClass} w-44`}>{t('order.entryProgress')}</th>
          <th className={thClass} />
        </tr>
      </thead>
      <tbody className={tableBodyClass}>
        {loading && !rows ? <SkeletonRows columns={9} /> : null}
        {rows?.map((r) => {
          const link = resultEntryLink(r.orderId, r.departmentId)
          return (
            <tr key={`${r.orderId}:${r.departmentId}`} className={`${tableRowClass} cursor-pointer`} onClick={() => navigate(link)}>
              <td className={tdClass} data-title>
                <span className="font-mono font-medium text-brand-700">{r.orderNo}</span>
                <span className="ml-2 inline-flex gap-1 align-middle">
                  {r.urgent ? <UrgentBadge /> : null}
                  {r.hasCritical ? <Badge tone="danger">{t('flag.critical')}</Badge> : null}
                </span>
              </td>
              <td className={tdClass} data-label={t('test.department')}>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-ink">
                  <ColorDot color={r.departmentColor} />
                  {r.departmentName}
                </span>
              </td>
              <td className={`${tdClass} font-mono`} data-label={t('patient.hn')}>
                {r.hn}
              </td>
              <td className={tdClass} data-label={t('patient.name')}>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <PatientPhoto patientId={r.patientId} photoAt={r.patientPhotoAt} name={r.patientName} />
                  {r.patientName}
                </span>
              </td>
              <td className={`${tdClass} max-w-48 truncate text-ink-muted`} data-label={t('order.referrer')}>
                {r.referrerName ?? '–'}
              </td>
              <td className={`${tdClass} whitespace-nowrap text-ink-muted`} data-label={t('order.orderedAt')}>
                {formatDateTime(r.orderedAt)}
              </td>
              <td className={tdClass} data-label={t('order.status')}>
                <OrderStatusBadge status={r.status} />
              </td>
              <td className={tdClass} data-label={t('order.entryProgress')}>
                <div className="flex items-center gap-2">
                  <ProgressBar value={r.enteredCount} max={r.itemCount} tone={r.approvedCount === r.itemCount ? 'success' : 'accent'} />
                  <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                    {r.enteredCount}/{r.itemCount}
                  </span>
                </div>
                <span className="mt-0.5 block text-xs text-ink-subtle">{t('results.verifiedApproved', { v: r.verifiedCount, a: r.approvedCount })}</span>
              </td>
              <td className={`${tdClass} text-right`} data-actions onClick={(e) => e.stopPropagation()}>
                <LinkButton to={link} size="sm">
                  {t('result.enter')}
                </LinkButton>
              </td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
