import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button, ErrorNote, SkeletonCards, focusRing } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'

/** The printable A4 invoice. Unpaid ones carry a watermark saying so. */
export function InvoiceDocPage() {
  const { id } = useParams()
  const { t, formatMoney, formatDate, formatDateTime } = useI18n()
  const { me } = useAuth()
  const query = useQuery({ queryKey: ['invoice', id], queryFn: () => api.invoice(id!) })
  const d = query.data
  if (!d) return <div className="p-6">{query.error ? <ErrorNote error={query.error} /> : <SkeletonCards />}</div>
  const inv = d.invoice
  const org = me?.organization
  const watermark = inv.status === 'Paid' ? null : inv.status === 'Cancelled' ? 'ยกเลิก' : 'รอชำระ'

  return (
    <div className="min-h-screen bg-page print:bg-white">
      <style>{'@media print { @page { size: A4; margin: 14mm } }'}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-rule bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link to="/billing" className={`flex size-8 items-center justify-center rounded-md border border-rule text-ink-muted hover:text-ink ${focusRing}`} aria-label={t('common.back')}>
            <ArrowLeft className="size-4" />
          </Link>
          <p className="font-semibold text-ink">
            {t('billing.document')} - <span className="font-mono">{inv.invoiceNo}</span>
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          {t('common.print')}
        </Button>
      </div>

      <article className="paper relative mx-auto my-6 w-[210mm] max-w-full overflow-hidden p-[14mm] text-[11pt] shadow-md print:my-0 print:w-auto print:p-0">
        {watermark ? (
          <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-30 select-none text-[72pt] font-bold text-red-500/15" aria-hidden>
            {watermark}
          </span>
        ) : null}
        <header className="flex justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <p className="text-[15pt] font-bold">{org?.nameTh}</p>
            <p className="text-[9.5pt] text-gray-700">{org?.address}</p>
            <p className="text-[9.5pt] text-gray-700">{[org?.phone ? `โทร ${org.phone}` : null, org?.taxId ? `เลขประจำตัวผู้เสียภาษี ${org.taxId}` : null].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="text-right">
            <p className="text-[18pt] font-bold">ใบแจ้งหนี้</p>
            <p className="text-[10pt]">INVOICE</p>
          </div>
        </header>
        <section className="mt-4 grid grid-cols-2 gap-6 text-[10pt]">
          <div>
            <p className="text-gray-600">ลูกค้า / Bill to</p>
            <p className="font-semibold">{inv.patientName}</p>
            <p>HN {inv.hn}</p>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 text-right">
            <span className="text-gray-600">เลขที่</span>
            <span className="font-mono">{inv.invoiceNo}</span>
            <span className="text-gray-600">วันที่</span>
            <span>{formatDate(inv.issuedAt)}</span>
            <span className="text-gray-600">อ้างอิงใบสั่งตรวจ</span>
            <span className="font-mono">{inv.orderNo}</span>
          </div>
        </section>
        <table className="mt-5 w-full border-collapse text-[10pt]">
          <thead>
            <tr className="border-y-2 border-black text-left">
              <th className="w-10 py-1.5">#</th>
              <th className="py-1.5">รหัส</th>
              <th className="py-1.5">รายการ</th>
              <th className="py-1.5 text-right">จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((line, i) => (
              <tr key={`${line.code}-${i}`} className="border-b border-gray-300">
                <td className="py-1.5">{i + 1}</td>
                <td className="py-1.5 font-mono">{line.code}</td>
                <td className="py-1.5">
                  {line.name}
                  {line.packageCode ? <span className="ml-1 text-[9pt] text-gray-600">(แพ็กเกจ)</span> : null}
                </td>
                <td className="py-1.5 text-right">{formatMoney(line.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-4 w-72 space-y-1 text-[10.5pt]">
          <div className="flex justify-between">
            <dt>รวมเป็นเงิน</dt>
            <dd>{formatMoney(d.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>ส่วนลด</dt>
            <dd>{formatMoney(d.discount)}</dd>
          </div>
          <div className="flex justify-between border-t-2 border-black pt-1 text-[12pt] font-bold">
            <dt>ยอดสุทธิ</dt>
            <dd>{formatMoney(inv.amount)}</dd>
          </div>
          <div className="flex justify-between text-gray-700">
            <dt>ชำระแล้ว</dt>
            <dd>{formatMoney(inv.paid)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>คงค้าง</dt>
            <dd>{formatMoney(inv.balance)}</dd>
          </div>
        </dl>
        {inv.payments.length > 0 ? (
          <div className="mt-4 text-[9.5pt] text-gray-700">
            <p className="font-semibold">การชำระเงิน</p>
            {inv.payments.map((p) => (
              <p key={p.id}>
                {formatDateTime(p.paidAt)} · {t(`paymentMethod.${p.method}`)} · {formatMoney(p.amount)} · {p.receivedByName}
              </p>
            ))}
          </div>
        ) : null}
        <footer className="mt-14 grid grid-cols-2 gap-10 text-center text-[10pt]">
          {['ผู้ออกใบแจ้งหนี้', 'ผู้อนุมัติ'].map((label) => (
            <div key={label}>
              <div className="h-8 border-b border-dotted border-gray-500" />
              <p className="mt-1 text-gray-700">{label}</p>
            </div>
          ))}
        </footer>
        <p className="mt-10 text-center text-[10pt] text-gray-600">ขอบคุณที่ใช้บริการ</p>
      </article>
    </div>
  )
}
