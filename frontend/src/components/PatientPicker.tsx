import { useQuery } from '@tanstack/react-query'
import { UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { api, type Patient } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { Badge, LinkButton, SearchInput, useDebounced } from './ui'

/** Finds a patient by HN or name, or shows the recent ones; the chosen one becomes a chip. */
export function PatientPicker({ value, onChange, registerHref }: { value: Patient | null; onChange: (patient: Patient | null) => void; registerHref: string }) {
  const { t, formatDate } = useI18n()
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const found = useQuery({ queryKey: ['patients', debounced, 1, 8], queryFn: () => api.patients({ search: debounced, page: 1, pageSize: 8 }), enabled: debounced.trim().length >= 2 })
  const recent = useQuery({ queryKey: ['patients-recent'], queryFn: api.recentPatients, enabled: !value })

  if (value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{value.fullName}</p>
          <p className="text-xs text-ink-muted">
            HN <span className="font-mono">{value.hn}</span>
            {value.ageYears !== null ? ` · ${t('patient.ageYears', { n: value.ageYears })}` : ''} · {t(`sex.${value.sex}`)}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface hover:text-ink" aria-label={t('order.changePatient')} title={t('order.changePatient')}>
          <X className="size-4" />
        </button>
      </div>
    )
  }

  const list = debounced.trim().length >= 2 ? found.data?.items : recent.data
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder={t('order.findPatient')} className="min-w-56 flex-1" autoFocus />
        <LinkButton to={registerHref} variant="secondary">
          <UserPlus className="size-4" />
          {t('patients.register')}
        </LinkButton>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-ink-muted">{debounced.trim().length >= 2 ? t('order.searchResults') : t('order.recentPatients')}</p>
        {list && list.length === 0 ? <p className="text-sm text-ink-muted">{t('common.noMatches')}</p> : null}
        <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule">
          {list?.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onChange(p)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-page">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{p.fullName}</span>
                  <span className="ml-2 text-xs text-ink-muted">{p.ageYears !== null ? t('patient.ageYears', { n: p.ageYears }) : ''}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
                  <Badge>
                    <span className="font-mono">{p.hn}</span>
                  </Badge>
                  {formatDate(p.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
