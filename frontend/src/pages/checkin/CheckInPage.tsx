import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Printer, TestTubes, XCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FilterBar, filterQuery, filtersFromParams, type Filters } from '../../components/FilterBar'
import { OrderStatusBadge, UrgentBadge } from '../../components/lab'
import { CollectDialog, ReceiveDialog, RejectDialog } from '../../components/SpecimenDialogs'
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorNote,
  LinkButton,
  PageHeader,
  Pager,
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
  useToast,
  focusRing,
} from '../../components/ui'
import { api, type CheckInTab, type OrderDetail, type OrderSummary } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

const TABS: CheckInTab[] = ['Collect', 'Receive', 'Received', 'Rejected']

export function CheckInPage() {
  const { t, formatDateTime } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as CheckInTab) ? params.get('tab') : 'Collect') as CheckInTab
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(params))
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [dialog, setDialog] = useState<{ kind: 'collect' | 'receive' | 'reject'; orderId: string } | null>(null)
  const debounced = useDebounced(search)
  const base = { search: debounced, ...filterQuery(filters) }

  const list = useQuery({
    queryKey: ['checkin', tab, base, page],
    queryFn: () => api.checkIn({ tab, ...base, page, pageSize: 20 }),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  })
  // Each tab shows how many orders are in it.
  const counts = useQuery({
    queryKey: ['checkin', 'counts', base],
    queryFn: async () => Object.fromEntries(await Promise.all(TABS.map(async (x) => [x, (await api.checkIn({ tab: x, ...base, page: 1, pageSize: 1 })).total] as const))),
    refetchInterval: 30_000,
  })

  const bulk = useMutation({
    mutationFn: () => api.bulkReceive(selected),
    onSuccess: (r) => {
      toast(t('checkin.bulkReceived', { n: r.received }))
      setSelected([])
      queryClient.invalidateQueries({ queryKey: ['checkin'] })
      queryClient.invalidateQueries({ queryKey: ['checkin-waiting'] })
    },
  })

  const setTab = (next: CheckInTab) => {
    setParams({ tab: next })
    setPage(1)
    setSelected([])
  }
  const items = list.data?.items ?? []
  const allSelected = items.length > 0 && items.every((o) => selected.includes(o.id))

  const actions = (o: OrderSummary): ReactNode => (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        to={`/lab-orders/${o.id}/specimen-labels`}
        aria-label={t('order.printLabels')}
        title={t('order.printLabels')}
        className={`inline-flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink ${focusRing}`}
      >
        <Printer className="size-4" />
      </Link>
      {tab === 'Collect' ? (
        <Button size="sm" onClick={() => setDialog({ kind: 'collect', orderId: o.id })}>
          {t('specimen.collect')}
        </Button>
      ) : null}
      {tab === 'Receive' ? (
        <>
          <Button size="sm" variant="success" onClick={() => setDialog({ kind: 'receive', orderId: o.id })}>
            {t('specimen.receive')}
          </Button>
          <Button size="sm" variant="dangerOutline" onClick={() => setDialog({ kind: 'reject', orderId: o.id })}>
            {t('specimen.reject')}
          </Button>
        </>
      ) : null}
      {tab === 'Received' ? (
        <Button size="sm" variant="dangerOutline" onClick={() => setDialog({ kind: 'reject', orderId: o.id })}>
          {t('specimen.reject')}
        </Button>
      ) : null}
      <LinkButton to={`/lab-orders/${o.id}`} size="sm" variant="secondary">
        {t('common.details')}
      </LinkButton>
    </div>
  )

  return (
    <div className="space-y-5">
      <PageHeader title={t('checkin.title')} description={t('checkin.subtitle')} />
      <Tabs value={tab} onChange={setTab} tabs={TABS.map((x) => ({ value: x, label: t(`checkin.tab.${x}`), count: counts.data?.[x] }))} />
      <Card className="px-5 py-4">
        <FilterBar value={filters} onChange={(f) => (setFilters(f), setPage(1))} />
      </Card>
      <Card>
        <Toolbar
          actions={
            tab === 'Receive' ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setSelected(allSelected ? [] : items.map((o) => o.id))} disabled={items.length === 0}>
                  {t(allSelected ? 'checkin.clearSelection' : 'checkin.selectAll')}
                </Button>
                <Button variant="success" size="sm" disabled={selected.length === 0} loading={bulk.isPending} onClick={() => bulk.mutate()}>
                  <CircleCheck className="size-4" />
                  {t('checkin.receiveSelected', { n: selected.length })}
                </Button>
              </>
            ) : null
          }
        >
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder={t('checkin.searchPlaceholder')} className="w-full max-w-md" />
        </Toolbar>
        <ErrorNote error={list.error ?? bulk.error} />
        {list.data && list.data.total === 0 ? (
          <EmptyState icon={TestTubes} title={t(`checkin.empty.${tab}`)} />
        ) : (
          <DataTable>
            <thead className={tableHeadClass}>
              <tr>
                {tab === 'Receive' ? (
                  <th className={`${thClass} w-10`}>
                    <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : items.map((o) => o.id))} aria-label={t('checkin.selectAll')} className="size-4 accent-brand-600" />
                  </th>
                ) : null}
                <th className={thClass}>{t('order.no')}</th>
                <th className={thClass}>{t('patient.name')}</th>
                <th className={thClass}>HN</th>
                <th className={thClass}>{t('order.tests')}</th>
                <th className={thClass}>{t('checkin.specimens')}</th>
                <th className={thClass}>{t('order.status')}</th>
                <th className={thClass}>{t('order.orderedAt')}</th>
                <th className={thClass}>{t('checkin.receivedAt')}</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {list.isLoading ? <SkeletonRows columns={9} /> : null}
              {items.map((o) => (
                <tr key={o.id} className={tableRowClass}>
                  {tab === 'Receive' ? (
                    <td className={tdClass}>
                      <input
                        type="checkbox"
                        checked={selected.includes(o.id)}
                        onChange={() => setSelected(selected.includes(o.id) ? selected.filter((x) => x !== o.id) : [...selected, o.id])}
                        aria-label={o.orderNo}
                        className="size-4 accent-brand-600"
                      />
                    </td>
                  ) : null}
                  <td className={tdClass} data-title>
                    <Link to={`/lab-orders/${o.id}`} className="font-mono font-medium text-brand-700 hover:underline">
                      {o.orderNo}
                    </Link>
                    {o.urgent ? (
                      <span className="ml-2 align-middle">
                        <UrgentBadge />
                      </span>
                    ) : null}
                  </td>
                  <td className={tdClass} data-label={t('patient.name')}>
                    {o.patientName}
                  </td>
                  <td className={`${tdClass} font-mono`} data-label="HN">
                    {o.hn}
                  </td>
                  <td className={tdClass} data-label={t('order.tests')}>
                    <Badge tone="accent">{t('order.testCount', { n: o.itemCount })}</Badge>
                  </td>
                  <td className={`${tdClass} text-xs text-ink-muted`} data-label={t('checkin.specimens')}>
                    {t('checkin.specimenSummary', { received: o.receivedCount, total: o.containerCount })}
                    {o.rejectedCount > 0 ? (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-red-700">
                        <XCircle className="size-3.5" aria-hidden />
                        {o.rejectedCount}
                      </span>
                    ) : null}
                  </td>
                  <td className={tdClass} data-label={t('order.status')}>
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-muted`} data-label={t('order.orderedAt')}>
                    {formatDateTime(o.orderedAt)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-muted`} data-label={t('checkin.receivedAt')}>
                    {o.receivedAt ? formatDateTime(o.receivedAt) : '–'}
                  </td>
                  <td className={tdClass} data-actions>
                    {actions(o)}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        <Pager page={page} pageSize={20} total={list.data?.total ?? 0} onPage={setPage} />
      </Card>
      {dialog ? <OrderDialog {...dialog} onClose={() => setDialog(null)} /> : null}
    </div>
  )
}

/** Loads the order a dialog needs, then shows that dialog. */
function OrderDialog({ kind, orderId, onClose }: { kind: 'collect' | 'receive' | 'reject'; orderId: string; onClose: () => void }) {
  const order = useQuery({ queryKey: ['order', orderId], queryFn: () => api.order(orderId) })
  if (!order.data) return null
  const o: OrderDetail = order.data
  if (kind === 'collect') return <CollectDialog order={o} onClose={onClose} />
  if (kind === 'receive') return <ReceiveDialog order={o} onClose={onClose} />
  return <RejectDialog order={o} onClose={onClose} />
}
