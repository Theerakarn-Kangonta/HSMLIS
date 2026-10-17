import { Plus, X } from 'lucide-react'
import { CrudPage } from '../../components/CrudPage'
import { Button, Checkbox, ColorDot, Field, IconButton, Input, Select } from '../../components/ui'
import { api, RESULT_TYPES, type LabTest, type LabTestInput, type ReferenceRange, type ResultType, type Sex } from '../../lib/api'
import { useDepartments, useSpecimenTypes } from '../../lib/catalog'
import { useI18n } from '../../lib/i18n'
import { describe } from '../../lib/results'

const emptyRange: ReferenceRange = { sex: null, ageMinYears: null, ageMaxYears: null, low: null, high: null, criticalLow: null, criticalHigh: null, normalText: null }
const num = (s: string) => (s.trim() === '' ? null : Number(s))

export function LabTestsPage() {
  const { t, formatMoney } = useI18n()
  const departments = useDepartments()
  const specimens = useSpecimenTypes()

  return (
    <CrudPage<LabTest, LabTestInput>
      title={t('tests.title')}
      description={t('tests.subtitle')}
      queryKey="lab-tests"
      service={api.labTests}
      addLabel={t('tests.add')}
      dialogSize="lg"
      blank={{
        code: '',
        departmentId: departments.data?.[0]?.id ?? '',
        nameEn: '',
        nameTh: null,
        specimenTypeId: specimens.data?.[0]?.id ?? '',
        unit: null,
        price: 0,
        resultType: 'Numeric',
        options: [],
        decimals: 1,
        tatTargetHours: 24,
        repeatBlockDays: 0,
        alertOnPositive: false,
        referenceRanges: [],
        isActive: true,
        sortOrder: 0,
      }}
      toInput={({ id: _id, departmentName: _d, departmentColor: _c, specimenName: _s, ...rest }) => rest}
      matches={(x, q) => `${x.code} ${x.nameEn} ${x.nameTh ?? ''} ${x.departmentName}`.toLowerCase().includes(q)}
      columns={[
        { header: t('common.code'), cell: (x) => <span className="font-mono">{x.code}</span>, title: true },
        {
          header: 'Test Name',
          cell: (x) => (
            <span>
              {x.nameEn}
              {x.nameTh ? <span className="block text-xs text-ink-muted">{x.nameTh}</span> : null}
            </span>
          ),
        },
        {
          header: t('test.department'),
          cell: (x) => (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <ColorDot color={x.departmentColor} />
              {x.departmentName}
            </span>
          ),
        },
        { header: t('specimen.type'), cell: (x) => <span className="text-xs">{x.specimenName}</span> },
        { header: t('tests.resultType'), cell: (x) => <span className="text-xs">{t(`resultType.${x.resultType}`)}</span> },
        { header: t('result.reference'), cell: (x) => <span className="text-xs text-ink-muted">{x.referenceRanges.map((r) => describe(r)).filter(Boolean).join(' / ') || '–'}</span> },
        { header: t('test.price'), cell: (x) => formatMoney(x.price), className: 'text-right' },
      ]}
      form={(v, set) => {
        const setRange = (index: number, patch: Partial<ReferenceRange>) => set({ referenceRanges: v.referenceRanges.map((r, i) => (i === index ? { ...r, ...patch } : r)) })
        const takesOptions = v.resultType !== 'Numeric' && v.resultType !== 'Text'
        return (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('common.code')}>
                <Input value={v.code} onChange={(e) => set({ code: e.target.value })} required maxLength={30} />
              </Field>
              <Field label={t('test.department')}>
                <Select value={v.departmentId} onChange={(e) => set({ departmentId: e.target.value })} required>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} · {d.nameEn}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('specimen.type')}>
                <Select value={v.specimenTypeId} onChange={(e) => set({ specimenTypeId: e.target.value })} required>
                  {(specimens.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.nameEn}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Test Name (English)" className="sm:col-span-2">
                <Input value={v.nameEn} onChange={(e) => set({ nameEn: e.target.value })} required maxLength={200} />
              </Field>
              <Field label={t('tests.nameTh')}>
                <Input value={v.nameTh ?? ''} onChange={(e) => set({ nameTh: e.target.value || null })} maxLength={200} />
              </Field>
              <Field label={t('test.unit')}>
                <Input value={v.unit ?? ''} onChange={(e) => set({ unit: e.target.value || null })} maxLength={30} />
              </Field>
              <Field label={t('tests.priceBaht')}>
                <Input type="number" min={0} step="0.01" value={v.price} onChange={(e) => set({ price: Number(e.target.value) })} />
              </Field>
              <Field label={t('tests.tatTarget')}>
                <Input type="number" min={1} value={v.tatTargetHours} onChange={(e) => set({ tatTargetHours: Number(e.target.value) })} />
              </Field>
              <Field label={t('tests.resultType')}>
                <Select value={v.resultType} onChange={(e) => set({ resultType: e.target.value as ResultType })}>
                  {RESULT_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {t(`resultType.${r}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('tests.decimals')}>
                <Input type="number" min={0} max={6} value={v.decimals} onChange={(e) => set({ decimals: Number(e.target.value) })} />
              </Field>
              <Field label={t('tests.sortOrder')}>
                <Input type="number" min={0} value={v.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
              </Field>
              {takesOptions ? (
                <Field label={t('tests.options')} hint={t('tests.optionsHint')} className="sm:col-span-3">
                  <Input
                    defaultValue={v.options.join(', ')}
                    onBlur={(e) => set({ options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })}
                    placeholder="Negative, Positive"
                  />
                </Field>
              ) : null}
            </div>

            <div className="rounded-lg border border-rule p-4">
              <p className="mb-3 text-sm font-semibold text-ink">{t('tests.alertsTitle')}</p>
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Field label={t('tests.repeatBlock')}>
                  <Input type="number" min={0} value={v.repeatBlockDays} onChange={(e) => set({ repeatBlockDays: Number(e.target.value) })} />
                </Field>
                <div className="flex items-end pb-2 sm:col-span-2">
                  <Checkbox label={t('tests.alertOnPositive')} checked={v.alertOnPositive} onChange={(e) => set({ alertOnPositive: e.target.checked })} />
                </div>
              </div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-muted">{t('tests.ranges')}</p>
                <Button size="sm" variant="secondary" onClick={() => set({ referenceRanges: [...v.referenceRanges, emptyRange] })}>
                  <Plus className="size-4" />
                  {t('tests.addRange')}
                </Button>
              </div>
              {v.referenceRanges.length === 0 ? <p className="text-xs text-ink-muted">{t('tests.noRanges')}</p> : null}
              <div className="space-y-2">
                {v.referenceRanges.map((r, i) => (
                  <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-md bg-page p-2 sm:grid-cols-[6rem_repeat(6,minmax(0,1fr))_auto]">
                    <Field label={t('patient.sex')}>
                      <Select value={r.sex ?? ''} onChange={(e) => setRange(i, { sex: (e.target.value || null) as Sex | null })}>
                        <option value="">{t('tests.bothSexes')}</option>
                        <option value="Male">{t('sex.Male')}</option>
                        <option value="Female">{t('sex.Female')}</option>
                      </Select>
                    </Field>
                    <Field label={t('tests.ageFrom')}>
                      <Input inputMode="numeric" value={r.ageMinYears ?? ''} onChange={(e) => setRange(i, { ageMinYears: num(e.target.value) })} />
                    </Field>
                    <Field label={t('tests.ageTo')}>
                      <Input inputMode="numeric" value={r.ageMaxYears ?? ''} onChange={(e) => setRange(i, { ageMaxYears: num(e.target.value) })} />
                    </Field>
                    <Field label="Min">
                      <Input inputMode="decimal" value={r.low ?? ''} onChange={(e) => setRange(i, { low: num(e.target.value) })} />
                    </Field>
                    <Field label="Max">
                      <Input inputMode="decimal" value={r.high ?? ''} onChange={(e) => setRange(i, { high: num(e.target.value) })} />
                    </Field>
                    <Field label="Crit Low">
                      <Input inputMode="decimal" value={r.criticalLow ?? ''} onChange={(e) => setRange(i, { criticalLow: num(e.target.value) })} />
                    </Field>
                    <Field label="Crit High">
                      <Input inputMode="decimal" value={r.criticalHigh ?? ''} onChange={(e) => setRange(i, { criticalHigh: num(e.target.value) })} />
                    </Field>
                    <IconButton label={t('common.remove')} danger onClick={() => set({ referenceRanges: v.referenceRanges.filter((_, j) => j !== i) })}>
                      <X className="size-4" />
                    </IconButton>
                    {v.resultType !== 'Numeric' ? (
                      <Field label={t('tests.normalText')} className="col-span-2 sm:col-span-8">
                        <Input value={r.normalText ?? ''} onChange={(e) => setRange(i, { normalText: e.target.value || null })} maxLength={80} placeholder="Negative" />
                      </Field>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <Checkbox label={t('common.active')} checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
          </div>
        )
      }}
    />
  )
}
