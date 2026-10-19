import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Printer, Trash2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Barcode } from '../../components/Barcode'
import { Button, Callout, Card, CardHeader, ErrorNote, IconButton, Input, Select, SkeletonCards, focusRing } from '../../components/ui'
import { api, type Container, type OrderDetail } from '../../lib/api'
import { useSpecimenTypes } from '../../lib/catalog'
import { useI18n } from '../../lib/i18n'
import { QzError, findLabelPrinter, listPrinters, savePrinter, savedPrinter } from '../../lib/qz'
import { LABEL, printSpecimenLabels } from '../../lib/specimenLabel'
import { useOrder } from './OrderDetailPage'

/** The vertical order number, in mm. A monospace digit takes 0.6em plus the letter spacing. */
const DIGIT = { font: 3.2, spacing: 0.1 }
/** Height of the patient-name row, in mm; the order number's last digit is centred on it. */
const NAME_ROW = 3.2
const LAST_DIGIT_PAD = NAME_ROW / 2 - DIGIT.spacing - (DIGIT.font * 0.6) / 2

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
        <SilentPrint order={o} disabled={labels.length === 0} />
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
  return (
    <div
      className="paper mx-auto flex gap-[1.2mm] overflow-hidden rounded-md border border-slate-300 py-[1.5mm] pr-[2mm] pl-[1mm] shadow-sm print:break-after-page print:rounded-none print:border-0"
      style={{ width: `${LABEL.width}mm`, height: `${LABEL.height}mm`, fontSize: '2.3mm', lineHeight: 1.15 }}
    >
      {/* Turned 90° to the left, so it reads normally once the label is upright on the tube. */}
      <div
        className="flex shrink-0 items-center justify-end border-r border-black pr-[0.8mm] font-mono font-bold"
        style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontSize: `${DIGIT.font}mm`,
          letterSpacing: `${DIGIT.spacing}mm`,
          lineHeight: 1,
          // After the rotation the end of the number is at the top: the last digit lines up with the name.
          paddingInlineEnd: `${LAST_DIGIT_PAD}mm`,
        }}
      >
        {order.orderNo}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-[1.5mm]">
        <div>
          <div className="flex items-center justify-between gap-1" style={{ height: `${NAME_ROW}mm` }}>
            <span className="truncate font-bold" style={{ fontSize: '2.7mm' }}>
              {order.patient.fullName}
            </span>
            {order.urgent ? <span className="shrink-0 rounded-sm bg-black px-[0.8mm] font-bold text-white">URGENT</span> : null}
          </div>
          <div className="flex justify-between gap-1">
            <span>HN {order.patient.hn}</span>
            <span className="truncate">{order.referrer?.code ?? ''}</span>
          </div>
        </div>
        <Barcode value={container.lsn} height={22} className="!h-[6mm] shrink-0" />
        {/* Wraps (only after a comma) instead of cutting off, so every test code is printed. */}
        <div className="min-h-0 overflow-hidden break-words" style={{ fontSize: '2mm', lineHeight: 1.1 }}>
          {container.specimenName} · {container.testCodes.join(',\u200b')}
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

/**
 * Prints straight to this PC's label printer through QZ Tray. When QZ Tray is missing or fails,
 * it says why and offers the browser's print dialog instead.
 */
function SilentPrint({ order, disabled }: { order: OrderDetail; disabled: boolean }) {
  const { t, errorText } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [done, setDone] = useState<string | null>(null)
  /** Shown when this PC's label printer has to be chosen. */
  const [choices, setChoices] = useState<string[] | null>(null)
  const [printer, setPrinter] = useState(savedPrinter)

  async function run(work: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      await work()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const print = (chosen?: string) =>
    run(async () => {
      let target = chosen ?? null
      if (!target) {
        const found = await findLabelPrinter()
        if (!found.printer) {
          setChoices(found.printers)
          return
        }
        target = found.printer
      }
      savePrinter(target)
      setPrinter(target)
      setChoices(null)
      const n = await printSpecimenLabels(order, target)
      setDone(t('labels.printed', { n, printer: target }))
    })

  const change = () =>
    run(async () => {
      setChoices(await listPrinters())
    })

  const message =
    error instanceof QzError ? t(error.reason === 'not_running' ? 'labels.qzNotRunning' : 'labels.noPrinters') : error ? errorText(error) : null

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {printer && !choices ? (
        <button type="button" onClick={change} className={`max-w-48 truncate rounded text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline ${focusRing}`} title={t('labels.changePrinter')}>
          {printer}
        </button>
      ) : null}
      {choices ? (
        <PrinterChoice printers={choices} initial={printer} busy={busy} onChoose={(p) => print(p)} onCancel={() => setChoices(null)} />
      ) : (
        <Button onClick={() => print()} disabled={disabled} loading={busy}>
          <Printer className="size-4" />
          {t('common.print')}
        </Button>
      )}
      {message ? (
        <div className="basis-full">
          <Callout tone="danger" role="alert">
            <span>{message}</span>{' '}
            <button type="button" onClick={() => window.print()} className={`font-semibold underline ${focusRing}`}>
              {t('labels.printBrowser')}
            </button>
          </Callout>
        </div>
      ) : null}
      {done ? (
        <div className="basis-full">
          <Callout tone="success">{done}</Callout>
        </div>
      ) : null}
    </div>
  )
}

function PrinterChoice({ printers, initial, busy, onChoose, onCancel }: { printers: string[]; initial: string | null; busy: boolean; onChoose: (printer: string) => void; onCancel: () => void }) {
  const { t } = useI18n()
  const [value, setValue] = useState(initial && printers.includes(initial) ? initial : printers[0])
  return (
    <>
      <span className="text-xs text-ink-muted">{t('labels.choosePrinter')}</span>
      <Select value={value} onChange={(e) => setValue(e.target.value)} className="w-56" aria-label={t('labels.printer')}>
        {printers.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        {t('common.cancel')}
      </Button>
      <Button onClick={() => onChoose(value)} loading={busy}>
        <Printer className="size-4" />
        {t('common.print')}
      </Button>
    </>
  )
}
