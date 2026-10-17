import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCheck, ExternalLink, History, Printer, RotateCcw, Save, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FlagBadge, ResultStatusBadge, UrgentBadge, isCritical } from '../../components/lab'
import {
  Badge,
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
  focusRing,
  useToast,
} from '../../components/ui'
import { api, ApiError, type OrderDetail, type OrderItem, type ResultActionResponse } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useLabTests } from '../../lib/catalog'
import { useI18n } from '../../lib/i18n'
import { describe, evaluate, pickRange } from '../../lib/results'
import { useOrder } from '../orders/OrderDetailPage'

type Draft = { value: string; comment: string }

export function ResultEntryPage() {
  const { id } = useParams()
  const query = useOrder(id)
  const { t } = useI18n()
  if (!query.data) {
    return (
      <div className="space-y-4">
        <Link to="/lab-results" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="size-4" /> {t('common.back')}
        </Link>
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
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(order.items.map((i) => [i.id, { value: i.value ?? '', comment: i.comment ?? '' }])))
  const [jump, setJump] = useState('')
  const [historyOf, setHistoryOf] = useState<OrderItem | null>(null)
  const [reopen, setReopen] = useState<OrderItem | null>(null)

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

  const entered = order.items.filter((i) => i.resultStatus !== 'Pending' && i.resultStatus !== 'Cancelled').length
  const active = order.items.filter((i) => i.resultStatus !== 'Cancelled').length
  const flagged = order.items.filter((i) => previewFlag(i) !== 'None').length
  const verifiable = order.items.filter((i) => i.resultStatus === 'Entered').length
  const approvable = order.items.filter((i) => i.resultStatus === 'Verified').length

  const departments = [...new Map(order.items.map((i) => [i.departmentId, { name: i.departmentName, color: i.departmentColor }])).entries()]

  const applied = (r: ResultActionResponse) => {
    queryClient.setQueryData(['order', r.order.id], r.order)
    queryClient.invalidateQueries({ queryKey: ['worklist'] })
    queryClient.invalidateQueries({ queryKey: ['results-kpi'] })
  }

  const run = useMutation({
    // Saves what changed first, so verifying or approving always acts on what is on screen.
    // The screen is refreshed once, at the end, with the order as the last call returned it.
    mutationFn: async (action: 'save' | 'verify' | 'approve') => {
      let version = order.version
      let saved: ResultActionResponse | null = null
      if (dirty) {
        saved = await api.saveResults(order.id, version, dirtyItems.map((i) => ({ itemId: i.id, value: drafts[i.id].value || null, comment: drafts[i.id].comment || null })))
        version = saved.order.version
      }
      if (action === 'save') return { action, response: saved }
      const response = action === 'verify' ? await api.verifyResults(order.id, version, null) : await api.approveResults(order.id, version, null)
      return { action, response }
    },
    onSuccess: ({ action, response }) => {
      if (response) applied(response)
      if (action === 'save') toast(t('result.savedToast'))
      if (action === 'verify') toast(t('result.verifiedToast', { n: response!.done }))
      if (action === 'approve') {
        toast(t('result.approvedToast', { n: response!.done }))
        if (response!.skipped > 0) toast(t('result.approveSkipped', { n: response!.skipped }), 'error')
        if (response!.order.status === 'Completed') navigate('/lab-results?stage=Approve')
      }
    },
    onError: (error) => {
      // Approving one's own fresh work is refused with a reason worth reading in full.
      if (error instanceof ApiError && error.code === 'self_approval_wait') toast(t('result.selfApprovalWait'), 'error')
      else toast(errorText(error), 'error')
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
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/lab-results" className={`mt-1 flex size-8 items-center justify-center rounded-md border border-rule bg-surface text-ink-muted hover:text-ink ${focusRing}`} aria-label={t('common.back')}>
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-ink">
              {order.patient.fullName}
              <Badge>
                HN <span className="font-mono">{order.patient.hn}</span>
              </Badge>
              {order.urgent ? <UrgentBadge /> : null}
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {order.patient.ageYears !== null ? `${t('patient.ageYears', { n: order.patient.ageYears })} · ` : ''}
              {t(`sex.${order.patient.sex}`)} · {formatDateTime(order.orderedAt)} · <span className="font-mono">{order.orderNo}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/patients/${order.patient.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            {t('result.patientHistory')} <ExternalLink className="size-3.5" />
          </Link>
          <Link to={`/lab-orders/${order.id}/specimen-labels`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            <Printer className="size-3.5" /> {t('order.printLabels')}
          </Link>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[15rem_1fr]">
        <Card className="lg:sticky lg:top-20">
          <div className="space-y-3 p-4">
            <SearchInput value={jump} onChange={setJump} placeholder={t('result.jump')} />
            <p className="text-xs text-ink-muted">{t('result.enteredOf', { n: entered, total: active })}</p>
            <ProgressBar value={entered} max={active} />
            <ul className="space-y-3 text-sm">
              {departments.map(([depId, dep]) => {
                const items = order.items.filter((i) => i.departmentId === depId)
                const done = items.filter((i) => i.resultStatus !== 'Pending').length
                return (
                  <li key={depId}>
                    <a href={`#dep-${depId}`} className="flex items-center justify-between gap-2 font-medium text-ink hover:text-brand-700">
                      <span className="flex min-w-0 items-center gap-2">
                        <ColorDot color={dep.color} />
                        <span className="truncate">{dep.name}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                        {done}/{items.length}
                      </span>
                    </a>
                    <ul className="ml-4.5 mt-1 space-y-0.5">
                      {items.map((i) => (
                        <li key={i.id}>
                          <a href={`#item-${i.id}`} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
                            <span className={`size-1.5 rounded-full ${i.resultStatus === 'Approved' ? 'bg-emerald-500' : i.resultStatus === 'Pending' ? 'bg-slate-300' : 'bg-brand-500'}`} aria-hidden />
                            <span className="font-mono">{i.testCode}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          </div>
        </Card>

        <div className="space-y-5">
          {departments.map(([depId, dep]) => {
            const items = order.items.filter((i) => i.departmentId === depId && (!needle || `${i.testCode} ${i.testNameEn}`.toLowerCase().includes(needle)))
            if (items.length === 0) return null
            const done = items.filter((i) => i.resultStatus !== 'Pending').length
            return (
              <Card key={depId} id={`dep-${depId}`} className="scroll-mt-20 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3">
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
                              <ResultStatusBadge status={i.resultStatus} />
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex">
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
              <Button variant="secondary" onClick={() => run.mutate('save')} disabled={!dirty} loading={run.isPending && run.variables === 'save'}>
                <Save className="size-4" />
                {t('result.saveDraft')}
              </Button>
            ) : null}
            {can('results.verify') ? (
              <Button variant="secondary" onClick={() => run.mutate('verify')} disabled={verifiable === 0 && !dirty} loading={run.isPending && run.variables === 'verify'}>
                <CheckCheck className="size-4" />
                {t('result.verifyAll')}
              </Button>
            ) : null}
            {can('results.approve') ? (
              <Button variant="success" onClick={() => run.mutate('approve')} disabled={approvable === 0} loading={run.isPending && run.variables === 'approve'}>
                <ShieldCheck className="size-4" />
                {t('result.approveSign')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {historyOf ? <HistoryDialog order={order} item={historyOf} onClose={() => setHistoryOf(null)} /> : null}
      {reopen ? <ReopenDialog order={order} item={reopen} onClose={() => setReopen(null)} /> : null}
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
