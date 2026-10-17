import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Printer, Trash2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Barcode } from '../../components/Barcode'
import { Button, Card, CardHeader, ErrorNote, IconButton, Input, Select, SkeletonCards, focusRing } from '../../components/ui'
import { api, type Container, type OrderDetail } from '../../lib/api'
import { useSpecimenTypes } from '../../lib/catalog'
import { useI18n } from '../../lib/i18n'
import { useOrder } from './OrderDetailPage'

/** Label size the print layout is made for: a common thermal tube label. */
const LABEL = { width: 50, height: 25 }

export function SpecimenLabelsPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const query = useOrder(id)
  const o = query.data
  if (!o) return <div className="p-6">{query.error ? <ErrorNote error={query.error} /> : <SkeletonCards />}</div>

  const labels = o.containers.filter((c) => c.status !== 'Rejected').flatMap((c) => Array.from({ length: c.labelCount }, (_, i) => ({ c, key: `${c.id}-${i}` })))

  return (
    <div className="min-h-screen bg-page">
      {/* One label per printed page, at the label's own size, for thermal label printers. */}
      <style>{`@media print { @page { size: ${LABEL.width}mm ${LABEL.height}mm; margin: 0 } }`}</style>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-surface px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/lab-orders/${o.id}`} className={`flex size-8 items-center justify-center rounded-md border border-rule text-ink-muted hover:text-ink ${focusRing}`} aria-label={t('common.back')}>
            <ArrowLeft className="size-4" />
          </Link>
          <p className="truncate font-semibold text-ink">
            {t('labels.title')} — <span className="font-mono">{o.orderNo}</span>{' '}
            <span className="font-normal text-ink-muted">{t('labels.count', { containers: o.containers.filter((c) => c.status !== 'Rejected').length, labels: labels.length })}</span>
          </p>
        </div>
        <Button onClick={() => window.print()} disabled={labels.length === 0}>
          <Printer className="size-4" />
          {t('common.print')}
        </Button>
      </div>

      <div className="no-print mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <ContainerManager order={o} />
        <p className="text-xs text-ink-muted">{t('labels.help')}</p>
      </div>

      <div className="mx-auto grid max-w-5xl gap-4 px-4 pb-10 sm:grid-cols-2 sm:px-6 print:block print:max-w-none print:p-0">
        {labels.map(({ c, key }) => (
          <SpecimenLabel key={key} order={o} container={c} />
        ))}
      </div>
    </div>
  )
}

function SpecimenLabel({ order, container }: { order: OrderDetail; container: Container }) {
  const { formatDateTimeShort } = useI18n()
  const collected = container.collectedAt ?? order.orderedAt
  return (
    <div
      className="paper mx-auto flex flex-col overflow-hidden rounded-md border border-slate-300 px-[2mm] py-[1.5mm] shadow-sm print:break-after-page print:rounded-none print:border-0"
      style={{ width: `${LABEL.width}mm`, height: `${LABEL.height}mm`, fontSize: '2.3mm', lineHeight: 1.15 }}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate font-bold" style={{ fontSize: '2.7mm' }}>
          {order.patient.fullName}
        </span>
        {order.urgent ? <span className="shrink-0 rounded-sm bg-black px-[0.8mm] font-bold text-white">URGENT</span> : null}
      </div>
      <div className="flex justify-between gap-1">
        <span>HN {order.patient.hn}</span>
        <span className="truncate">{order.referrer?.code ?? ''}</span>
      </div>
      <div className="truncate">
        {container.specimenName} · {container.testCodes.join(',')}
      </div>
      <div className="mt-auto">
        <Barcode value={container.lsn} height={22} className="!h-[7mm]" />
        <div className="flex justify-between font-mono" style={{ fontSize: '2.2mm' }}>
          <span>{container.lsn}</span>
          <span>{formatDateTimeShort(collected)}</span>
        </div>
      </div>
    </div>
  )
}

/** Containers grouped by specimen, with how many labels each gets. Changes save at once. */
function ContainerManager({ order }: { order: OrderDetail }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const specimens = useSpecimenTypes()
  const [adding, setAdding] = useState('')
  const done = (o: OrderDetail) => queryClient.setQueryData(['order', o.id], o)
  const update = useMutation({ mutationFn: ({ c, labelCount, containerType }: { c: Container; labelCount: number; containerType: string | null }) => api.updateContainer(order.id, c.id, { labelCount, containerType }), onSuccess: done })
  const add = useMutation({ mutationFn: (specimenTypeId: string) => api.addContainer(order.id, specimenTypeId), onSuccess: done })
  const remove = useMutation({ mutationFn: (c: Container) => api.removeContainer(order.id, c.id), onSuccess: done })

  const groups = [...new Set(order.containers.map((c) => c.specimenTypeId))]
  return (
    <Card>
      <CardHeader title={t('labels.manage')}>
        <Select value={adding} onChange={(e) => setAdding(e.target.value)} className="w-48" aria-label={t('specimen.type')}>
          <option value="">{t('labels.chooseSpecimen')}</option>
          {(specimens.data ?? [])
            .filter((s) => s.isActive)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameEn}
              </option>
            ))}
        </Select>
        <Button size="sm" variant="secondary" disabled={!adding} loading={add.isPending} onClick={() => add.mutate(adding)}>
          <Plus className="size-4" />
          {t('labels.addContainer')}
        </Button>
      </CardHeader>
      <div className="divide-y divide-rule">
        {groups.map((specimenTypeId) => {
          const containers = order.containers.filter((c) => c.specimenTypeId === specimenTypeId)
          return (
            <Fragment key={specimenTypeId}>
              <div className="flex items-center justify-between bg-page px-5 py-2 text-xs font-semibold text-ink-muted">
                <span>{containers[0].specimenName}</span>
                <span>{t('labels.containerCount', { n: containers.length })}</span>
              </div>
              {containers.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <span className="w-52 font-mono text-sm text-ink">{c.lsn}</span>
                  <Input
                    defaultValue={c.containerType ?? ''}
                    onBlur={(e) => e.target.value !== (c.containerType ?? '') && update.mutate({ c, labelCount: c.labelCount, containerType: e.target.value || null })}
                    className="w-48"
                    aria-label={t('specimen.containerType')}
                    placeholder={t('specimen.containerType')}
                  />
                  <label className="flex items-center gap-2 text-xs text-ink-muted">
                    {t('labels.copies')}
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      defaultValue={c.labelCount}
                      onBlur={(e) => Number(e.target.value) !== c.labelCount && update.mutate({ c, labelCount: Math.max(0, Math.min(20, Number(e.target.value) || 0)), containerType: c.containerType })}
                      className="w-20"
                    />
                  </label>
                  {c.status === 'Rejected' ? <span className="text-xs text-red-700">{t('containerStatus.Rejected')}</span> : null}
                  {c.testCodes.length === 0 && c.status === 'Pending' ? (
                    <IconButton label={t('common.remove')} danger onClick={() => remove.mutate(c)} className="ml-auto">
                      <Trash2 className="size-4" />
                    </IconButton>
                  ) : null}
                </div>
              ))}
            </Fragment>
          )
        })}
      </div>
      <div className="px-5">
        <ErrorNote error={update.error ?? add.error ?? remove.error} />
      </div>
    </Card>
  )
}
