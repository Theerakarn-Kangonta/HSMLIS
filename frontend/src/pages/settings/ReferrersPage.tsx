import { CrudPage } from '../../components/CrudPage'
import { Badge, Checkbox, Field, Input, Select } from '../../components/ui'
import { api, REFERRER_TYPES, type Referrer, type ReferrerInput, type ReferrerType } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function ReferrersPage() {
  const { t } = useI18n()
  return (
    <CrudPage<Referrer, ReferrerInput>
      title={t('referrers.title')}
      description={t('referrers.subtitle')}
      queryKey="referrers"
      service={api.referrers}
      addLabel={t('referrers.add')}
      blank={{ code: '', name: '', type: 'Hospital', address: null, contact: null, phone: null, isActive: true }}
      toInput={({ id: _id, ...rest }) => rest}
      matches={(r, q) => `${r.code} ${r.name} ${r.address ?? ''}`.toLowerCase().includes(q)}
      columns={[
        {
          header: t('referrers.name'),
          title: true,
          cell: (r) => (
            <span>
              <span className="font-medium text-ink">{r.name}</span>
              {r.address ? <span className="block text-xs text-ink-muted">{r.address}</span> : null}
            </span>
          ),
        },
        { header: t('referrers.code'), cell: (r) => <span className="font-mono">{r.code}</span> },
        { header: t('referrers.type'), cell: (r) => <Badge tone="accent">{t(`referrerType.${r.type}`)}</Badge> },
        { header: t('referrers.contact'), cell: (r) => <span className="text-xs text-ink-muted">{[r.contact, r.phone].filter(Boolean).join(' · ') || '–'}</span> },
      ]}
      form={(v, set) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('referrers.code')} hint={t('referrers.codeHint')}>
            <Input value={v.code} onChange={(e) => set({ code: e.target.value })} required maxLength={20} />
          </Field>
          <Field label={t('referrers.type')}>
            <Select value={v.type} onChange={(e) => set({ type: e.target.value as ReferrerType })}>
              {REFERRER_TYPES.map((x) => (
                <option key={x} value={x}>
                  {t(`referrerType.${x}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('referrers.name')} className="sm:col-span-2">
            <Input value={v.name} onChange={(e) => set({ name: e.target.value })} required maxLength={200} />
          </Field>
          <Field label={t('patient.address')} className="sm:col-span-2">
            <Input value={v.address ?? ''} onChange={(e) => set({ address: e.target.value || null })} maxLength={400} />
          </Field>
          <Field label={t('referrers.contact')}>
            <Input value={v.contact ?? ''} onChange={(e) => set({ contact: e.target.value || null })} maxLength={120} />
          </Field>
          <Field label={t('patient.phone')}>
            <Input value={v.phone ?? ''} onChange={(e) => set({ phone: e.target.value || null })} maxLength={40} />
          </Field>
          <Checkbox label={t('common.active')} checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
        </div>
      )}
    />
  )
}
