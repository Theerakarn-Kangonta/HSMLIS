import { CrudPage } from '../../components/CrudPage'
import { Checkbox, Field, Input } from '../../components/ui'
import { api, type Branch, type BranchInput } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function BranchesPage() {
  const { t } = useI18n()
  return (
    <CrudPage<Branch, BranchInput>
      title={t('branches.title')}
      description={t('branches.subtitle')}
      queryKey="branches"
      service={api.branches}
      addLabel={t('branches.add')}
      blank={{ code: '', nameTh: '', nameEn: null, address: null, phone: null, email: null, taxId: null, isActive: true }}
      toInput={({ id: _id, ...rest }) => rest}
      matches={(b, q) => `${b.code} ${b.nameTh} ${b.nameEn ?? ''}`.toLowerCase().includes(q)}
      columns={[
        { header: t('common.code'), cell: (b) => <span className="font-mono">{b.code}</span>, title: true },
        { header: t('branches.name'), cell: (b) => b.nameTh },
        { header: t('patient.address'), cell: (b) => <span className="text-xs text-ink-muted">{b.address ?? '–'}</span> },
        { header: t('patient.phone'), cell: (b) => b.phone ?? '–' },
      ]}
      form={(v, set) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.code')}>
            <Input value={v.code} onChange={(e) => set({ code: e.target.value })} required maxLength={20} />
          </Field>
          <Field label={t('patient.phone')}>
            <Input value={v.phone ?? ''} onChange={(e) => set({ phone: e.target.value || null })} maxLength={40} />
          </Field>
          <Field label={t('branches.nameTh')}>
            <Input value={v.nameTh} onChange={(e) => set({ nameTh: e.target.value })} required maxLength={200} />
          </Field>
          <Field label={t('branches.nameEn')}>
            <Input value={v.nameEn ?? ''} onChange={(e) => set({ nameEn: e.target.value || null })} maxLength={200} />
          </Field>
          <Field label={t('patient.address')} className="sm:col-span-2">
            <Input value={v.address ?? ''} onChange={(e) => set({ address: e.target.value || null })} maxLength={400} />
          </Field>
          <Field label={t('patient.email')}>
            <Input type="email" value={v.email ?? ''} onChange={(e) => set({ email: e.target.value || null })} maxLength={254} />
          </Field>
          <Field label={t('org.taxId')}>
            <Input value={v.taxId ?? ''} onChange={(e) => set({ taxId: e.target.value || null })} maxLength={20} />
          </Field>
          <Checkbox label={t('common.active')} checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
        </div>
      )}
    />
  )
}
