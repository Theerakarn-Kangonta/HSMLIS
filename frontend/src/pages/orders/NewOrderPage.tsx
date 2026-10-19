import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, PackageOpen, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PatientPicker } from '../../components/PatientPicker'
import { Badge, Button, Card, CardHeader, Checkbox, ColorDot, ErrorNote, Field, Input, PageHeader, SearchInput, Select, Textarea, focusRing, useToast } from '../../components/ui'
import { api, type Patient } from '../../lib/api'
import { useDepartments, useLabTests, usePackages, useReferrers } from '../../lib/catalog'
import { useI18n } from '../../lib/i18n'

/**
 * Limits a sticky side panel to the visible part of the window below its top edge, so its bottom
 * (the Confirm button) is always on screen. Only applies at the xl breakpoint, where the panel is sticky.
 */
function useFitToWindow<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wide = window.matchMedia('(min-width: 80rem)')
    const fit = () => {
      el.style.maxHeight = wide.matches ? `${window.innerHeight - el.getBoundingClientRect().top - 16}px` : ''
    }
    fit()
    window.addEventListener('scroll', fit, { passive: true })
    window.addEventListener('resize', fit)
    wide.addEventListener('change', fit)
    return () => {
      window.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
      wide.removeEventListener('change', fit)
    }
  }, [])
  return ref
}

const ENTITLEMENTS =['ชำระเงินเอง', 'บัตรทอง (UC)', 'ประกันสังคม', 'ข้าราชการ', 'ต้นสังกัด', 'อื่น ๆ']

const num = (s: string) => (s.trim() === '' ? null : Number(s))

export function NewOrderPage() {
  const { t, formatMoney } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const presetPatient = params.get('patientId')

  const tests = useLabTests()
  const packages = usePackages()
  const departments = useDepartments()
  const referrers = useReferrers()

  // Coming from a patient's page (or after registering one) starts with that patient chosen.
  const preset = useQuery({ queryKey: ['patient', presetPatient], queryFn: () => api.patient(presetPatient!), enabled: !!presetPatient })
  const [picked, setPicked] = useState<Patient | null | undefined>(undefined)
  const patient = picked === undefined ? (preset.data ?? null) : picked
  const setPatient = (p: Patient | null) => setPicked(p)

  const [visit, setVisit] = useState({ referrerId: '', referrerRef: '', entitlement: ENTITLEMENTS[0], bpSys: '', bpDia: '', hr: '', temp: '', weight: '', height: '' })
  const [packageIds, setPackageIds] = useState<string[]>([])
  const [testIds, setTestIds] = useState<string[]>([])
  const [urgent, setUrgent] = useState(false)
  const [diagnosis, setDiagnosis] = useState('')
  const [note, setNote] = useState('')
  const [discount, setDiscount] = useState('')
  const [packageSearch, setPackageSearch] = useState('')
  const [packagesOpen, setPackagesOpen] = useState(true)
  const [testSearch, setTestSearch] = useState('')
  const [department, setDepartment] = useState('')

  const testsById = useMemo(() => new Map((tests.data ?? []).map((x) => [x.id, x])), [tests.data])
  const chosenPackages = (packages.data ?? []).filter((p) => packageIds.includes(p.id))
  const inPackage = new Set(chosenPackages.flatMap((p) => p.testIds))
  const standalone = testIds.filter((id) => !inPackage.has(id))
  const subtotal = chosenPackages.reduce((s, p) => s + p.price, 0) + standalone.reduce((s, id) => s + (testsById.get(id)?.price ?? 0), 0)
  const discountPercent = Math.min(100, Math.max(0, Number(discount) || 0))
  // Mirrors OrderRules.OrderDiscount on the server.
  const discountValue = Math.round(subtotal * discountPercent) / 100
  const total = subtotal - discountValue
  const itemCount = inPackage.size + standalone.length

  const bmi = (() => {
    const w = num(visit.weight)
    const h = num(visit.height)
    return w && h ? Math.round((w / (h / 100) ** 2) * 10) / 10 : null
  })()

  const activeTests = (tests.data ?? []).filter((x) => x.isActive)
  const countByDept = new Map<string, number>()
  activeTests.forEach((x) => countByDept.set(x.departmentId, (countByDept.get(x.departmentId) ?? 0) + 1))
  const needle = testSearch.trim().toLowerCase()
  const visibleTests = activeTests.filter(
    (x) => (!department || x.departmentId === department) && (!needle || `${x.code} ${x.nameEn} ${x.nameTh ?? ''}`.toLowerCase().includes(needle)),
  )
  const packNeedle = packageSearch.trim().toLowerCase()
  const visiblePackages = (packages.data ?? []).filter((p) => p.isActive && (!packNeedle || `${p.code} ${p.nameTh} ${p.nameEn ?? ''}`.toLowerCase().includes(packNeedle)))

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const create = useMutation({
    mutationFn: () =>
      api.createOrder({
        patientId: patient!.id,
        referrerId: visit.referrerId || null,
        referrerRef: visit.referrerRef || null,
        entitlement: visit.entitlement || null,
        urgent,
        diagnosis: diagnosis || null,
        note: note || null,
        bpSystolic: num(visit.bpSys),
        bpDiastolic: num(visit.bpDia),
        heartRate: num(visit.hr),
        temperatureC: num(visit.temp),
        weightKg: num(visit.weight),
        heightCm: num(visit.height),
        packageIds,
        testIds: standalone,
        discountPercent,
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast(t('order.created', { no: order.orderNo }))
      navigate(`/lab-orders/${order.id}`)
    },
  })

  const setV = (patch: Partial<typeof visit>) => setVisit({ ...visit, ...patch })
  const summaryRef = useFitToWindow<HTMLDivElement>()

  return (
    <div>
      <PageHeader title={t('order.newTitle')} description={t('order.newSubtitle')} back="/lab-orders" />
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader title={`1. ${t('order.stepPatient')}`} />
            <div className="p-5">
              <PatientPicker value={patient} onChange={setPatient} registerHref="/patients/new?then=order" />
            </div>
          </Card>

          <Card>
            <CardHeader title={`2. ${t('order.stepVisit')}`} />
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t('order.referrer')} className="sm:col-span-2">
                <Select value={visit.referrerId} onChange={(e) => setV({ referrerId: e.target.value })}>
                  <option value="">{t('order.noReferrer')}</option>
                  {(referrers.data ?? [])
                    .filter((r) => r.isActive)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} · {r.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={t('order.referrerRef')}>
                <Input value={visit.referrerRef} onChange={(e) => setV({ referrerRef: e.target.value })} maxLength={60} />
              </Field>
              <Field label={t('order.entitlement')}>
                <Select value={visit.entitlement} onChange={(e) => setV({ entitlement: e.target.value })}>
                  {ENTITLEMENTS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t('order.bp')}>
                <div className="flex items-center gap-1.5">
                  <Input inputMode="numeric" placeholder="SYS" value={visit.bpSys} onChange={(e) => setV({ bpSys: e.target.value })} aria-label="SYS" />
                  <span className="text-ink-subtle">/</span>
                  <Input inputMode="numeric" placeholder="DIA" value={visit.bpDia} onChange={(e) => setV({ bpDia: e.target.value })} aria-label="DIA" />
                </div>
              </Field>
              <Field label={t('order.heartRate')}>
                <Input inputMode="numeric" value={visit.hr} onChange={(e) => setV({ hr: e.target.value })} />
              </Field>
              <Field label={t('order.temperature')}>
                <Input inputMode="decimal" value={visit.temp} onChange={(e) => setV({ temp: e.target.value })} />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label={t('order.weight')}>
                  <Input inputMode="decimal" value={visit.weight} onChange={(e) => setV({ weight: e.target.value })} />
                </Field>
                <Field label={t('order.height')}>
                  <Input inputMode="decimal" value={visit.height} onChange={(e) => setV({ height: e.target.value })} />
                </Field>
                <Field label="BMI">
                  <Input value={bmi ?? ''} readOnly tabIndex={-1} className="bg-page" />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={`3. ${t('order.stepPackages')}`}>
              <button type="button" onClick={() => setPackagesOpen(!packagesOpen)} className={`inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink ${focusRing}`} aria-expanded={packagesOpen}>
                {t(packagesOpen ? 'common.collapse' : 'common.expand')}
                <ChevronDown className={`size-4 transition-transform ${packagesOpen ? 'rotate-180' : ''}`} />
              </button>
            </CardHeader>
            {packagesOpen ? (
              <div className="space-y-3 p-5">
                <SearchInput value={packageSearch} onChange={setPackageSearch} placeholder={t('order.searchPackages')} className="max-w-sm" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visiblePackages.map((p) => {
                    const on = packageIds.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPackageIds(toggle(packageIds, p.id))}
                        aria-pressed={on}
                        className={`relative rounded-lg border p-3 text-left transition-colors ${focusRing} ${on ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-rule hover:border-brand-200'}`}
                      >
                        {on ? <Check className="absolute right-2.5 top-2.5 size-4 text-brand-600" aria-hidden /> : null}
                        <p className="font-mono text-xs text-ink-muted">{p.code}</p>
                        <p className="mt-0.5 pr-5 text-sm font-semibold text-ink">{p.nameTh}</p>
                        <p className="mt-2 flex items-baseline justify-between text-xs text-ink-muted">
                          <span>{t('order.testCount', { n: p.testIds.length })}</span>
                          <span className="text-sm font-semibold text-ink">{formatMoney(p.price)}</span>
                        </p>
                        <p className="mt-1.5 truncate text-xs text-ink-subtle">{p.testIds.map((id) => testsById.get(id)?.code).join(', ')}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title={`4. ${t('order.stepTests')}`} />
            <div className="space-y-3 p-5">
              <SearchInput value={testSearch} onChange={setTestSearch} placeholder={t('order.searchTests')} className="max-w-sm" />
              <div className="flex flex-wrap gap-1.5">
                <DeptChip active={!department} onClick={() => setDepartment('')} label={t('common.all')} count={activeTests.length} />
                {(departments.data ?? [])
                  .filter((d) => countByDept.has(d.id))
                  .map((d) => (
                    <DeptChip key={d.id} active={department === d.id} onClick={() => setDepartment(d.id)} label={d.nameEn} count={countByDept.get(d.id) ?? 0} color={d.color} />
                  ))}
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {visibleTests.map((x) => {
                  const packaged = inPackage.has(x.id)
                  const on = packaged || testIds.includes(x.id)
                  return (
                    <div key={x.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${on ? 'border-brand-200 bg-brand-50/60' : 'border-rule'}`}>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-mono text-xs text-ink-muted">
                          <ColorDot color={x.departmentColor} />
                          {x.code}
                        </p>
                        <p className="truncate text-sm font-medium text-ink" title={x.nameEn}>
                          {x.nameEn}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {x.specimenName} · {formatMoney(x.price)}
                        </p>
                      </div>
                      {packaged ? (
                        <Badge tone="accent">{t('order.inPackage')}</Badge>
                      ) : (
                        <Button size="sm" variant={on ? 'secondary' : 'primary'} onClick={() => setTestIds(toggle(testIds, x.id))} aria-pressed={on}>
                          {on ? <Check className="size-4" /> : <Plus className="size-4" />}
                          {t(on ? 'order.added' : 'order.add')}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </div>

        <div ref={summaryRef} className="xl:sticky xl:top-20 xl:flex xl:flex-col">
        <Card className="xl:flex xl:min-h-0 xl:flex-col">
          <CardHeader title={t('order.summary', { n: itemCount })} />
          {/* On wide screens the items and inputs scroll inside the card so the totals and Confirm stay visible. */}
          <div className="space-y-4 p-5 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            {chosenPackages.length === 0 && standalone.length === 0 ? <p className="text-sm text-ink-muted">{t('order.nothingChosen')}</p> : null}
            <ul className="space-y-2">
              {chosenPackages.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <PackageOpen className="mr-1 inline size-4 text-brand-600" aria-hidden />
                    <span className="font-medium text-ink">{p.nameTh}</span>
                    <span className="block pl-5 text-xs text-ink-muted">{p.testIds.map((id) => testsById.get(id)?.code).join(', ')}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {formatMoney(p.price)}
                    <button type="button" onClick={() => setPackageIds(toggle(packageIds, p.id))} className="text-ink-subtle hover:text-red-600" aria-label={t('common.remove')}>
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </li>
              ))}
              {standalone.map((id) => {
                const x = testsById.get(id)
                return (
                  <li key={id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs text-ink-muted">{x?.code}</span> {x?.nameEn}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {formatMoney(x?.price ?? 0)}
                      <button type="button" onClick={() => setTestIds(toggle(testIds, id))} className="text-ink-subtle hover:text-red-600" aria-label={t('common.remove')}>
                        <Trash2 className="size-4" />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="space-y-3 border-t border-rule pt-4">
              <Checkbox label={<span className="font-medium text-red-700">{t('order.urgentLabel')}</span>} checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              <Field label={t('order.diagnosis')}>
                <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} maxLength={500} rows={2} />
              </Field>
              <Field label={t('common.note')}>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
              </Field>
              <Field label={t('order.discountPercent')}>
                <Input type="number" min={0} max={100} step="0.01" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              </Field>
            </div>
          </div>
          <div className="space-y-4 border-t border-rule p-5 xl:shrink-0">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between text-ink-muted">
                <dt>{t('order.subtotal')}</dt>
                <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-ink-muted">
                <dt>{t('order.discount')}</dt>
                <dd className="tabular-nums">−{formatMoney(discountValue)}</dd>
              </div>
              <div className="flex justify-between pt-1 text-base font-semibold text-ink">
                <dt>{t('order.net')}</dt>
                <dd className="tabular-nums">{formatMoney(total)}</dd>
              </div>
            </dl>
            <ErrorNote error={create.error} />
            <Button size="lg" className="w-full" disabled={!patient || itemCount === 0} loading={create.isPending} onClick={() => create.mutate()}>
              {t('order.confirm')}
            </Button>
            {!patient ? <p className="text-center text-xs text-ink-muted">{t('order.needPatient')}</p> : null}
          </div>
        </Card>
        </div>
      </div>
    </div>
  )
}

function DeptChip({ active, onClick, label, count, color }: { active: boolean; onClick: () => void; label: string; count: number; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${focusRing} ${
        active ? 'border-brand-600 bg-brand-600 text-white' : 'border-rule bg-surface text-ink-muted hover:text-ink'
      }`}
    >
      {color ? <ColorDot color={color} /> : null}
      {label}
      <span className={active ? 'text-brand-100' : 'text-ink-subtle'}>({count})</span>
    </button>
  )
}
