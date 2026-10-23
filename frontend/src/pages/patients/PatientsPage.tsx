import { useQuery } from '@tanstack/react-query'
import { PatientPhoto } from '../../components/PatientPhoto'
import { Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, DataTable, EmptyState, ErrorNote, LinkButton, PageHeader, Pager, SearchInput, SkeletonRows, Toolbar, tableBodyClass, tableHeadClass, tableRowClass, tdClass, thClass, useDebounced } from '../../components/ui'
import { api } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function PatientsPage() {
  const { t, formatDate } = useI18n()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const debounced = useDebounced(search)
  const query = useQuery({
    queryKey: ['patients', debounced, page, pageSize],
    queryFn: () => api.patients({ search: debounced, page, pageSize }),
    placeholderData: (previous) => previous,
  })

  return (
    <div className="space-y-4">
      <PageHeader title={t('patients.title')} description={t('patients.subtitle')}>
        <LinkButton to="/patients/new">
          <Plus className="size-4" />
          {t('patients.register')}
        </LinkButton>
      </PageHeader>
      <Card>
        <Toolbar>
          <SearchInput value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder={t('patients.searchPlaceholder')} className="w-full max-w-md" />
        </Toolbar>
        <ErrorNote error={query.error} />
        {query.data && query.data.total === 0 ? (
          <EmptyState icon={Users} title={t(debounced ? 'common.noMatches' : 'patients.emptyTitle')} hint={debounced ? t('common.noMatchesHint') : t('patients.emptyHint')}>
            {debounced ? null : <LinkButton to="/patients/new">{t('patients.register')}</LinkButton>}
          </EmptyState>
        ) : (
          <DataTable>
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>HN</th>
                <th className={thClass}>{t('patient.name')}</th>
                <th className={thClass}>{t('patient.citizenId')}</th>
                <th className={thClass}>{t('patient.sexAge')}</th>
                <th className={thClass}>{t('patient.phone')}</th>
                <th className={thClass}>{t('patient.registered')}</th>
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {query.isLoading ? <SkeletonRows columns={6} /> : null}
              {query.data?.items.map((p) => (
                <tr key={p.id} className={`${tableRowClass} cursor-pointer`} onClick={() => navigate(`/patients/${p.id}`)}>
                  <td className={`${tdClass} font-mono font-medium text-brand-700`} data-title>
                    {p.hn}
                  </td>
                  <td className={tdClass} data-label={t('patient.name')}>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <PatientPhoto patientId={p.id} photoAt={p.photoAt} name={p.fullName} />
                      {p.fullName}
                    </span>
                  </td>
                  <td className={`${tdClass} font-mono text-ink-muted`} data-label={t('patient.citizenId')}>
                    {p.citizenId ?? '–'}
                  </td>
                  <td className={tdClass} data-label={t('patient.sexAge')}>
                    {t(`sex.${p.sex}`)}
                    {p.ageYears !== null ? ` · ${t('patient.ageYears', { n: p.ageYears })}` : ''}
                  </td>
                  <td className={`${tdClass} text-ink-muted`} data-label={t('patient.phone')}>
                    {p.phone ?? '–'}
                  </td>
                  <td className={`${tdClass} text-ink-muted`} data-label={t('patient.registered')}>
                    {formatDate(p.createdAt)}
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
