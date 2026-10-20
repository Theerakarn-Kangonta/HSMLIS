import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { liveUrl } from './api'

// Live updates. While someone is signed in, the browser keeps one SignalR connection to the API.
// After every save the API says what changed (areas and order ids, never the data), and this
// reloads the matching queries, so every open screen in the lab stays current without a refresh.
// Only queries on screen are refetched right away; the rest are marked stale for their next use.

/** Mirrors the backend's ChangeNotice. */
type ChangeNotice = { topics: string[]; orderIds: string[] | null }

/** The query keys (by first element) each backend topic affects. */
const topicKeys: Record<string, string[]> = {
  patients: ['patients', 'patients-recent', 'patient', 'patient-orders', 'search', 'dashboard'],
  orders: [
    'orders', 'checkin', 'checkin-waiting', 'worklist', 'results-kpi', 'previous-results', 'result-history',
    'patient-orders', 'patient-results', 'search', 'dashboard', 'billing-kpi', 'ar-summary',
  ],
  billing: ['invoices', 'invoice', 'billing-kpi', 'ar-summary', 'dashboard'],
  catalog: ['branches', 'departments', 'lab-tests', 'packages', 'referrers', 'specimen-types'],
  // A role change can change the signed-in user's own permissions.
  users: ['users', 'me'],
  organization: ['me'],
  audit: ['audit'],
}

/** Several saves often arrive together (an order, its tubes, its audit entry); reload once for all of them. */
const BATCH_MS = 250

export function useLiveUpdates(userId: string | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return
    let stopped = false
    const keys = new Set<string>()
    const orders = new Set<string>()
    let allOrders = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const flush = () => {
      timer = undefined
      invalidate(queryClient, keys, allOrders ? null : orders)
      keys.clear()
      orders.clear()
      allOrders = false
    }

    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(liveUrl, {
        withCredentials: true,
        // Sent on the start-up request and the fallback transports; the API refuses changing requests without it.
        headers: { 'X-Requested-With': 'HSMLIS' },
      })
      // Keep trying for as long as the page is open: the API may be asleep or redeploying.
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => Math.min(30_000, 1_000 * 2 ** ctx.previousRetryCount) })
      .configureLogging(LogLevel.None)
      .build()

    connection.on('changed', (notice: ChangeNotice) => {
      for (const topic of notice.topics) for (const key of topicKeys[topic] ?? []) keys.add(key)
      if (notice.orderIds === null) allOrders = true
      else for (const id of notice.orderIds) orders.add(id)
      timer ??= setTimeout(flush, BATCH_MS)
    })

    // Anything may have changed while the connection was down.
    connection.onreconnected(() => void queryClient.invalidateQueries())

    // The automatic reconnect only covers a connection that was up once. Before that, and after a
    // close (e.g. the session expired), try again with the same back-off.
    let attempt = 0
    const start = async () => {
      if (stopped || connection.state !== HubConnectionState.Disconnected) return
      try {
        await connection.start()
        if (attempt > 0) void queryClient.invalidateQueries()
        attempt = 0
      } catch {
        if (stopped) return
        attempt++
        setTimeout(start, Math.min(30_000, 1_000 * 2 ** attempt))
      }
    }
    connection.onclose(() => {
      if (stopped) return
      attempt++
      setTimeout(start, Math.min(30_000, 1_000 * 2 ** attempt))
    })
    void start()

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      void connection.stop()
    }
  }, [userId, queryClient])
}

function invalidate(queryClient: QueryClient, keys: Set<string>, orders: Set<string> | null) {
  if (keys.size === 0 && orders?.size === 0) return
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }: { queryKey: QueryKey }) => {
      const [first, second] = queryKey
      if (typeof first !== 'string') return false
      if (keys.has(first)) return true
      if (first !== 'order') return false
      return orders === null || (typeof second === 'string' && orders.has(second))
    },
  })
}
