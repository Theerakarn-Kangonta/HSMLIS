import { ArrowDown, ArrowUp, Ban, CheckCheck, CircleCheck, CircleDashed, Clock, FlaskConical, TestTube, TriangleAlert, XCircle, Zap } from 'lucide-react'
import type { ContainerStatus, InvoiceStatus, OrderStatus, ResultFlag, ResultStatus } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { Badge, type Tone } from './ui'

const orderTones: Record<OrderStatus, Tone> = { AwaitingCollection: 'warn', InProgress: 'info', Completed: 'success', Cancelled: 'neutral' }
const orderIcons = { AwaitingCollection: Clock, InProgress: FlaskConical, Completed: CircleCheck, Cancelled: Ban }

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n()
  return (
    <Badge tone={orderTones[status]} icon={orderIcons[status]}>
      {t(`orderStatus.${status}`)}
    </Badge>
  )
}

const containerTones: Record<ContainerStatus, Tone> = { Pending: 'warn', Collected: 'info', Received: 'success', Rejected: 'danger' }
const containerIcons = { Pending: CircleDashed, Collected: TestTube, Received: CircleCheck, Rejected: XCircle }

export function ContainerStatusBadge({ status }: { status: ContainerStatus }) {
  const { t } = useI18n()
  return (
    <Badge tone={containerTones[status]} icon={containerIcons[status]}>
      {t(`containerStatus.${status}`)}
    </Badge>
  )
}

const resultTones: Record<ResultStatus, Tone> = { Pending: 'neutral', Entered: 'info', Verified: 'accent', Approved: 'success', Cancelled: 'neutral' }
const resultIcons = { Pending: CircleDashed, Entered: Clock, Verified: CheckCheck, Approved: CircleCheck, Cancelled: Ban }

export function ResultStatusBadge({ status }: { status: ResultStatus }) {
  const { t } = useI18n()
  return (
    <Badge tone={resultTones[status]} icon={resultIcons[status]}>
      {t(`resultStatus.${status}`)}
    </Badge>
  )
}

const invoiceTones: Record<InvoiceStatus, Tone> = { Unpaid: 'danger', Partial: 'warn', Paid: 'success', Cancelled: 'neutral' }

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useI18n()
  return <Badge tone={invoiceTones[status]}>{t(`invoiceStatus.${status}`)}</Badge>
}

export const isCritical = (flag: ResultFlag) => flag === 'CriticalLow' || flag === 'CriticalHigh'

/** H, L, HH, LL, A or POS, each with its own shape so it is not told by colour alone. */
export function FlagBadge({ flag }: { flag: ResultFlag }) {
  const { t } = useI18n()
  if (flag === 'None') return null
  const tone: Tone = isCritical(flag) || flag === 'Positive' ? 'danger' : 'warn'
  const icon = flag === 'Low' || flag === 'CriticalLow' ? ArrowDown : flag === 'High' || flag === 'CriticalHigh' ? ArrowUp : TriangleAlert
  return (
    <span title={t(`flagName.${flag}`)}>
      <Badge tone={tone} icon={icon} className={isCritical(flag) ? 'ring-2 ring-red-300' : ''}>
        {t(`flag.${flag}`)}
      </Badge>
    </span>
  )
}

export function UrgentBadge() {
  const { t } = useI18n()
  return (
    <Badge tone="danger" icon={Zap}>
      {t('order.urgent')}
    </Badge>
  )
}
