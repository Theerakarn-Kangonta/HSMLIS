import { useQuery } from '@tanstack/react-query'
import { Banknote, CircleCheck, Hourglass } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, DataTable, ErrorNote, Field, Input, KpiCard, PageHeader, SearchInput, SkeletonRows, Toolbar, tableBodyClass, tableHeadClass, tableRowClass, tdClass, thClass } from '../../components/ui'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

const bucketTones = ['border-emerald-200 bg-emerald-50 text-emerald-800', 'border-amber-300 bg-amber-50 text-amber-900', 'border-orange-300 bg-orange-50 text-orange-900', 'border-red-200 bg-red-50 text-red-800']

export function ArSummaryPage() {
  const { t, formatMoney, formatDate, formatNumber } = useI18n()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  const query = useQuery({ queryKey: ['ar-summary', from, to], queryFn: () => api.arSummary({ from: from || undefined, to: to || undefined }) })
  const d = query.data
  const needle = search.trim().toLowerCase()
  const items = (d?.items ?? []).filter((i) => !needle || `${i.invoiceNo} ${i.hn} ${i.patientName}`.toLowerCase().includes(needle))

  return (
    <div className="space-y-4">
      <PageHeader title={t('ar.title')} description={t('ar.subtitle')} />
      <ErrorNote error={query.error} />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label={t('ar.billed')} value={formatMoney(d?.totalBilled ?? 0)} icon={Banknote} tone="info" />
        <KpiCard label={t('ar.paid')} value={formatMoney(d?.totalPaid ?? 0)} icon={CircleCheck} tone="success" />
        <KpiCard label={t('ar.outstanding')} value={formatMoney(d?.outstanding ?? 0)} icon={Hourglass} tone="danger" />
      </div>
      <Card>
        <CardHeader title={t('ar.aging')} />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {(d?.buckets ?? []).map((b, i) => (
            <div key={b.label} className={`rounded-lg border p-4 ${bucketTones[i]}`}>
              <p className="text-xs font-semibold">{t('ar.days', { range: b.label })}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(b.amount)}</p>
              <p className="text-xs">{t('billing.invoiceCount', { n: formatNumber(b.count) })}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title={t('ar.list', { n: items.length })} />
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder={t('billing.searchPlaceholder')} className="w-full max-w-sm" />
          <Field label={t('filter.from')}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </Field>
          <Field label={t('filter.to')}>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </Field>
        </Toolbar>
        <DataTable>
          <thead className={tableHeadClass}>
            <tr>
              <th className={thClass}>{t('billing.invoiceNo')}</th>
              <th className={thClass}>HN</th>
              <th className={thClass}>{t('patient.name')}</th>
              <th className={thClass}>{t('billing.date')}</th>
              <th className={`${thClass} text-right`}>{t('billing.amount')}</th>
              <th className={`${thClass} text-right`}>{t('billing.paid')}</th>
              <th className={`${thClass} text-right`}>{t('billing.balance')}</th>
              <th className={`${thClass} text-right`}>{t('ar.daysOutstanding')}</th>
            </tr>
          </thead>
          <tbody className={tableBodyClass}>
            {query.isLoading ? <SkeletonRows columns={8} /> : null}
            {items.map((inv) => (
              <tr key={inv.id} className={tableRowClass}>
                <td className={tdClass} data-title>
                  <Link to={`/billing/${inv.id}/invoice`} className="font-mono font-medium text-brand-700 hover:underline">
                    {inv.invoiceNo}
                  </Link>
                </td>
                <td className={`${tdClass} font-mono`} data-label="HN">
                  {inv.hn}
                </td>
                <td className={tdClass} data-label={t('patient.name')}>
                  {inv.patientName}
                </td>
                <td className={`${tdClass} text-ink-muted`} data-label={t('billing.date')}>
                  {formatDate(inv.issuedAt)}
                </td>
                <td className={`${tdClass} text-right`} data-label={t('billing.amount')}>
                  {formatMoney(inv.amount)}
                </td>
                <td className={`${tdClass} text-right`} data-label={t('billing.paid')}>
                  {formatMoney(inv.paid)}
                </td>
                <td className={`${tdClass} text-right font-semibold text-red-600`} data-label={t('billing.balance')}>
                  {formatMoney(inv.balance)}
                </td>
                <td className={`${tdClass} text-right`} data-label={t('ar.daysOutstanding')}>
                  {formatNumber(inv.daysOutstanding)}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
    </div>
  )
}
