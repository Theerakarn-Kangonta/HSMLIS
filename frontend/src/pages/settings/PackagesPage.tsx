import { useState } from 'react'
import { CrudPage } from '../../components/CrudPage'
import { Checkbox, ColorDot, Field, Input, SearchInput, Select, Textarea } from '../../components/ui'
import { api, type DiscountType, type Package, type PackageInput } from '../../lib/api'
import { useLabTests } from '../../lib/catalog'
import { useI18n } from '../../lib/i18n'

export function PackagesPage() {
  const { t, formatMoney } = useI18n()
  return (
    <CrudPage<Package, PackageInput>
      title={t('packages.title')}
      description={t('packages.subtitle')}
      queryKey="packages"
      service={api.packages}
      addLabel={t('packages.add')}
      dialogSize="xl"
      blank={{ code: '', nameTh: '', nameEn: null, description: null, testIds: [], discountType: 'Amount', discountValue: 0, isActive: true }}
      toInput={({ id: _id, listPrice: _l, price: _p, ...rest }) => rest}
      matches={(p, q) => `${p.code} ${p.nameTh} ${p.nameEn ?? ''}`.toLowerCase().includes(q)}
      columns={[
        { header: t('common.code'), cell: (p) => <span className="font-mono">{p.code}</span>, title: true },
        { header: t('packages.nameTh'), cell: (p) => p.nameTh },
        { header: t('packages.nameEn'), cell: (p) => p.nameEn ?? '–' },
        { header: t('packages.testCount'), cell: (p) => p.testIds.length, className: 'text-right' },
        {
          header: t('packages.priceBaht'),
          className: 'text-right',
          cell: (p) => (
            <span>
              {formatMoney(p.price)}
              {p.price !== p.listPrice ? <span className="block text-xs text-ink-subtle line-through">{formatMoney(p.listPrice)}</span> : null}
            </span>
          ),
        },
      ]}
      form={(v, set) => <PackageForm value={v} set={set} />}
    />
  )
}

function PackageForm({ value: v, set }: { value: PackageInput; set: (patch: Partial<PackageInput>) => void }) {
  const { t, formatMoney } = useI18n()
  const tests = useLabTests()
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const all = (tests.data ?? []).filter((x) => x.isActive || v.testIds.includes(x.id))
  const departments = [...new Map(all.map((x) => [x.departmentId, { name: x.departmentName, color: x.departmentColor }])).entries()]
  const needle = search.trim().toLowerCase()
  const shown = all.filter((x) => (!department || x.departmentId === department) && (!needle || `${x.code} ${x.nameEn}`.toLowerCase().includes(needle)))
  const chosen = all.filter((x) => v.testIds.includes(x.id))
  const listPrice = chosen.reduce((s, x) => s + x.price, 0)
  const discount = v.discountType === 'Percent' ? Math.round(listPrice * Math.min(100, v.discountValue)) / 100 : v.discountValue
  const price = Math.max(0, listPrice - discount)
  const toggle = (id: string) => set({ testIds: v.testIds.includes(id) ? v.testIds.filter((x) => x !== id) : [...v.testIds, id] })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder={t('order.searchTests')} />
        <Select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label={t('test.department')}>
          <option value="">{t('packages.allDepartments', { n: all.length })}</option>
          {departments.map(([id, d]) => (
            <option key={id} value={id}>
              {d.name}
            </option>
          ))}
        </Select>
        <ul className="max-h-96 divide-y divide-rule overflow-y-auto rounded-lg border border-rule">
          {shown.map((x) => (
            <li key={x.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-page">
                <input type="checkbox" checked={v.testIds.includes(x.id)} onChange={() => toggle(x.id)} className="size-4 accent-brand-600" />
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-xs text-ink-muted">{x.code}</span> {x.nameEn}
                  <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <ColorDot color={x.departmentColor} />
                    {x.departmentName} · {x.specimenName}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums">{formatMoney(x.price)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('common.code')}>
            <Input value={v.code} onChange={(e) => set({ code: e.target.value })} required maxLength={30} />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox label={t('common.active')} checked={v.isActive} onChange={(e) => set({ isActive: e.target.checked })} />
          </div>
          <Field label={t('packages.nameTh')}>
            <Input value={v.nameTh} onChange={(e) => set({ nameTh: e.target.value })} required maxLength={200} />
          </Field>
          <Field label={t('packages.nameEn')}>
            <Input value={v.nameEn ?? ''} onChange={(e) => set({ nameEn: e.target.value || null })} maxLength={200} />
          </Field>
          <Field label={t('common.description')} className="sm:col-span-2">
            <Textarea value={v.description ?? ''} onChange={(e) => set({ description: e.target.value || null })} maxLength={500} rows={2} />
          </Field>
        </div>
        <div className="rounded-lg border border-rule">
          <p className="border-b border-rule px-3 py-2 text-xs font-semibold text-ink-muted">{t('packages.chosen', { n: chosen.length })}</p>
          <ul className="max-h-44 divide-y divide-rule overflow-y-auto text-sm">
            {chosen.map((x) => (
              <li key={x.id} className="flex justify-between gap-3 px-3 py-1.5">
                <span className="truncate">
                  <span className="font-mono text-xs text-ink-muted">{x.code}</span> {x.nameEn}
                </span>
                <span className="tabular-nums">{formatMoney(x.price)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('packages.discountType')}>
            <Select value={v.discountType} onChange={(e) => set({ discountType: e.target.value as DiscountType })}>
              <option value="Amount">{t('discountType.Amount')}</option>
              <option value="Percent">{t('discountType.Percent')}</option>
            </Select>
          </Field>
          <Field label={t('order.discount')}>
            <Input type="number" min={0} max={v.discountType === 'Percent' ? 100 : undefined} step="0.01" value={v.discountValue} onChange={(e) => set({ discountValue: Number(e.target.value) })} />
          </Field>
        </div>
        <dl className="space-y-1 rounded-lg bg-page p-3 text-sm">
          <div className="flex justify-between text-ink-muted">
            <dt>{t('packages.listPrice')}</dt>
            <dd className="tabular-nums">{formatMoney(listPrice)}</dd>
          </div>
          <div className="flex justify-between text-ink-muted">
            <dt>{t('order.discount')}</dt>
            <dd className="tabular-nums">−{formatMoney(Math.min(listPrice, discount))}</dd>
          </div>
          <div className="flex justify-between font-semibold text-ink">
            <dt>{t('packages.packagePrice')}</dt>
            <dd className="tabular-nums">{formatMoney(price)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
