import { useQuery } from '@tanstack/react-query'
import { BellRing, CheckCheck, ClipboardPen, Microscope, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FilterBar, filterQuery, filtersFromParams, type Filters } from '../../components/FilterBar'
import { OrderTable } from '../../components/OrderTable'
import { Card, EmptyState, ErrorNote, KpiCard, LinkButton, PageHeader, Pager, SearchInput, Tabs, Toolbar, useDebounced } from '../../components/ui'
import { api, type WorklistStage } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

const STAGES: WorklistStage[] = ['Entry', 'Verify', 'Approve', 'Critical', 'All']

export function ResultsPage() {
  const { t, formatNumber } = useI18n()
  const [params, setParams] = useSearchParams()
  const stage = (STAGES.includes(params.get('stage') as WorklistStage) ? params.get('stage') : 'Entry') as WorklistStage
  const [search, setSearch] = useState('')
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
    <div className="space-y-5">
      <PageHeader title={t('results.title')} description={t('results.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t('results.kpiEntry')} value={formatNumber(kpi.data?.pendingEntry ?? 0)} icon={ClipboardPen} tone="accent" onClick={() => setStage('Entry')} active={stage === 'Entry'} />
        <KpiCard label={t('results.kpiVerify')} value={formatNumber(kpi.data?.pendingVerify ?? 0)} icon={CheckCheck} tone="info" onClick={() => setStage('Verify')} active={stage === 'Verify'} />
        <KpiCard label={t('results.kpiApprove')} value={formatNumber(kpi.data?.pendingApprove ?? 0)} icon={ShieldCheck} tone="success" onClick={() => setStage('Approve')} active={stage === 'Approve'} />
        <KpiCard label={t('results.kpiCritical')} value={formatNumber(kpi.data?.criticalOpen ?? 0)} hint={t('results.kpiCriticalHint')} icon={BellRing} tone="danger" onClick={() => setStage('Critical')} active={stage === 'Critical'} />
      </div>
      <Card className="px-5 py-4">
        <FilterBar value={filters} onChange={(f) => (setFilters(f), setPage(1))} />
      </Card>
      <Card>
        <Toolbar>
          <Tabs value={stage} onChange={setStage} tabs={STAGES.map((s) => ({ value: s, label: t(`stageTab.${s}`) }))} />
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder={t('orders.searchPlaceholder')} className="w-full max-w-sm" />
        </Toolbar>
        <ErrorNote error={list.error} />
        {list.data && list.data.total === 0 ? (
          <EmptyState icon={Microscope} title={t('results.emptyTitle')} hint={t('results.emptyHint')} />
        ) : (
          <OrderTable
            orders={list.data?.items}
            loading={list.isLoading}
            progress="entered"
            link={(o) => `/lab-results/${o.id}`}
            actions={(o) => (
              <LinkButton to={`/lab-results/${o.id}`} size="sm">
                {t('result.enter')}
              </LinkButton>
            )}
          />
        )}
        <Pager page={page} pageSize={20} total={list.data?.total ?? 0} onPage={setPage} />
      </Card>
    </div>
  )
}
