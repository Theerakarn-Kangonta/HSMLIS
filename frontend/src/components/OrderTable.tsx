import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { OrderSummary } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { JourneyTrack } from './JourneyTrack'
import { UrgentBadge } from './lab'
import { Badge, DataTable, ProgressBar, SkeletonRows, tableBodyClass, tableHeadClass, tableRowClass, tdClass, thClass } from './ui'
import { PatientPhoto } from './PatientPhoto'

/** The orders list used by search, orders and the patient's history. Clicking a row opens the order. */
export function OrderTable({ orders, loading, progress = 'approved', actions, link = (o) => `/lab-orders/${o.id}` }: {
  orders: OrderSummary[] | undefined
  loading?: boolean
  progress?: 'approved' | 'entered'
  actions?: (order: OrderSummary) => ReactNode
  link?: (order: OrderSummary) => string
}) {
  const { t, formatDateTime, formatMoney } = useI18n()
  const navigate = useNavigate()
  return (
    <DataTable>
      <thead className={tableHeadClass}>
        <tr>
          <th className={thClass}>{t('order.no')}</th>
          <th className={thClass}>{t('patient.hn')}</th>
          <th className={thClass}>{t('patient.name')}</th>
          <th className={thClass}>{t('order.referrer')}</th>
          <th className={thClass}>{t('order.orderedAt')}</th>
          <th className={thClass}>{t('order.status')}</th>
          <th className={`${thClass} w-40`}>{t(progress === 'entered' ? 'order.entryProgress' : 'order.progress')}</th>
          <th className={`${thClass} text-right`}>{t('order.total')}</th>
          {actions ? <th className={thClass} /> : null}
        </tr>
      </thead>
      <tbody className={tableBodyClass}>
        {loading && !orders ? <SkeletonRows columns={actions ? 9 : 8} /> : null}
        {orders?.map((o) => {
          const done = progress === 'entered' ? o.enteredCount : o.approvedCount
          return (
            <tr key={o.id} className={`${tableRowClass} cursor-pointer`} onClick={() => navigate(link(o))}>
              <td className={tdClass} data-title>
                <span className="font-mono font-medium text-brand-700">{o.orderNo}</span>
                <span className="ml-2 inline-flex gap-1 align-middle">
                  {o.urgent ? <UrgentBadge /> : null}
                  {o.hasCritical ? <Badge tone="danger">{t('flag.critical')}</Badge> : null}
                </span>
              </td>
              <td className={`${tdClass} font-mono`} data-label={t('patient.hn')}>
                {o.hn}
              </td>
              <td className={tdClass} data-label={t('patient.name')}>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <PatientPhoto patientId={o.patientId} photoAt={o.patientPhotoAt} name={o.patientName} />
                  {o.patientName}
                </span>
              </td>
              <td className={`${tdClass} max-w-48 truncate text-ink-muted`} data-label={t('order.referrer')}>
                {o.referrerName ?? '–'}
              </td>
              <td className={`${tdClass} whitespace-nowrap text-ink-muted`} data-label={t('order.orderedAt')}>
                {formatDateTime(o.orderedAt)}
              </td>
              <td className={tdClass} data-label={t('order.status')}>
                <JourneyTrack order={o} />
              </td>
              <td className={tdClass} data-label={t('order.progress')}>
                <div className="flex items-center gap-2">
                  <ProgressBar value={done} max={o.itemCount} tone={done === o.itemCount ? 'success' : 'accent'} />
                  <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                    {done}/{o.itemCount}
                  </span>
                </div>
              </td>
              <td className={`${tdClass} text-right`} data-label={t('order.total')}>
                {formatMoney(o.total)}
              </td>
              {actions ? (
                <td className={`${tdClass} text-right`} data-actions onClick={(e) => e.stopPropagation()}>
                  {actions(o)}
                </td>
              ) : null}
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
