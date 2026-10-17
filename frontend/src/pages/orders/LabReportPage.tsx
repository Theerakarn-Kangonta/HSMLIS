import { ArrowLeft, Printer } from 'lucide-react'
import { Fragment } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Barcode } from '../../components/Barcode'
import { Button, ErrorNote, SkeletonCards, focusRing } from '../../components/ui'
import { today } from '../../lib/dates'
import type { OrderItem } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { useOrder } from './OrderDetailPage'

const flagMark: Record<OrderItem['flag'], string> = { None: '', Low: 'L', High: 'H', CriticalLow: 'LL', CriticalHigh: 'HH', Abnormal: 'A', Positive: 'POS' }

/** The patient's A4 report: approved results only, grouped by department, with who reported, verified and approved. */
export function LabReportPage() {
  const { id } = useParams()
  const { t, formatDateTime, formatDate } = useI18n()
  const { me } = useAuth()
  const query = useOrder(id)
  const o = query.data
  if (!o) return <div className="p-6">{query.error ? <ErrorNote error={query.error} /> : <SkeletonCards />}</div>

  const approved = o.items.filter((i) => i.resultStatus === 'Approved')
  const outstanding = o.items.filter((i) => i.resultStatus !== 'Approved' && i.resultStatus !== 'Cancelled')
  const departments = [...new Map(approved.map((i) => [i.departmentId, i.departmentName])).entries()]
  const people = (pick: (i: OrderItem) => string | null) => [...new Set(approved.map(pick).filter(Boolean))].join(', ')
  const lastApproved = approved.map((i) => i.approvedAt!).sort().at(-1)
  const org = me?.organization

  const box = 'grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-0.5'
  return (
    <div className="min-h-screen bg-page print:bg-white">
      <style>{'@media print { @page { size: A4; margin: 12mm } }'}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-rule bg-surface px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/lab-orders/${o.id}`} className={`flex size-8 items-center justify-center rounded-md border border-rule text-ink-muted hover:text-ink ${focusRing}`} aria-label={t('common.back')}>
            <ArrowLeft className="size-4" />
          </Link>
          <p className="truncate font-semibold text-ink">
            {t('report.title')} - <span className="font-mono">{o.orderNo}</span>
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          {t('common.print')}
        </Button>
      </div>

      <article className="paper mx-auto my-6 w-[210mm] max-w-full p-[12mm] text-[10.5pt] shadow-md print:my-0 print:w-auto print:p-0">
        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <p className="text-[15pt] font-bold leading-tight">{org?.nameTh}</p>
            {org?.nameEn ? <p className="text-[11pt]">{org.nameEn}</p> : null}
            <p className="text-[9pt] text-gray-700">{[org?.address, org?.phone ? `โทร ${org.phone}` : null].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="text-right">
            <p className="text-[16pt] font-bold">ใบรายงานผลตรวจ</p>
            <p className="text-[10pt]">Laboratory Report</p>
          </div>
        </header>

        <section className="mt-3 grid grid-cols-[1fr_auto] gap-3 border border-gray-400 p-2.5 text-[9.5pt]">
          <div className="grid grid-cols-2 gap-x-4">
            <div className={box}>
              <span className="text-gray-600">ชื่อ-สกุล / Name</span>
              <span className="font-semibold">
                {o.patient.fullName}
                {o.patient.firstNameEn ? <span className="block font-normal">{`${o.patient.firstNameEn} ${o.patient.lastNameEn ?? ''}`}</span> : null}
              </span>
              <span className="text-gray-600">HN</span>
              <span>{o.patient.hn}</span>
              <span className="text-gray-600">เพศ / อายุ</span>
              <span>
                {t(`sex.${o.patient.sex}`)}
                {o.patient.ageYears !== null ? ` / ${o.patient.ageYears} ปี` : ''}
              </span>
              <span className="text-gray-600">สัญชาติ</span>
              <span>{o.patient.nationality ?? '-'}</span>
              <span className="text-gray-600">สิทธิการรักษา</span>
              <span>{o.entitlement ?? '-'}</span>
            </div>
            <div className={box}>
              <span className="text-gray-600">หน่วยงานส่งตรวจ</span>
              <span>{o.referrer ? `${o.referrer.name} (${o.referrer.code})` : '-'}</span>
              <span className="text-gray-600">เวลาสั่งตรวจ</span>
              <span>{formatDateTime(o.orderedAt)}</span>
              <span className="text-gray-600">วันที่รับตัวอย่าง</span>
              <span>{o.receivedAt ? formatDateTime(o.receivedAt) : '-'}</span>
              <span className="text-gray-600">วันที่รายงาน</span>
              <span>{lastApproved ? formatDateTime(lastApproved) : '-'}</span>
              <span className="text-gray-600">สัญญาณชีพ</span>
              <span>
                {[o.bpSystolic && o.bpDiastolic ? `BP ${o.bpSystolic}/${o.bpDiastolic}` : null, o.heartRate ? `PR ${o.heartRate}` : null, o.weightKg ? `${o.weightKg} kg` : null, o.heightCm ? `${o.heightCm} cm` : null, o.bmi ? `BMI ${o.bmi}` : null]
                  .filter(Boolean)
                  .join(' · ') || '-'}
              </span>
            </div>
          </div>
          <div className="w-44 border-l border-gray-400 pl-3 text-center">
            <p className="text-[8.5pt] text-gray-600">Lab Number</p>
            <p className="font-mono text-[10pt] font-bold">{o.orderNo}</p>
            <Barcode value={o.orderNo} height={30} className="mt-1" />
          </div>
        </section>

        <table className="mt-4 w-full border-collapse text-[9.5pt]">
          <thead>
            <tr className="border-y-2 border-black text-left">
              <th className="py-1.5 pr-2">รายการตรวจ / Test</th>
              <th className="py-1.5 pr-2">ผลตรวจ / Result</th>
              <th className="py-1.5 pr-2 text-center">Flag</th>
              <th className="py-1.5 pr-2">หน่วย / Unit</th>
              <th className="py-1.5 pr-2">ค่าอ้างอิง / Reference</th>
              <th className="py-1.5">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {departments.map(([depId, depName]) => (
              <Fragment key={depId}>
                <tr>
                  <td colSpan={6} className="pb-0.5 pt-2.5 text-[10pt] font-bold underline">
                    {depName}
                  </td>
                </tr>
                {approved
                  .filter((i) => i.departmentId === depId)
                  .map((i) => (
                    <tr key={i.id} className="border-b border-gray-300 align-top">
                      <td className="py-1 pr-2 pl-3">
                        {i.testNameEn}
                        {i.testNameTh ? <span className="block text-[8.5pt] text-gray-600">{i.testNameTh}</span> : null}
                      </td>
                      <td className={`py-1 pr-2 ${i.flag !== 'None' ? 'font-bold' : ''}`}>{i.value}</td>
                      <td className="py-1 pr-2 text-center font-bold">{flagMark[i.flag]}</td>
                      <td className="py-1 pr-2">{i.unit ?? ''}</td>
                      <td className="py-1 pr-2">{i.refText ?? ''}</td>
                      <td className="py-1 text-[8.5pt]">{i.comment ?? ''}</td>
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        {approved.length === 0 ? <p className="mt-6 text-center text-gray-600">ยังไม่มีผลตรวจที่อนุมัติแล้ว</p> : null}
        {outstanding.length > 0 ? (
          <p className="mt-3 text-[9pt] italic text-gray-700">
            รายการที่ยังไม่รายงาน ({outstanding.length}): {outstanding.map((i) => i.testCode).join(', ')}
          </p>
        ) : null}

        <p className="mt-4 text-[8.5pt] text-gray-600">L = ต่ำกว่าค่าอ้างอิง, H = สูงกว่าค่าอ้างอิง, LL / HH = ค่าวิกฤต, A = ผิดปกติ, POS = ผลบวก · ผลการตรวจนี้รับรองเฉพาะตัวอย่างที่ห้องปฏิบัติการได้รับ</p>

        <footer className="mt-8 grid grid-cols-3 gap-6 text-center text-[9pt]">
          {[
            { label: 'ผู้รายงานผล / Reported by', who: people((i) => i.enteredByName) },
            { label: 'ผู้ตรวจสอบ / Verified by', who: people((i) => i.verifiedByName) },
            { label: 'ผู้อนุมัติ / Approved by', who: people((i) => i.approvedByName) },
          ].map((p) => (
            <div key={p.label}>
              <div className="h-8 border-b border-dotted border-gray-500" />
              <p className="mt-1 font-semibold">{p.who || '-'}</p>
              <p className="text-gray-600">{p.label}</p>
            </div>
          ))}
        </footer>
        <p className="mt-6 text-right text-[8pt] text-gray-500">พิมพ์เมื่อ {formatDate(today())} · HSMLIS</p>
      </article>
    </div>
  )
}
