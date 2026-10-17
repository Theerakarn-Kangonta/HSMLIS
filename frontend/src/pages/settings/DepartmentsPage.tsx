import { CrudPage } from '../../components/CrudPage'
import { Checkbox, ColorDot, Field, Input, Textarea } from '../../components/ui'
import { api, type Department, type DepartmentInput } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function DepartmentsPage() {
  const { t } = useI18n()
  return (
    <CrudPage<Department, DepartmentInput>
      title={t('departments.title')}
      description={t('departments.subtitle')}
      queryKey="departments"
      service={api.departments}
      addLabel={t('departments.add')}
      blank={{ code: '', nameEn: '', nameTh: null, color: '#4f46e5', description: null, isActive: true }}
      toInput={({ id: _id, ...rest }) => rest}
      matches={(d, q) => `${d.code} ${d.nameEn} ${d.nameTh ?? ''}`.toLowerCase().includes(q)}
      columns={[
        { header: t('common.code'), cell: (d) => <span className="font-mono">{d.code}</span>, title: true },
        { header: 'Department Name (EN)', cell: (d) => d.nameEn },
        { header: t('departments.nameTh'), cell: (d) => d.nameTh ?? '–' },
        {
          header: t('departments.color'),
          cell: (d) => (
            <span className="inline-flex items-center gap-2 font-mono text-xs text-ink-muted">
              <ColorDot color={d.color} className="size-3.5" />
              {d.color}
            </span>
          ),
        },
      ]}
      form={(v, set) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.code')}>
            <Input value={v.code} onChange={(e) => set({ code: e.target.value })} required maxLength={20} />
          </Field>
          <Field label={t('departments.color')}>
            <Input type="color" value={v.color} onChange={(e) => set({ color: e.target.value })} className="p-1" />
          </Field>
          <Field label="Department Name (English)" className="sm:col-span-2">
            <Input value={v.nameEn} onChange={(e) => set({ nameEn: e.target.value })} required maxLength={120} />
          </Field>
          <Field label={t('departments.nameTh')} className="sm:col-span-2">
            <Input value={v.nameTh ?? ''} onChange={(e) => set({ nameTh: e.target.value || null })} maxLength={120} />
          </Field>
          <Field label={t('common.description')} className="sm:col-span-2">
            <Textarea value={v.description ?? ''} onChange={(e) => set({ description: e.target.value || null })} maxLength={500} rows={2} />
          </Field>
          <Checkbox label={t('common.active')} checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
        </div>
      )}
    />
  )
}
