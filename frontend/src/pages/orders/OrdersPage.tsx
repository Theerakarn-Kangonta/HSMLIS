import { useQuery } from '@tanstack/react-query'
import { ClipboardList, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FilterBar, filterQuery, filtersFromParams, type Filters } from '../../components/FilterBar'
import { OrderTable } from '../../components/OrderTable'
import { Card, EmptyState, ErrorNote, LinkButton, PageHeader, Pager, SearchInput, Select, Toolbar, useDebounced } from '../../components/ui'
import { api, type OrderStatus } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

const statuses: OrderStatus[] = ['AwaitingCollection', 'InProgress', 'Completed', 'Cancelled']
/** "open" = awaiting collection or in progress, the dashboard's pending figure. */
type StatusChoice = OrderStatus | 'open' | ''
const isChoice = (v: string | null): v is StatusChoice => v === 'open' || statuses.includes(v as OrderStatus)

export function OrdersPage() {
  const { t } = useI18n()
  // A link (e.g. from the dashboard) can open the list already filtered.
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [status, setStatus] = useState<StatusChoice>(() => (isChoice(params.get('status')) ? (params.get('status') as StatusChoice) : ''))
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(params))
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const debounced = useDebounced(search)

  const query = useQuery({
    queryKey: ['orders', debounced, status, filters, page, pageSize],
    queryFn: () => api.orders({ search: debounced, ...(status === 'open' ? { open: true } : { status }), ...filterQuery(filters), page, pageSize }),
    placeholderData: (previous) => previous,
  })

  return (
    <div className="space-y-4">
      <PageHeader title={t('orders.title')} description={t('orders.subtitle')}>
        <LinkButton to="/lab-orders/new">
          <Plus className="size-4" />
          {t('orders.new')}
        </LinkButton>
      </PageHeader>
      <Card>
        <Toolbar>
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder={t('orders.searchPlaceholder')} className="w-full sm:w-72" />
          <Select aria-label={t('order.status')} title={t('order.status')} value={status} onChange={(e) => (setStatus(e.target.value as StatusChoice), setPage(1))} className="w-48">
            <option value="">{t('orders.allStatuses')}</option>
            <option value="open">{t('orders.statusOpen')}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {t(`orderStatus.${s}`)}
              </option>
            ))}
          </Select>
          <FilterBar compact value={filters} onChange={(f) => (setFilters(f), setPage(1))} />
        </Toolbar>
        <ErrorNote error={query.error} />
        {query.data && query.data.total === 0 ? (
          <EmptyState icon={ClipboardList} title={t('orders.emptyTitle')} hint={t('orders.emptyHint')}>
            <LinkButton to="/lab-orders/new">{t('orders.new')}</LinkButton>
          </EmptyState>
        ) : (
          <OrderTable orders={query.data?.items} loading={query.isLoading} />
        )}
        <Pager page={page} pageSize={pageSize} total={query.data?.total ?? 0} onPage={setPage} onPageSize={(s) => (setPageSize(s), setPage(1))} />
      </Card>
    </div>
  )
}
