import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Badge, Card, DataTable, EmptyState, ErrorNote, Field, Input, PageHeader, Pager, SearchInput, Select, SkeletonRows, Toolbar, tableBodyClass, tableHeadClass, tableRowClass, tdClass, thClass, useDebounced } from '../../components/ui'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

const TYPES = ['auth', 'user', 'patient', 'order', 'invoice', 'organization', 'department', 'specimen', 'test', 'package', 'referrer', 'branch']

export function AuditLogPage() {
  const { t, formatDateTime } = useI18n()
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const debounced = useDebounced(search)
  const query = useQuery({
    queryKey: ['audit', debounced, entityType, from, to, page, pageSize],
    queryFn: () => api.audit({ search: debounced, entityType, from: from || undefined, to: to || undefined, page, pageSize }),
    placeholderData: (previous) => previous,
  })

  return (
    <div className="space-y-4">
      <PageHeader title={t('audit.title')} description={t('audit.subtitle')} />
      <Card>
        <Toolbar>
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder={t('audit.searchPlaceholder')} className="w-full max-w-sm" />
          <Field label={t('audit.type')}>
            <Select value={entityType} onChange={(e) => (setEntityType(e.target.value), setPage(1))} className="w-40">
              <option value="">{t('common.all')}</option>
              {TYPES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('filter.from')}>
            <Input type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} className="w-40" />
          </Field>
          <Field label={t('filter.to')}>
            <Input type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} className="w-40" />
          </Field>
        </Toolbar>
        <ErrorNote error={query.error} />
        {query.data && query.data.total === 0 ? (
          <EmptyState icon={ShieldCheck} title={t('common.noMatches')} />
        ) : (
          <DataTable>
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>{t('audit.at')}</th>
                <th className={thClass}>{t('audit.user')}</th>
                <th className={thClass}>{t('audit.action')}</th>
                <th className={thClass}>{t('audit.type')}</th>
                <th className={thClass}>{t('audit.detail')}</th>
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {query.isLoading ? <SkeletonRows columns={5} /> : null}
              {query.data?.items.map((a) => (
                <tr key={a.id} className={tableRowClass}>
                  <td className={`${tdClass} whitespace-nowrap text-ink-muted`} data-title>
                    {formatDateTime(a.at)}
                  </td>
                  <td className={tdClass} data-label={t('audit.user')}>
                    {a.userName}
                  </td>
                  <td className={tdClass} data-label={t('audit.action')}>
                    <Badge tone={a.action.includes('delete') || a.action.includes('cancel') || a.action.includes('reject') ? 'danger' : 'accent'}>{a.action}</Badge>
                  </td>
                  <td className={`${tdClass} text-ink-muted`} data-label={t('audit.type')}>
                    {a.entityType}
                  </td>
                  <td className={`${tdClass} max-w-md text-xs text-ink-muted`} data-label={t('audit.detail')}>
                    {a.detail ?? '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        <Pager page={page} pageSize={pageSize} total={query.data?.total ?? 0} onPage={setPage} onPageSize={(s) => (setPageSize(s), setPage(1))} />
      </Card>
    </div>
  )
}
