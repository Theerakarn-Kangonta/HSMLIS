import type { OrderSummary } from './api'

export const STAGES = ['ordered', 'collected', 'received', 'testing', 'approved'] as const
export type Stage = (typeof STAGES)[number]

/** How far an order's specimens have travelled: the last stage every part of it has reached at least partly. */
export function stageOf(o: Pick<OrderSummary, 'status' | 'collectedCount' | 'receivedCount' | 'enteredCount'>): number {
  if (o.status === 'Completed') return 4
  if (o.enteredCount > 0) return 3
  if (o.receivedCount > 0) return 2
  if (o.collectedCount > 0) return 1
  return 0
}

/**
 * An open order past its expected turnaround: 2 hours when urgent, a day otherwise.
 * shortcut: fixed limits for every test, until tests carry their own turnaround time.
 */
export function isLate(o: Pick<OrderSummary, 'status' | 'urgent' | 'orderedAt'>, now = Date.now()) {
  if (o.status === 'Completed' || o.status === 'Cancelled') return false
  return now - new Date(o.orderedAt).getTime() > (o.urgent ? 2 : 24) * 3_600_000
}
