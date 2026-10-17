import { CrudPage } from '../../components/CrudPage'
import { Checkbox, Field, Input, Textarea } from '../../components/ui'
import { api, type SpecimenType, type SpecimenTypeInput } from '../../lib/api'
import { useI18n } from '../../lib/i18n'

export function SpecimensPage() {
  const { t } = useI18n()
  return (
    <CrudPage<SpecimenType, SpecimenTypeInput>
      title={t('specimens.title')}
      description={t('specimens.subtitle')}
      queryKey="specimen-types"
      service={api.specimenTypes}
      addLabel={t('specimens.add')}
      blank={{ code: '', nameEn: '', nameTh: null, containerType: null, collectionRequirements: null, preservation: null, isActive: true }}
      toInput={({ id: _id, ...rest }) => rest}
      matches={(s, q) => `${s.code} ${s.nameEn} ${s.nameTh ?? ''}`.toLowerCase().includes(q)}
      columns={[
        { header: t('common.code'), cell: (s) => <span className="font-mono">{s.code}</span>, title: true },
        { header: 'Name (EN)', cell: (s) => s.nameEn },
        { header: t('specimens.nameTh'), cell: (s) => s.nameTh ?? '–' },
        { header: t('specimen.containerType'), cell: (s) => s.containerType ?? '–' },
        { header: t('specimens.requirements'), cell: (s) => <span className="text-xs text-ink-muted">{s.collectionRequirements ?? '–'}</span> },
        { header: t('specimens.preservation'), cell: (s) => <span className="text-xs text-ink-muted">{s.preservation ?? '–'}</span> },
      ]}
      form={(v, set) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.code')}>
            <Input value={v.code} onChange={(e) => set({ code: e.target.value })} required maxLength={20} />
          </Field>
          <Field label={t('specimen.containerType')}>
            <Input value={v.containerType ?? ''} onChange={(e) => set({ containerType: e.target.value || null })} maxLength={80} placeholder="Lavender top" />
          </Field>
          <Field label="Name (English)">
            <Input value={v.nameEn} onChange={(e) => set({ nameEn: e.target.value })} required maxLength={120} />
          </Field>
          <Field label={t('specimens.nameTh')}>
            <Input value={v.nameTh ?? ''} onChange={(e) => set({ nameTh: e.target.value || null })} maxLength={120} />
          </Field>
          <Field label={t('specimens.requirements')} className="sm:col-span-2">
            <Textarea value={v.collectionRequirements ?? ''} onChange={(e) => set({ collectionRequirements: e.target.value || null })} maxLength={500} rows={2} />
          </Field>
          <Field label={t('specimens.preservation')} className="sm:col-span-2">
            <Textarea value={v.preservation ?? ''} onChange={(e) => set({ preservation: e.target.value || null })} maxLength={500} rows={2} />
          </Field>
          <Checkbox label={t('common.active')} checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
        </div>
      )}
    />
  )
}
