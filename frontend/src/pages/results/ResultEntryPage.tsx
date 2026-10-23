import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChartLine, CheckCheck, ExternalLink, History, Printer, RotateCcw, Save, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FlagBadge, ResultStatusBadge, isCritical } from '../../components/lab'
import {
  Button,
  Card,
  ColorDot,
  DialogActions,
  ErrorNote,
  Field,
  IconButton,
  Input,
  Modal,
  ProgressBar,
  SearchInput,
  Select,
  SkeletonCards,
  Textarea,
  useToast,
} from '../../components/ui'
import { api, type OrderDetail, type OrderItem, type PreviousResult, type ResultActionResponse } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useBackLink } from '../../lib/backLink'
import { useLabTests } from '../../lib/catalog'
import { useI18n } from '../../lib/i18n'
import { describe, evaluate, pickRange } from '../../lib/results'
import { useOrder } from '../orders/OrderDetailPage'
import { PatientBand } from '../../components/PatientBand'

type Draft = { value: string; comment: string }

const draftsOf = (order: OrderDetail): Record<string, Draft> => Object.fromEntries(order.items.map((i) => [i.id, { value: i.value ?? '', comment: i.comment ?? '' }]))
const isOpen = (i: OrderItem) => i.resultStatus !== 'Approved' && i.resultStatus !== 'Cancelled'

export function ResultEntryPage() {
  const { id } = useParams()
  const query = useOrder(id)
  useBackLink('/lab-results')
  if (!query.data) {
    return (
      <div className="space-y-4">
        <ErrorNote error={query.error} />
        {query.isLoading ? <SkeletonCards /> : null}
      </div>
    )
  }
  // Keyed on the version: a fresh copy from the server starts a fresh set of drafts.
  return <Entry key={query.data.version} order={query.data} />
}

function Entry({ order }: { order: OrderDetail }) {
  const { t, formatDateTime, errorText } = useI18n()
  const { can } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const tests = useLabTests()
  const [params, setParams] = useSearchParams()
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => draftsOf(order))
  const [jump, setJump] = useState('')
  const [historyOf, setHistoryOf] = useState<OrderItem | null>(null)
  const [reopen, setReopen] = useState<OrderItem | null>(null)
  const [previousOf, setPreviousOf] = useState<OrderItem | null>(null)
  const [signing, setSigning] = useState(false)
  // The patient's earlier approved results for these tests, newest first.
  const previous = useQuery({ queryKey: ['previous-results', order.id], queryFn: () => api.previousResults(order.id), staleTime: 60_000 })
  const previousByTest = useMemo(() => {
    const map = new Map<string, PreviousResult[]>()
    for (const r of previous.data ?? []) map.set(r.labTestId, [...(map.get(r.labTestId) ?? []), r])
    return map
  }, [previous.data])

  const testsById = useMemo(() => new Map((tests.data ?? []).map((x) => [x.id, x])), [tests.data])
  const received = new Set(order.containers.filter((c) => c.status === 'Received').map((c) => c.id))
  const editable = (i: OrderItem) => can('results.enter') && i.resultStatus !== 'Approved' && i.resultStatus !== 'Cancelled' && !!i.containerId && received.has(i.containerId)
  const dirtyItems = order.items.filter((i) => (drafts[i.id]?.value ?? '') !== (i.value ?? '') || (drafts[i.id]?.comment ?? '') !== (i.comment ?? ''))
  const dirty = dirtyItems.length > 0

  const previewFlag = (i: OrderItem) => {
    const value = drafts[i.id]?.value ?? ''
    if (value === (i.value ?? '')) return i.flag
    const test = testsById.get(i.labTestId)
    return evaluate(i.resultType, value, test ? pickRange(test.referenceRanges, order.patient.sex, order.patient.ageYears) : null)
  }
  const refText = (i: OrderItem) => {
    if (i.refText) return i.refText
    const test = testsById.get(i.labTestId)
    return test ? describe(pickRange(test.referenceRanges, order.patient.sex, order.patient.ageYears)) : null
  }

  const departments = [...new Map(order.items.map((i) => [i.departmentId, { name: i.departmentName, color: i.departmentColor }])).entries()]
  // One department at a time, so a single click never verifies or approves another department's work.
  // The worklist names it (?dep=); otherwise the first one with work left.
  const depId = departments.some(([id]) => id === params.get('dep'))
    ? params.get('dep')!
    : (departments.find(([id]) => order.items.some((i) => i.departmentId === id && isOpen(i)))?.[0] ?? departments[0]?.[0])
  const dep = departments.find(([id]) => id === depId)?.[1]
  const depItems = order.items.filter((i) => i.departmentId === depId)

  const entered = depItems.filter((i) => i.resultStatus !== 'Pending' && i.resultStatus !== 'Cancelled').length
  const active = depItems.filter((i) => i.resultStatus !== 'Cancelled').length
  const flagged = depItems.filter((i) => previewFlag(i) !== 'None').length
  const verifiable = depItems.filter((i) => i.resultStatus === 'Entered').length
  // Approving also verifies, so entered results count too.
  const approvable = depItems.filter((i) => i.resultStatus === 'Entered' || i.resultStatus === 'Verified').length

  const [switchTo, setSwitchTo] = useState<string | null>(null)
  const goToDepartment = (id: string) => {
    setSwitchTo(null)
    setParams({ dep: id }, { replace: true })
    window.scrollTo({ top: 0 })
  }
  const switchDepartment = (id: string) => {
    if (id === depId) return
    if (dirty) setSwitchTo(id)
    else goToDepartment(id)
  }

  const applied = (r: ResultActionResponse) => {
    queryClient.setQueryData(['order', r.order.id], r.order)
    queryClient.invalidateQueries({ queryKey: ['worklist'] })
    queryClient.invalidateQueries({ queryKey: ['results-kpi'] })
  }

  const run = useMutation({
    // Saves what changed first, so verifying or approving always acts on what is on screen.
    // The screen is refreshed once, at the end, with the order as the last call returned it.
    mutationFn: async ({ action, licenseNo = '' }: { action: 'save' | 'verify' | 'approve'; licenseNo?: string }) => {
      let version = order.version
      let saved: ResultActionResponse | null = null
      if (dirty) {
        saved = await api.saveResults(order.id, version, dirtyItems.map((i) => ({ itemId: i.id, value: drafts[i.id].value || null, comment: drafts[i.id].comment || null })))
        version = saved.order.version
      }
      if (action === 'save') return { action, response: saved }
      const ids = depItems.map((i) => i.id)
      const response = action === 'verify' ? await api.verifyResults(order.id, version, ids) : await api.approveResults(order.id, version, ids, licenseNo)
      return { action, response }
    },
    onSuccess: ({ action, response }) => {
      if (response) applied(response)
      if (action === 'save') toast(t('result.savedToast'))
      if (action === 'verify') toast(t('result.verifiedToast', { n: response!.done }))
      if (action === 'approve') {
        setSigning(false)
        toast(t('result.approvedToast', { n: response!.done }))
        // This department is signed off: back to the worklist for the next one.
        if (!response!.order.items.some((i) => i.departmentId === depId && isOpen(i))) navigate('/lab-results')
      }
    },
    onError: (error) => {
      toast(errorText(error), 'error')
      queryClient.invalidateQueries({ queryKey: ['order', order.id] })
    },
  })

  const focusNext = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const inputs = [...document.querySelectorAll<HTMLElement>('[data-result-input]:not([disabled])')]
    inputs[inputs.indexOf(e.currentTarget) + 1]?.focus()
  }

  const setDraft = (itemId: string, patch: Partial<Draft>) => setDrafts({ ...drafts, [itemId]: { ...drafts[itemId], ...patch } })
  const needle = jump.trim().toLowerCase()

  return (
    <div className="pb-24">
      <h1 className="sr-only">{order.patient.fullName}</h1>
      <PatientBand patient={order.patient} urgent={order.urgent} critical={order.items.some((i) => isCritical(i.flag))} />
      <div className="mb-4 mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          {dep ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface px-2.5 py-0.5 font-semibold text-ink">
              <ColorDot color={dep.color} />
              {dep.name}
            </span>
          ) : null}
          <span className="font-mono">{order.orderNo}</span> · {formatDateTime(order.orderedAt)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to={`/patients/${order.patient.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            {t('result.patientHistory')} <ExternalLink className="size-3.5" />
          </Link>
          <Link to={`/lab-orders/${order.id}/specimen-labels`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            <Printer className="size-3.5" /> {t('order.printLabels')}
          </Link>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[15rem_1fr]">
        <Card className="lg:sticky lg:top-36">
          <div className="space-y-3 p-4">
            <SearchInput value={jump} onChange={setJump} placeholder={t('result.jump')} />
            <p className="text-xs text-ink-muted">{t('result.enteredOf', { n: entered, total: active })}</p>
            <ProgressBar value={entered} max={active} />
            <ul className="space-y-3 text-sm">
              {departments.map(([id, d]) => {
                const items = order.items.filter((i) => i.departmentId === id && i.resultStatus !== 'Cancelled')
                const done = items.filter((i) => i.resultStatus !== 'Pending').length
                const selected = id === depId
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => switchDepartment(id)}
                      aria-current={selected ? 'true' : undefined}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left font-medium ${selected ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-ink hover:bg-page'}`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <ColorDot color={d.color} />
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                        {done}/{items.length}
                      </span>
                    </button>
                    {selected ? (
                      <ul className="ml-6.5 mt-1 space-y-0.5">
                        {depItems.map((i) => (
                        <li key={i.id}>
                          <a href={`#item-${i.id}`} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
                            <span className={`size-1.5 rounded-full ${i.resultStatus === 'Approved' ? 'bg-emerald-500' : i.resultStatus === 'Pending' ? 'bg-slate-300' : 'bg-brand-500'}`} aria-hidden />
                            <span className="font-mono">{i.testCode}</span>
                          </a>
                        </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>

        <div className="space-y-4">
          {departments.filter(([id]) => id === depId).map(([depId, dep]) => {
            const items = order.items.filter((i) => i.departmentId === depId && (!needle || `${i.testCode} ${i.testNameEn}`.toLowerCase().includes(needle)))
            if (items.length === 0) return null
            const done = items.filter((i) => i.resultStatus !== 'Pending').length
            return (
              <Card key={depId} id={`dep-${depId}`} className="scroll-mt-20 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
                  <h2 className="flex items-center gap-2 font-semibold text-ink">
                    <ColorDot color={dep.color} />
                    {dep.name}
                    <span className="text-xs font-normal text-ink-muted">{t('result.analytes', { n: items.length })}</span>
                  </h2>
                  <div className="flex w-40 items-center gap-2">
                    <ProgressBar value={done} max={items.length} tone={done === items.length ? 'success' : 'accent'} />
                    <span className="text-xs tabular-nums text-ink-muted">
                      {done}/{items.length}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[56rem] text-sm">
                    <thead className="border-b border-rule bg-page text-left text-xs font-semibold text-ink-muted">
                      <tr>
                        <th className="px-4 py-2">CODE</th>
                        <th className="px-4 py-2">{t('test.name')}</th>
                        <th className="w-56 px-4 py-2">{t('result.value')}</th>
                        <th className="px-4 py-2">{t('test.unit')}</th>
                        <th className="px-4 py-2">Flag</th>
                        <th className="px-4 py-2">{t('result.reference')}</th>
                        <th className="px-4 py-2">{t('result.previous')}</th>
                        <th className="px-4 py-2">{t('result.status')}</th>
                        <th className="px-2 py-2" />
                        <th className="w-48 px-4 py-2">{t('result.comment')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rule">
                      {items.map((i) => {
                        const flag = previewFlag(i)
                        const canEdit = editable(i)
                        const waiting = !i.containerId || !received.has(i.containerId)
                        return (
                          <tr key={i.id} id={`item-${i.id}`} className={`scroll-mt-24 ${isCritical(flag) ? 'bg-red-50/60' : ''}`}>
                            <td className="px-4 py-2 font-mono text-xs text-ink-muted">{i.testCode}</td>
                            <td className="px-4 py-2 text-ink">
                              {i.testNameEn}
                              {i.packageCode ? <span className="block text-xs text-ink-subtle">{i.packageCode}</span> : null}
                              {i.resultStatus === 'Cancelled' && i.cancelReason ? <span className="block text-xs text-red-700">{i.cancelReason}</span> : null}
                            </td>
                            <td className="px-4 py-2">
                              {waiting && i.resultStatus === 'Pending' ? (
                                <span className="text-xs text-amber-700">{t('result.waitingSpecimen')}</span>
                              ) : (
                                <ResultInput item={i} value={drafts[i.id]?.value ?? ''} disabled={!canEdit} onChange={(value) => setDraft(i.id, { value })} onKeyDown={focusNext} />
                              )}
                            </td>
                            <td className="px-4 py-2 text-xs text-ink-muted">{i.unit}</td>
                            <td className="px-4 py-2">
                              <FlagBadge flag={flag} />
                            </td>
                            <td className="px-4 py-2 text-xs text-ink-muted">{refText(i) ?? '–'}</td>
                            <td className="px-4 py-2">
                              <PreviousCell results={previousByTest.get(i.labTestId)} onOpen={() => setPreviousOf(i)} />
                            </td>
                            <td className="px-4 py-2">
                              <ResultStatusBadge status={i.resultStatus} />
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex">
                                {previousByTest.has(i.labTestId) ? (
                                  <IconButton label={t('result.previousOpen')} onClick={() => setPreviousOf(i)}>
                                    <ChartLine className="size-4" />
                                  </IconButton>
                                ) : null}
                                <IconButton label={t('result.history')} onClick={() => setHistoryOf(i)}>
                                  <History className="size-4" />
                                </IconButton>
                                {can('results.approve') && (i.resultStatus === 'Approved' || i.resultStatus === 'Verified') ? (
                                  <IconButton label={t('result.reopen')} onClick={() => setReopen(i)}>
                                    <RotateCcw className="size-4" />
                                  </IconButton>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <Input value={drafts[i.id]?.comment ?? ''} disabled={!canEdit} onChange={(e) => setDraft(i.id, { comment: e.target.value })} maxLength={500} aria-label={t('result.comment')} className="h-8" />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-surface/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:pl-72">
          <div className="flex items-center gap-4 text-sm">
            <span className="tabular-nums text-ink">{t('result.enteredOf', { n: entered, total: active })}</span>
            {flagged > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <TriangleAlert className="size-4" aria-hidden />
                {t('result.flagged', { n: flagged })}
              </span>
            ) : null}
            {dirty ? <span className="text-xs text-ink-muted">{t('result.unsaved', { n: dirtyItems.length })}</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {can('results.enter') ? (
              <Button variant="secondary" onClick={() => run.mutate({ action: 'save' })} disabled={!dirty} loading={run.isPending && run.variables?.action === 'save'}>
                <Save className="size-4" />
                {t('result.saveDraft')}
              </Button>
            ) : null}
            {can('results.verify') ? (
              <Button variant="secondary" onClick={() => run.mutate({ action: 'verify' })} disabled={verifiable === 0 && !dirty} loading={run.isPending && run.variables?.action === 'verify'}>
                <CheckCheck className="size-4" />
                {dep ? t('result.verifyDept', { dep: dep.name }) : t('result.verifyAll')}
              </Button>
            ) : null}
            {can('results.approve') ? (
              <Button variant="success" onClick={() => setSigning(true)} disabled={approvable === 0 && !dirty} loading={run.isPending && run.variables?.action === 'approve'}>
                <ShieldCheck className="size-4" />
                {dep ? t('result.approveDept', { dep: dep.name }) : t('result.approveSign')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {signing ? (
        <LicenseDialog title={dep ? t('result.approveDept', { dep: dep.name }) : t('result.approveSign')} pending={run.isPending} onClose={() => setSigning(false)} onSubmit={(licenseNo) => run.mutate({ action: 'approve', licenseNo })} />
      ) : null}
      {switchTo ? (
        <Modal title={t('result.unsavedTitle')} onClose={() => setSwitchTo(null)}>
          <div className="flex gap-3">
            <TriangleAlert className="size-5 shrink-0 text-amber-500" aria-hidden />
            <p className="text-sm text-ink">{t('result.discardUnsaved', { n: dirtyItems.length })}</p>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-rule pt-4">
            <Button variant="secondary" onClick={() => setSwitchTo(null)} disabled={run.isPending}>
              {t('result.stayHere')}
            </Button>
            <Button
              variant="dangerOutline"
              disabled={run.isPending}
              onClick={() => {
                setDrafts(draftsOf(order))
                goToDepartment(switchTo)
              }}
            >
              {t('result.discardSwitch')}
            </Button>
            <Button loading={run.isPending} onClick={() => run.mutate({ action: 'save' }, { onSuccess: () => goToDepartment(switchTo) })}>
              <Save className="size-4" />
              {t('result.saveSwitch')}
            </Button>
          </div>
        </Modal>
      ) : null}
      {historyOf ? <HistoryDialog order={order} item={historyOf} onClose={() => setHistoryOf(null)} /> : null}
      {reopen ? <ReopenDialog order={order} item={reopen} onClose={() => setReopen(null)} /> : null}
      {previousOf ? (
        <PreviousDialog item={previousOf} current={drafts[previousOf.id]?.value ?? ''} currentFlag={previewFlag(previousOf)} results={previousByTest.get(previousOf.labTestId) ?? []} onClose={() => setPreviousOf(null)} />
      ) : null}
    </div>
  )
}

/** The right input for the test's kind of answer. Enter moves to the next result. */
function ResultInput({ item, value, disabled, onChange, onKeyDown }: { item: OrderItem; value: string; disabled: boolean; onChange: (value: string) => void; onKeyDown: (e: KeyboardEvent<HTMLElement>) => void }) {
  const { t } = useI18n()
  const common = { 'data-result-input': true, disabled, onKeyDown, 'aria-label': item.testNameEn, className: 'h-8' }
  if (item.resultType === 'Choice' || item.resultType === 'PosNeg') {
    return (
      <Select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('result.choose')}</option>
        {item.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
        {value && !item.options.includes(value) ? <option>{value}</option> : null}
      </Select>
    )
  }
  const listId = item.options.length > 0 ? `options-${item.id}` : undefined
  return (
    <>
      <Input {...common} value={value} onChange={(e) => onChange(e.target.value)} inputMode={item.resultType === 'Numeric' ? 'decimal' : undefined} list={listId} maxLength={200} />
      {listId ? (
        <datalist id={listId}>
          {item.options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      ) : null}
    </>
  )
}

/** The patient's last result of this test, with its date; opens the full list. */
function PreviousCell({ results, onOpen }: { results: PreviousResult[] | undefined; onOpen: () => void }) {
  const { t, formatDate } = useI18n()
  const last = results?.[0]
  if (!last) return <span className="text-xs text-ink-subtle">–</span>
  return (
    <button type="button" onClick={onOpen} className="group text-left" title={t('result.previousOpen')}>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="font-medium text-ink group-hover:text-brand-700 group-hover:underline">{last.value}</span>
        <FlagBadge flag={last.flag} />
      </span>
      <span className="block whitespace-nowrap text-xs text-ink-muted">
        {formatDate(last.at)}
        {results.length > 1 ? ` · +${results.length - 1}` : ''}
      </span>
    </button>
  )
}

function PreviousDialog({ item, current, currentFlag, results, onClose }: {
  item: OrderItem
  current: string
  currentFlag: OrderItem['flag']
  results: PreviousResult[]
  onClose: () => void
}) {
  const { t, formatDateTime } = useI18n()
  return (
    <Modal title={t('result.previousTitle', { code: item.testCode })} description={item.testNameEn} onClose={onClose} size="lg">
      <p className="mb-3 text-sm text-ink-muted">{t('result.previousHint')}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-rule text-left text-xs font-semibold text-ink-muted">
            <tr>
              <th className="py-2 pr-4">{t('order.orderedAt')}</th>
              <th className="py-2 pr-4">{t('order.no')}</th>
              <th className="py-2 pr-4">{t('result.value')}</th>
              <th className="py-2 pr-4">Flag</th>
              <th className="py-2">{t('result.reference')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            <tr className="bg-brand-50/50">
              <td className="py-2 pr-4 font-medium text-ink">{t('result.thisOrder')}</td>
              <td className="py-2 pr-4" />
              <td className="py-2 pr-4 font-medium text-ink">
                {current || '–'} <span className="text-xs text-ink-muted">{item.unit}</span>
              </td>
              <td className="py-2 pr-4">
                <FlagBadge flag={currentFlag} />
              </td>
              <td className="py-2 text-xs text-ink-muted">{item.refText ?? ''}</td>
            </tr>
            {results.map((r) => (
              <tr key={`${r.orderId}:${r.at}`}>
                <td className="whitespace-nowrap py-2 pr-4 text-ink-muted">{formatDateTime(r.at)}</td>
                <td className="py-2 pr-4">
                  <Link to={`/lab-orders/${r.orderId}`} className="font-mono text-brand-700 hover:underline">
                    {r.orderNo}
                  </Link>
                </td>
                <td className="py-2 pr-4 font-medium text-ink">
                  {r.value} <span className="text-xs text-ink-muted">{r.unit}</span>
                </td>
                <td className="py-2 pr-4">
                  <FlagBadge flag={r.flag} />
                </td>
                <td className="py-2 text-xs text-ink-muted">{r.refText ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function HistoryDialog({ order, item, onClose }: { order: OrderDetail; item: OrderItem; onClose: () => void }) {
  const { t, formatDateTime } = useI18n()
  const history = useQuery({ queryKey: ['result-history', item.id], queryFn: () => api.resultHistory(order.id, item.id) })
  return (
    <Modal title={t('result.historyTitle', { code: item.testCode })} description={item.testNameEn} onClose={onClose}>
      <ErrorNote error={history.error} />
      {history.data?.length === 0 ? <p className="text-sm text-ink-muted">{t('result.noHistory')}</p> : null}
      <ol className="space-y-3">
        {history.data?.map((e, index) => (
          <li key={index} className="flex items-start justify-between gap-3 border-b border-rule pb-3 text-sm last:border-0">
            <div>
              <p className="font-medium text-ink">{t(`resultEvent.${e.action}` as 'resultEvent.enter')}</p>
              <p className="text-xs text-ink-muted">
                {formatDateTime(e.at)} · {e.userName}
              </p>
            </div>
            <span className="flex items-center gap-2">
              <span className="font-medium">{e.value ?? '–'}</span>
              <FlagBadge flag={e.flag} />
            </span>
          </li>
        ))}
      </ol>
    </Modal>
  )
}

/** Asked on every approval: the server checks the number against the approver's registered licence. */
function LicenseDialog({ title, pending, onClose, onSubmit }: { title: string; pending: boolean; onClose: () => void; onSubmit: (licenseNo: string) => void }) {
  const { t } = useI18n()
  const [licenseNo, setLicenseNo] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(licenseNo)
  }
  return (
    <Modal title={title} description={t('result.licenseHint')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('users.licenseNo')}>
          <Input value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} required maxLength={40} autoComplete="off" autoFocus />
        </Field>
        <DialogActions onClose={onClose} pending={pending} submitLabel={t('result.approveConfirm')} variant="success" />
      </form>
    </Modal>
  )
}

function ReopenDialog({ order, item, onClose }: { order: OrderDetail; item: OrderItem; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const reopen = useMutation({
    mutationFn: () => api.reopenResult(order.id, order.version, item.id, reason),
    onSuccess: (r) => {
      queryClient.setQueryData(['order', r.order.id], r.order)
      toast(t('result.reopenedToast'))
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    reopen.mutate()
  }
  return (
    <Modal title={t('result.reopenTitle', { code: item.testCode })} description={`${item.testNameEn}: ${item.value ?? ''}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">{t('result.reopenHint')}</p>
        <Field label={t('result.reopenReason')}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} />
        </Field>
        <ErrorNote error={reopen.error} />
        <DialogActions onClose={onClose} pending={reopen.isPending} submitLabel={t('result.reopen')} variant="danger" />
      </form>
    </Modal>
  )
}
