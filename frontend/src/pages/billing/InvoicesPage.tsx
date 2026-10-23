import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CalendarRange, CircleCheck, FileText, Hourglass, Receipt } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FilterBar, filtersFromParams, type Filters } from '../../components/FilterBar'
import { InvoiceStatusBadge } from '../../components/lab'
import {
  Button,
  Card,
  DataTable,
  DialogActions,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  KpiCard,
  Modal,
  PageHeader,
  Pager,
  SearchInput,
  Select,
  SkeletonRows,
  Textarea,
  Toolbar,
  focusRing,
  tableBodyClass,
  tableHeadClass,
  tableRowClass,
  tdClass,
  thClass,
  useDebounced,
  useToast,
} from '../../components/ui'
import { api, PAYMENT_METHODS, type Invoice, type InvoiceStatus, type PaymentMethod } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

const STATUSES: InvoiceStatus[] = ['Unpaid', 'Partial', 'Paid', 'Cancelled']

export function InvoicesPage() {
  const { t, formatMoney, formatDateTime, formatNumber } = useI18n()
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [status, setStatus] = useState<InvoiceStatus | ''>(() => (STATUSES.includes(params.get('status') as InvoiceStatus) ? (params.get('status') as InvoiceStatus) : ''))
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(params))
  const [page, setPage] = useState(1)
  const [paying, setPaying] = useState<Invoice | null>(null)
  const debounced = useDebounced(search)

  const kpi = useQuery({ queryKey: ['billing-kpi'], queryFn: api.billingKpi })
  const list = useQuery({
    queryKey: ['invoices', debounced, status, filters, page],
    queryFn: () => api.invoices({ search: debounced, status, referrerId: filters.referrerId || undefined, from: filters.from || undefined, to: filters.to || undefined, page, pageSize: 20 }),
    placeholderData: (previous) => previous,
  })

  return (
    <div className="space-y-4">
      <PageHeader title={t('billing.title')} description={t('billing.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t('billing.revenueToday')} value={formatMoney(kpi.data?.revenueToday ?? 0)} icon={Banknote} tone="success" />
        <KpiCard label={t('billing.revenueMonth')} value={formatMoney(kpi.data?.revenueMonth ?? 0)} icon={CalendarRange} tone="info" />
        <KpiCard label={t('billing.unpaid')} value={formatMoney(kpi.data?.unpaidAmount ?? 0)} hint={t('billing.invoiceCount', { n: formatNumber(kpi.data?.unpaidCount ?? 0) })} icon={Hourglass} tone="danger" />
        <KpiCard label={t('billing.paidToday')} value={formatNumber(kpi.data?.paidTodayCount ?? 0)} hint={t('billing.payments')} icon={CircleCheck} tone="accent" />
      </div>
      <Card className="px-4 py-4">
        <FilterBar value={filters} onChange={(f) => (setFilters(f), setPage(1))} show={['dates', 'referrer']} />
      </Card>
      <Card>
        <Toolbar>
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder={t('billing.searchPlaceholder')} className="w-full max-w-md" />
          <Field label={t('order.status')}>
            <Select value={status} onChange={(e) => (setStatus(e.target.value as InvoiceStatus | ''), setPage(1))} className="w-40">
              <option value="">{t('common.all')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`invoiceStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </Toolbar>
        <ErrorNote error={list.error} />
        {list.data && list.data.total === 0 ? (
          <EmptyState icon={Receipt} title={t('billing.emptyTitle')} />
        ) : (
          <DataTable>
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>{t('billing.invoiceNo')}</th>
                <th className={thClass}>HN</th>
                <th className={thClass}>{t('patient.name')}</th>
                <th className={thClass}>{t('billing.date')}</th>
                <th className={`${thClass} text-right`}>{t('billing.amount')}</th>
                <th className={`${thClass} text-right`}>{t('billing.paid')}</th>
                <th className={thClass}>{t('order.status')}</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {list.isLoading ? <SkeletonRows columns={8} /> : null}
              {list.data?.items.map((inv) => (
                <tr key={inv.id} className={tableRowClass}>
                  <td className={tdClass} data-title>
                    <span className="font-mono font-medium text-ink">{inv.invoiceNo}</span>
                    <Link to={`/lab-orders/${inv.labOrderId}`} className="block font-mono text-xs text-brand-700 hover:underline">
                      {inv.orderNo}
                    </Link>
                  </td>
                  <td className={`${tdClass} font-mono`} data-label="HN">
                    {inv.hn}
                  </td>
                  <td className={tdClass} data-label={t('patient.name')}>
                    {inv.patientName}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-muted`} data-label={t('billing.date')}>
                    {formatDateTime(inv.issuedAt)}
                  </td>
                  <td className={`${tdClass} text-right`} data-label={t('billing.amount')}>
                    {formatMoney(inv.amount)}
                  </td>
                  <td className={`${tdClass} text-right`} data-label={t('billing.paid')}>
                    {formatMoney(inv.paid)}
                  </td>
                  <td className={tdClass} data-label={t('order.status')}>
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className={tdClass} data-actions>
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        to={`/billing/${inv.id}/invoice`}
                        aria-label={t('billing.document')}
                        title={t('billing.document')}
                        className={`inline-flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink ${focusRing}`}
                      >
                        <FileText className="size-4" />
                      </Link>
                      {inv.status === 'Unpaid' || inv.status === 'Partial' ? (
                        <Button size="sm" onClick={() => setPaying(inv)}>
                          {t('billing.pay')}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        <Pager page={page} pageSize={20} total={list.data?.total ?? 0} onPage={setPage} />
      </Card>
      {paying ? <PayDialog invoice={paying} onClose={() => setPaying(null)} /> : null}
    </div>
  )
}

function PayDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { t, formatMoney } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState(String(invoice.balance))
  const [method, setMethod] = useState<PaymentMethod>('Cash')
  const [note, setNote] = useState('')
  const pay = useMutation({
    mutationFn: () => api.pay(invoice.id, { version: invoice.version, amount: Number(amount), method, note: note || null }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['billing-kpi'] })
      queryClient.invalidateQueries({ queryKey: ['ar-summary'] })
      queryClient.invalidateQueries({ queryKey: ['order', saved.labOrderId] })
      toast(t('billing.paidToast', { no: saved.invoiceNo }))
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    pay.mutate()
  }
  return (
    <Modal title={t('billing.payTitle')} description={invoice.invoiceNo} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <dl className="grid grid-cols-3 gap-3 rounded-lg bg-page p-3 text-center text-sm">
          <div>
            <dt className="text-xs text-ink-muted">{t('billing.amount')}</dt>
            <dd className="font-semibold text-ink">{formatMoney(invoice.amount)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t('billing.paid')}</dt>
            <dd className="font-semibold text-ink">{formatMoney(invoice.paid)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">{t('billing.balance')}</dt>
            <dd className="font-semibold text-red-600">{formatMoney(invoice.balance)}</dd>
          </div>
        </dl>
        <Field label={t('billing.payAmount')}>
          <Input type="number" min={0.01} max={invoice.balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label={t('billing.method')}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`paymentMethod.${m}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.note')}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} />
        </Field>
        <ErrorNote error={pay.error} />
        <DialogActions onClose={onClose} pending={pay.isPending} submitLabel={t('billing.confirmPay')} variant="success" />
      </form>
    </Modal>
  )
}
