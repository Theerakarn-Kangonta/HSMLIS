import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/ui'
import { api } from './api'
import { useI18n } from './i18n'

/** A barcode reader types a key every few milliseconds; people take 80 ms or more. */
const MAX_GAP_MS = 40
const MIN_LENGTH = 4

/**
 * Tells a barcode reader from a person: a run of keys, each within MAX_GAP_MS of the last, ended by Enter.
 * Returns the scanned text on that Enter, otherwise null.
 */
export function createScanBuffer() {
  let text = ''
  let last = 0
  return (key: string, at: number): string | null => {
    const fast = at - last <= MAX_GAP_MS
    last = at
    if (key === 'Enter') {
      const code = fast && text.length >= MIN_LENGTH ? text : null
      text = ''
      return code
    }
    if (key.length !== 1) return null
    text = fast ? text + key : key
    return null
  }
}

const editable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

/**
 * Scan a specimen label or order number on any page to open that order. A field with focus keeps its
 * scans (the search box, a result input), so this only acts when no field is being typed in.
 */
export function useScanAnywhere(enabled: boolean) {
  const navigate = useNavigate()
  const toast = useToast()
  const { t } = useI18n()
  useEffect(() => {
    if (!enabled) return
    const push = createScanBuffer()
    const onKey = (e: KeyboardEvent) => {
      if (editable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const code = push(e.key, e.timeStamp)
      if (!code) return
      e.preventDefault()
      api
        .search(code)
        .then((found) => {
          if (found.orders.length === 1) {
            toast(t('scan.opened', { code }))
            navigate(`/lab-orders/${found.orders[0].id}`)
          } else if (found.orders.length > 1) navigate(`/search?q=${encodeURIComponent(code)}`)
          else toast(t('scan.notFound', { code }), 'error')
        })
        .catch(() => toast(t('scan.notFound', { code }), 'error'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, navigate, toast, t])
}
