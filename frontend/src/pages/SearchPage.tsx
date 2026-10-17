import { useQuery } from '@tanstack/react-query'
import { ScanBarcode } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { OrderTable } from '../components/OrderTable'
import { Button, Callout, Card, EmptyState, ErrorNote, PageHeader, SearchInput } from '../components/ui'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'

export function SearchPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [text, setText] = useState(q)

  const result = useQuery({ queryKey: ['search', q], queryFn: () => api.search(q), enabled: q.length >= 2 })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    setParams(value ? { q: value } : {})
    // A barcode reader types the LSN and Enter: go straight to that order.
    if (value.length >= 2) {
      const found = await api.search(value).catch(() => null)
      if (found?.matchedLsn && found.orders.length === 1) navigate(`/lab-orders/${found.orders[0].id}`)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t('search.title')} description={t('search.subtitle')} />
      <Card className="p-5">
        <form onSubmit={submit} className="flex flex-wrap gap-3">
          <SearchInput value={text} onChange={setText} large autoFocus placeholder={t('search.placeholder')} className="min-w-64 flex-1" aria-label={t('search.placeholder')} />
          <Button type="submit" size="lg">
            {t('common.search')}
          </Button>
        </form>
      </Card>
      <ErrorNote error={result.error} />
      {q.length < 2 ? (
        <Card>
          <EmptyState icon={ScanBarcode} title={t('search.emptyTitle')} hint={t('search.emptyHint')} />
        </Card>
      ) : (
        <Card>
          {result.data?.matchedLsn ? (
            <div className="p-4">
              <Callout tone="success">{t('search.matchedLsn', { lsn: result.data.matchedLsn })}</Callout>
            </div>
          ) : null}
          {result.data && result.data.orders.length === 0 ? (
            <EmptyState icon={ScanBarcode} title={t('search.noneTitle')} hint={t('search.noneHint')} />
          ) : (
            <OrderTable orders={result.data?.orders} loading={result.isLoading} />
          )}
        </Card>
      )}
    </div>
  )
}
