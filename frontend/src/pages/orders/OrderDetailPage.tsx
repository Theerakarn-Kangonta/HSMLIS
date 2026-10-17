import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CircleCheck, ClipboardPen, CreditCard, FileText, FlaskConical, Printer, RotateCcw, TestTube, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ContainerStatusBadge, FlagBadge, OrderStatusBadge, ResultStatusBadge, UrgentBadge } from '../../components/lab'
import { CollectDialog, ReceiveDialog, RejectDialog } from '../../components/SpecimenDialogs'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ColorDot,
  DataTable,
  DialogActions,
  ErrorNote,
  Field,
  LinkButton,
  Modal,
  PageHeader,
  SkeletonCards,
  Textarea,
  tableBodyClass,
  tableHeadClass,
  tdClass,
  thClass,
  useToast,
} from '../../components/ui'
import { api, type OrderDetail } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'

export function useOrder(id: string | undefined) {
  return useQuery({ queryKey: ['order', id], queryFn: () => api.order(id!), enabled: !!id })
}

export function OrderDetailPage() {
  const { id } = useParams()
  const { t, formatDateTime, formatMoney, formatNumber } = useI18n()
  const { can } = useAuth()
  const query = useOrder(id)
  const [dialog, setDialog] = useState<'collect' | 'receive' | 'reject' | 'cancel' | null>(null)
  const queryClient = useQueryClient()
  const toast = useToast()
  const recollect = useMutation({
    mutationFn: (containerId: string) => api.recollect(id!, containerId),
    onSuccess: (o) => {
      queryClient.setQueryData(['order', o.id], o)
      toast(t('specimen.recollectedToast'))
    },
  })

  const o = query.data
  if (!o) {
    return (
      <div>
        <PageHeader title={t('order.detailTitle')} back="/lab-orders" />
        <ErrorNote error={query.error} />
        {query.isLoading ? <SkeletonCards /> : null}
      </div>
    )
  }

  const open = o.status !== 'Cancelled'
  const hasPending = o.containers.some((c) => c.status === 'Pending')
  const hasCollected = o.containers.some((c) => c.status === 'Pending' || c.status === 'Collected')
  const hasReceived = o.containers.some((c) => c.status === 'Received')
  const anyApproved = o.items.some((i) => i.resultStatus === 'Approved')
  const resultsUser = can('results.enter') || can('results.verify') || can('results.approve')

  const timeline = [
    { label: t('timeline.ordered'), at: o.orderedAt, done: true },
    { label: t('timeline.collected'), at: o.collectedAt, done: !!o.collectedAt },
    { label: t('timeline.testing'), at: o.receivedAt, done: !!o.receivedAt },
    { label: t('timeline.completed'), at: o.completedAt, done: !!o.completedAt },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t('order.detailTitle')} <span className="font-mono">{o.orderNo}</span>
            {o.urgent ? <UrgentBadge /> : null}
          </span>
        }
        description={t('order.detailSubtitle')}
        back="/lab-orders"
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title={t('order.info')} icon={ClipboardPen} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-5 text-sm">
                <dt className="text-ink-muted">{t('order.no')}</dt>
                <dd className="font-mono font-medium text-ink">{o.orderNo}</dd>
                <dt className="text-ink-muted">{t('order.status')}</dt>
                <dd>
                  <OrderStatusBadge status={o.status} />
                </dd>
                <dt className="text-ink-muted">{t('order.orderedAt')}</dt>
                <dd className="text-ink">
                  {formatDateTime(o.orderedAt)} · {o.orderedByName}
                </dd>
                <dt className="text-ink-muted">{t('order.referrer')}</dt>
                <dd className="text-ink">
                  {o.referrer ? `${o.referrer.code} · ${o.referrer.name}` : t('order.noReferrer')}
                  {o.referrerRef ? <span className="text-ink-muted"> ({o.referrerRef})</span> : null}
                </dd>
                <dt className="text-ink-muted">{t('order.entitlement')}</dt>
                <dd className="text-ink">{o.entitlement ?? '–'}</dd>
                {o.diagnosis ? (
                  <>
                    <dt className="text-ink-muted">{t('order.diagnosis')}</dt>
                    <dd className="text-ink">{o.diagnosis}</dd>
                  </>
                ) : null}
                {o.note ? (
                  <>
                    <dt className="text-ink-muted">{t('common.note')}</dt>
                    <dd className="text-ink">{o.note}</dd>
                  </>
                ) : null}
                <dt className="text-ink-muted">{t('order.total')}</dt>
                <dd className="font-semibold text-ink">
                  {formatMoney(o.total)}
                  {o.invoice ? (
                    <span className="ml-2 font-normal text-ink-muted">
                      {o.invoice.invoiceNo} · {t(`invoiceStatus.${o.invoice.status}`)}
                    </span>
                  ) : null}
                </dd>
                {o.cancelReason ? (
                  <>
                    <dt className="text-red-700">{t('order.cancelReason')}</dt>
                    <dd className="text-red-700">{o.cancelReason}</dd>
                  </>
                ) : null}
              </dl>
            </Card>
            <Card>
              <CardHeader title={t('order.patientInfo')}>
                <Link to={`/patients/${o.patient.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                  {t('order.viewPatient')}
                </Link>
              </CardHeader>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-5 text-sm">
                <dt className="text-ink-muted">HN</dt>
                <dd className="font-mono text-ink">{o.patient.hn}</dd>
                <dt className="text-ink-muted">{t('patient.name')}</dt>
                <dd className="font-medium text-ink">{o.patient.fullName}</dd>
                <dt className="text-ink-muted">{t('patient.sexAge')}</dt>
                <dd className="text-ink">
                  {t(`sex.${o.patient.sex}`)}
                  {o.patient.ageYears !== null ? ` · ${t('patient.ageYears', { n: o.patient.ageYears })}` : ''}
                </dd>
                <dt className="text-ink-muted">{t('order.vitals')}</dt>
                <dd className="text-ink">
                  {[
                    o.bpSystolic && o.bpDiastolic ? `BP ${o.bpSystolic}/${o.bpDiastolic}` : null,
                    o.heartRate ? `HR ${o.heartRate}` : null,
                    o.temperatureC ? `${formatNumber(o.temperatureC)} °C` : null,
                    o.weightKg ? `${formatNumber(o.weightKg)} kg` : null,
                    o.heightCm ? `${formatNumber(o.heightCm)} cm` : null,
                    o.bmi ? `BMI ${formatNumber(o.bmi)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '–'}
                </dd>
                {o.patient.allergies ? (
                  <>
                    <dt className="text-red-700">{t('patient.allergies')}</dt>
                    <dd className="font-medium text-red-700">{o.patient.allergies}</dd>
                  </>
                ) : null}
              </dl>
            </Card>
          </div>

          <Card>
            <CardHeader title={t('order.containers', { n: o.containers.length })} icon={TestTube} />
            <DataTable>
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>LSN</th>
                  <th className={thClass}>{t('specimen.type')}</th>
                  <th className={thClass}>{t('order.tests')}</th>
                  <th className={thClass}>{t('order.status')}</th>
                  <th className={thClass}>{t('specimen.history')}</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody className={tableBodyClass}>
                {o.containers.map((c) => (
                  <tr key={c.id}>
                    <td className={`${tdClass} font-mono`} data-title>
                      {c.lsn}
                    </td>
                    <td className={tdClass} data-label={t('specimen.type')}>
                      {c.specimenName}
                      <span className="block text-xs text-ink-muted">{c.containerType}</span>
                    </td>
                    <td className={`${tdClass} text-xs text-ink-muted`} data-label={t('order.tests')}>
                      {c.testCodes.join(', ') || '–'}
                    </td>
                    <td className={tdClass} data-label={t('order.status')}>
                      <ContainerStatusBadge status={c.status} />
                      {c.rejectReason ? <span className="mt-1 block text-xs text-red-700">{c.rejectReason}</span> : null}
                    </td>
                    <td className={`${tdClass} text-xs text-ink-muted`} data-label={t('specimen.history')}>
                      {c.collectedAt ? <div>{t('specimen.collectedBy', { at: formatDateTime(c.collectedAt), by: c.collectedByName ?? '' })}</div> : null}
                      {c.receivedAt ? <div>{t('specimen.receivedBy', { at: formatDateTime(c.receivedAt), by: c.receivedByName ?? '' })}</div> : null}
                      {c.volume || c.condition ? <div>{[c.volume, c.condition].filter(Boolean).join(' · ')}</div> : null}
                      {c.rejectedAt ? <div className="text-red-700">{t('specimen.rejectedBy', { at: formatDateTime(c.rejectedAt), by: c.rejectedByName ?? '' })}</div> : null}
                    </td>
                    <td className={`${tdClass} text-right`} data-actions>
                      {open && c.status === 'Rejected' && can('checkin') && !o.containers.some((x) => x.lsn > c.lsn && x.specimenTypeId === c.specimenTypeId && x.status !== 'Rejected') ? (
                        <Button size="sm" variant="secondary" onClick={() => recollect.mutate(c.id)} loading={recollect.isPending}>
                          <RotateCcw className="size-4" />
                          {t('specimen.recollect')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <ErrorNote error={recollect.error} />
          </Card>

          <Card>
            <CardHeader title={t('order.items', { n: o.items.length })} icon={FlaskConical} />
            <DataTable>
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>{t('test.code')}</th>
                  <th className={thClass}>{t('test.name')}</th>
                  <th className={thClass}>{t('test.department')}</th>
                  <th className={thClass}>{t('result.value')}</th>
                  <th className={thClass}>{t('result.status')}</th>
                  <th className={`${thClass} text-right`}>{t('test.price')}</th>
                </tr>
              </thead>
              <tbody className={tableBodyClass}>
                {o.items.map((i) => (
                  <tr key={i.id}>
                    <td className={`${tdClass} font-mono`} data-title>
                      {i.testCode}
                    </td>
                    <td className={tdClass} data-label={t('test.name')}>
                      {i.testNameEn}
                      {i.packageCode ? (
                        <Badge tone="accent" className="ml-2">
                          {t('order.package')} {i.packageCode}
                        </Badge>
                      ) : null}
                    </td>
                    <td className={tdClass} data-label={t('test.department')}>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <ColorDot color={i.departmentColor} />
                        {i.departmentName}
                      </span>
                    </td>
                    <td className={tdClass} data-label={t('result.value')}>
                      {i.value ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-medium">{i.value}</span>
                          <span className="text-xs text-ink-muted">{i.unit}</span>
                          <FlagBadge flag={i.flag} />
                        </span>
                      ) : (
                        '–'
                      )}
                    </td>
                    <td className={tdClass} data-label={t('result.status')}>
                      <ResultStatusBadge status={i.resultStatus} />
                    </td>
                    <td className={`${tdClass} text-right`} data-label={t('test.price')}>
                      {formatMoney(i.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title={t('order.progressTitle')} />
            <ol className="space-y-0 p-5">
              {timeline.map((step, index) => (
                <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < timeline.length - 1 ? <span className={`absolute left-[0.6875rem] top-6 h-[calc(100%-1rem)] w-0.5 ${step.done && timeline[index + 1].done ? 'bg-emerald-500' : 'bg-slate-200'}`} aria-hidden /> : null}
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300 bg-surface'}`}>
                    {step.done ? <CircleCheck className="size-4" aria-hidden /> : null}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${step.done ? 'text-ink' : 'text-ink-muted'}`}>{step.label}</p>
                    {step.at ? <p className="text-xs text-ink-muted">{formatDateTime(step.at)}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title={t('order.actions')} />
            <div className="grid gap-2 p-5">
              {open && can('checkin') && hasPending ? (
                <Button onClick={() => setDialog('collect')}>
                  <TestTube className="size-4" />
                  {t('specimen.collect')}
                </Button>
              ) : null}
              {open && can('checkin') && hasCollected ? (
                <Button variant={hasPending ? 'secondary' : 'success'} onClick={() => setDialog('receive')}>
                  <CircleCheck className="size-4" />
                  {t('specimen.receive')}
                </Button>
              ) : null}
              {open && resultsUser && hasReceived ? (
                <LinkButton to={`/lab-results/${o.id}`} variant="secondary">
                  <ClipboardPen className="size-4" />
                  {t('result.enter')}
                </LinkButton>
              ) : null}
              <LinkButton to={`/lab-orders/${o.id}/specimen-labels`} variant="secondary">
                <Printer className="size-4" />
                {t('order.printLabels')}
              </LinkButton>
              <LinkButton
                to={`/lab-orders/${o.id}/lab-report`}
                variant="secondary"
                aria-disabled={!anyApproved}
                className={anyApproved ? '' : 'pointer-events-none opacity-50'}
                tabIndex={anyApproved ? undefined : -1}
              >
                <FileText className="size-4" />
                {t('order.printReport')}
              </LinkButton>
              {o.invoice && can('billing') ? (
                <LinkButton to={`/billing?search=${o.orderNo}`} variant="secondary">
                  <CreditCard className="size-4" />
                  {t('order.recordPayment')}
                </LinkButton>
              ) : null}
              {open && can('checkin') && o.containers.some((c) => c.status === 'Collected' || c.status === 'Received') ? (
                <Button variant="dangerOutline" onClick={() => setDialog('reject')}>
                  <XCircle className="size-4" />
                  {t('specimen.reject')}
                </Button>
              ) : null}
              {open && !anyApproved ? (
                <Button variant="dangerOutline" onClick={() => setDialog('cancel')}>
                  <Ban className="size-4" />
                  {t('order.cancel')}
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      </div>

      {dialog === 'collect' ? <CollectDialog order={o} onClose={() => setDialog(null)} /> : null}
      {dialog === 'receive' ? <ReceiveDialog order={o} onClose={() => setDialog(null)} /> : null}
      {dialog === 'reject' ? <RejectDialog order={o} onClose={() => setDialog(null)} /> : null}
      {dialog === 'cancel' ? <CancelDialog order={o} onClose={() => setDialog(null)} /> : null}
    </div>
  )
}

function CancelDialog({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(order.id, reason),
    onSuccess: (o) => {
      queryClient.setQueryData(['order', o.id], o)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast(t('order.cancelledToast'))
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    cancel.mutate()
  }
  return (
    <Modal title={t('order.cancelTitle')} description={order.orderNo} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">{t('order.cancelHint')}</p>
        <Field label={t('order.cancelReason')}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} />
        </Field>
        <ErrorNote error={cancel.error} />
        <DialogActions onClose={onClose} pending={cancel.isPending} submitLabel={t('order.cancel')} variant="danger" />
      </form>
    </Modal>
  )
}
