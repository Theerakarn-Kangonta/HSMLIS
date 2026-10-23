import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TestTube } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { api, type Container, type OrderDetail } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { ContainerStatusBadge } from './lab'
import { PatientBand } from './PatientBand'
import { Button, DialogActions, ErrorNote, Field, Input, Modal, Select, Textarea, useToast } from './ui'

const CONDITIONS = ['ปกติ', 'Hemolysis', 'Lipemic', 'Icteric', 'Clotted', 'ปริมาณน้อย']
export const REJECT_REASONS = ['Hemolysis', 'ตัวอย่างแข็งตัว (Clotted)', 'ปริมาณตัวอย่างไม่พอ', 'ภาชนะไม่ถูกต้อง', 'ฉลากไม่ตรงกับใบสั่ง', 'ตัวอย่างรั่ว/ปนเปื้อน', 'เกินเวลาขนส่ง']

/** Refreshes every list that shows specimens after one changed. */
function useSpecimenChanged() {
  const queryClient = useQueryClient()
  return (order: OrderDetail) => {
    queryClient.setQueryData(['order', order.id], order)
    queryClient.invalidateQueries({ queryKey: ['checkin'] })
    queryClient.invalidateQueries({ queryKey: ['checkin-waiting'] })
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['worklist'] })
    queryClient.invalidateQueries({ queryKey: ['results-kpi'] })
  }
}

function ContainerRow({ container, action }: { container: Container; action?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <TestTube className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {container.specimenName} <span className="font-normal text-ink-muted">· {container.containerType}</span>
          </p>
          <p className="truncate text-xs text-ink-muted">
            <span className="font-mono">{container.lsn}</span> · {container.testCodes.join(', ')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ContainerStatusBadge status={container.status} />
        {action}
      </div>
    </li>
  )
}

/** Collect one container at a time, or all at once. */
export function CollectDialog({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const changed = useSpecimenChanged()
  const collect = useMutation({
    mutationFn: (ids: string[] | null) => api.collect(order.id, ids),
    onSuccess: (o) => {
      changed(o)
      toast(t('specimen.collectedToast'))
      if (!o.containers.some((c) => c.status === 'Pending')) onClose()
    },
  })
  const pending = order.containers.filter((c) => c.status === 'Pending')
  return (
    <Modal title={t('specimen.collectTitle')} description={`${order.orderNo} · ${order.patient.fullName}`} onClose={onClose}>
      <PatientBand patient={order.patient} sticky={false} />
      <div className="h-4" />
      <ul className="divide-y divide-rule">
        {order.containers.map((c) => (
          <ContainerRow
            key={c.id}
            container={c}
            action={
              c.status === 'Pending' ? (
                <Button size="sm" onClick={() => collect.mutate([c.id])} disabled={collect.isPending}>
                  {t('specimen.collect')}
                </Button>
              ) : null
            }
          />
        ))}
      </ul>
      <ErrorNote error={collect.error} />
      <div className="mt-4 flex justify-end gap-2 border-t border-rule pt-4">
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button onClick={() => collect.mutate(null)} disabled={pending.length === 0} loading={collect.isPending}>
          {t('specimen.collectAll')}
        </Button>
      </div>
    </Modal>
  )
}

/** Receive containers into the lab, noting their volume and condition. */
export function ReceiveDialog({ order, onClose, onAllReceived }: { order: OrderDetail; onClose: () => void; onAllReceived?: (order: OrderDetail) => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const changed = useSpecimenChanged()
  const [volume, setVolume] = useState('')
  const [condition, setCondition] = useState(CONDITIONS[0])
  const [comment, setComment] = useState('')
  const receive = useMutation({
    mutationFn: (ids: string[] | null) => api.receive(order.id, { containerIds: ids, volume: volume || null, condition, comment: comment || null }),
    onSuccess: (o) => {
      changed(o)
      toast(t('specimen.receivedToast'))
      if (!o.containers.some((c) => c.status === 'Pending' || c.status === 'Collected')) {
        onClose()
        onAllReceived?.(o)
      }
    },
  })
  const open = order.containers.filter((c) => c.status === 'Pending' || c.status === 'Collected')
  return (
    <Modal title={t('specimen.receiveTitle')} description={t('specimen.receiveHint', { no: order.orderNo })} onClose={onClose} size="lg">
      <PatientBand patient={order.patient} sticky={false} />
      <div className="h-4" />
      <ul className="divide-y divide-rule">
        {order.containers.map((c) => (
          <ContainerRow
            key={c.id}
            container={c}
            action={
              c.status === 'Pending' || c.status === 'Collected' ? (
                <Button size="sm" variant="success" onClick={() => receive.mutate([c.id])} disabled={receive.isPending}>
                  {t('specimen.receive')}
                </Button>
              ) : null
            }
          />
        ))}
      </ul>
      <div className="mt-4 rounded-lg border border-rule bg-page p-4">
        <p className="mb-3 text-xs font-semibold text-ink-muted">{t('specimen.quality')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('specimen.volume')}>
            <Input value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="5 mL" maxLength={40} />
          </Field>
          <Field label={t('specimen.condition')}>
            <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
              {CONDITIONS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('specimen.comment')}>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} />
          </Field>
        </div>
      </div>
      <ErrorNote error={receive.error} />
      <div className="mt-4 flex justify-end gap-2 border-t border-rule pt-4">
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button variant="success" onClick={() => receive.mutate(null)} disabled={open.length === 0} loading={receive.isPending}>
          {t('specimen.receiveAll')}
        </Button>
      </div>
    </Modal>
  )
}

/** Reject one container, with the reason recorded for the rejection statistics. */
export function RejectDialog({ order, container, onClose }: { order: OrderDetail; container?: Container; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const changed = useSpecimenChanged()
  const candidates = order.containers.filter((c) => c.status === 'Collected' || c.status === 'Received')
  const [containerId, setContainerId] = useState(container?.id ?? candidates[0]?.id ?? '')
  const [reason, setReason] = useState(REJECT_REASONS[0])
  const [other, setOther] = useState('')
  const reject = useMutation({
    mutationFn: () => api.reject(order.id, containerId, reason === '__other' ? other : reason),
    onSuccess: (o) => {
      changed(o)
      toast(t('specimen.rejectedToast'))
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    reject.mutate()
  }
  return (
    <Modal title={t('specimen.rejectTitle')} description={order.orderNo} onClose={onClose}>
      <PatientBand patient={order.patient} sticky={false} />
      <div className="h-4" />
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('specimen.container')}>
          <Select value={containerId} onChange={(e) => setContainerId(e.target.value)} required>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.lsn} · {c.specimenName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('specimen.rejectReason')}>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REJECT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
            <option value="__other">{t('common.other')}</option>
          </Select>
        </Field>
        {reason === '__other' ? (
          <Field label={t('specimen.rejectDetail')}>
            <Textarea value={other} onChange={(e) => setOther(e.target.value)} required maxLength={200} />
          </Field>
        ) : null}
        <ErrorNote error={reject.error} />
        <DialogActions onClose={onClose} pending={reject.isPending} submitLabel={t('specimen.reject')} variant="danger" disabled={!containerId} />
      </form>
    </Modal>
  )
}
