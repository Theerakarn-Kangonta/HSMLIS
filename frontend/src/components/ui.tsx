import { CircleAlert, CircleCheck, FlaskConical, Info, Languages, LoaderCircle, Moon, Search, Sun, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import {
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { Link } from 'react-router-dom'
import { useBackLink } from '../lib/backLink'
import { useI18n } from '../lib/i18n'
import { useTheme } from '../lib/theme'

// ---------- tones ----------

/** What a message, badge or icon is about. Always shown with an icon or words too, never by colour alone. */
export type Tone = 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'accent'

export const toneStyles: Record<Tone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
  accent: 'border-brand-100 bg-brand-50 text-brand-700',
}

// ---------- buttons ----------

const buttonVariants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
  secondary: 'border border-slate-300 bg-surface text-ink hover:border-slate-400 hover:bg-page active:bg-slate-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  dangerOutline: 'border border-red-200 bg-surface text-red-700 hover:bg-red-50',
  ghost: 'text-ink-muted hover:bg-slate-100 hover:text-ink active:bg-slate-200',
}

export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const buttonBase = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 pointer-coarse:h-11 ${focusRing}`

const buttonSizes = { md: 'h-9 px-4 text-sm', sm: 'h-8 px-3 text-xs', lg: 'h-11 px-5 text-base' }

export type ButtonVariant = keyof typeof buttonVariants

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: keyof typeof buttonSizes; loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonBase} ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
      {children}
    </button>
  )
}

/** A link that looks like a button: for an action that is really a move to another page. */
export function LinkButton({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: keyof typeof buttonSizes }) {
  return <Link {...props} className={`${buttonBase} ${buttonSizes[size]} ${buttonVariants[variant]} ${className}`} />
}

/** A button that is only an icon. `label` is what it does: read out, and shown on hover. */
export function IconButton({
  label,
  danger,
  className = '',
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'title'> & { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      aria-label={label}
      title={label}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-40 pointer-coarse:size-11 ${focusRing} ${
        danger ? 'text-ink-muted hover:bg-red-50 hover:text-red-700' : 'text-ink-muted hover:bg-slate-100 hover:text-ink'
      } ${className}`}
    >
      {children}
    </button>
  )
}

// ---------- form controls ----------

// Full width unless the caller gives a width of its own (two width classes would fight).
const width = (className: string) => (/(^|\s)(w-|max-w-)/.test(className) ? '' : 'w-full')

const controlBase =
  'rounded-md border border-slate-300 bg-surface px-3 text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:bg-slate-100 disabled:text-ink-muted'
const controlClass = `${controlBase} h-9 text-sm pointer-coarse:h-11 pointer-coarse:text-base`

export function Input({ className = '', large = false, ...props }: ComponentProps<'input'> & { large?: boolean }) {
  return <input {...props} className={`${large ? `${controlBase} h-12 text-lg` : controlClass} ${width(className)} ${className}`} />
}

export function Textarea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return <textarea rows={3} {...props} className={`${controlBase} py-2 text-sm ${width(className)} ${className}`} />
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} pr-8 ${width(className)} ${className}`} />
}

/** A search box: a magnifier so it reads as one at a glance, and a button to empty it. */
export function SearchInput({
  value,
  onChange,
  className = '',
  large,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & { value: string; onChange: (value: string) => void; large?: boolean }) {
  const { t } = useI18n()
  return (
    <div className={`relative ${className}`}>
      <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle ${large ? 'size-5' : 'size-4'}`} aria-hidden />
      <Input {...props} large={large} type="text" inputMode="search" enterKeyHint="search" role="searchbox" className={large ? 'px-11' : 'px-9'} value={value} onChange={(e) => onChange(e.target.value)} />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('common.clearSearch')}
          title={t('common.clearSearch')}
          className={`absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted hover:bg-slate-100 hover:text-ink ${focusRing}`}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

/** A labelled form field. A field whose control is `required` is marked with an asterisk. */
export function Field({ label, hint, className = '', children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  const { t } = useI18n()
  const required = isValidElement<{ required?: boolean }>(children) && children.props.required === true
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="block text-xs font-semibold text-slate-700">
        {label}
        {required ? (
          <span className="text-negative" title={t('common.required')}>
            {' '}
            <span aria-hidden>*</span>
            <span className="sr-only">({t('common.required')})</span>
          </span>
        ) : null}
      </span>
      {children}
      {hint ? <span className="block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  )
}

export function Checkbox({ label, className = '', ...props }: Omit<ComponentProps<'input'>, 'type'> & { label?: ReactNode }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 text-sm text-ink ${className}`}>
      <input type="checkbox" {...props} className="size-4 rounded-sm border-slate-300 accent-brand-600" />
      {label}
    </label>
  )
}

/** An on/off switch for a setting such as "active". */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-50 ${focusRing} ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}
    >
      <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform duration-150 ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  )
}

// ---------- surfaces ----------

export function Card({ id, className = '', children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={`rounded-xl border border-rule bg-surface shadow-xs ${className}`}>
      {children}
    </section>
  )
}

/** The title row of a card, with optional actions on the right. */
export function CardHeader({ title, description, icon: Icon, children }: { title: ReactNode; description?: ReactNode; icon?: LucideIcon; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon ? <Icon className="size-4.5 shrink-0 text-brand-600" aria-hidden /> : null}
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
          {description ? <p className="text-xs text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

export function Logo({ className = 'size-9' }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm ${className}`}>
      <FlaskConical className="size-3/5" />
    </span>
  )
}

/** Language and theme switches, shown in the header and on the sign-in page. */
export function DisplayToggles() {
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const buttonClass = `flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold text-ink-muted transition-colors duration-150 hover:bg-slate-100 hover:text-ink pointer-coarse:h-11 pointer-coarse:min-w-11 ${focusRing}`
  const themeLabel = t(theme === 'dark' ? 'theme.switchToLight' : 'theme.switchToDark')
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={buttonClass} onClick={() => setLang(lang === 'th' ? 'en' : 'th')} aria-label={t('lang.switch')} title={t('lang.switch')}>
        <Languages className="size-4" />
        {lang === 'th' ? 'EN' : 'ไทย'}
      </button>
      <button type="button" className={buttonClass} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={themeLabel} title={themeLabel}>
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
    </div>
  )
}

/** The top of a page: what it is, what it is for, a way back, and its main actions. */
export function PageHeader({ title, description, back, children }: { title: ReactNode; description?: ReactNode; back?: string; children?: ReactNode }) {
  // The back link is drawn in the app shell's sticky top bar, so it stays reachable while scrolling.
  useBackLink(back)
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 print:hidden">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-ink">{title}</h1>
          {description ? <p className="mt-1 max-w-prose text-sm text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  )
}

/** Row above a section's content: filters on the left, actions on the right. */
export function Toolbar({ actions, children }: { actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-3 print:hidden">
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{children}</div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

const toneIcons: Record<Tone, LucideIcon> = { neutral: Info, info: Info, success: CircleCheck, warn: TriangleAlert, danger: CircleAlert, accent: Info }

export function Callout({ tone = 'neutral', role = 'status', children }: { tone?: Tone; role?: 'status' | 'alert'; children: ReactNode }) {
  const Icon = toneIcons[tone]
  return (
    <div role={role} className={`flex items-start gap-2.5 rounded-md border px-3 py-2 text-sm ${toneStyles[tone]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  const { errorText } = useI18n()
  if (!error) return null
  return (
    <Callout tone="danger" role="alert">
      {errorText(error)}
    </Callout>
  )
}

/** A short label on a tinted background, for a state or a kind. */
export function Badge({ tone = 'neutral', icon: Icon, className = '', children }: { tone?: Tone; icon?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-xs font-semibold ${toneStyles[tone]} ${className}`}>
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      {children}
    </span>
  )
}

/** A department's colour as a dot, next to its name. */
export function ColorDot({ color, className = '' }: { color: string; className?: string }) {
  return <span className={`inline-block size-2.5 shrink-0 rounded-full ${className}`} style={{ backgroundColor: color }} aria-hidden />
}

export function EmptyState({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-ink-subtle">
        <Icon className="size-6" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-ink-muted">{hint}</p> : null}
      {children ? <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  )
}

/** Big number with a label and an icon on a soft tint: the top of the dashboards. */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'accent',
  onClick,
  to,
  active,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
  tone?: 'accent' | 'success' | 'info' | 'warn' | 'danger' | 'violet'
  onClick?: () => void
  /** Opens the list behind the figure. */
  to?: string
  active?: boolean
}) {
  const tints = {
    accent: 'bg-brand-50 text-brand-600',
    success: 'bg-emerald-50 text-emerald-600',
    info: 'bg-sky-50 text-sky-600',
    warn: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${tints[tone]}`}>
            <Icon className="size-4" aria-hidden />
          </span>
          <p className="truncate text-xs font-medium text-ink-muted">{label}</p>
        </div>
        <p title={typeof value === 'string' ? value : undefined} className={`mt-2 truncate text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-red-600' : 'text-ink'}`}>{value}</p>
        {hint ? <p title={typeof hint === 'string' ? hint : undefined} className="mt-0.5 truncate text-xs text-ink-muted">{hint}</p> : null}
      </div>
    </>
  )
  const className = `flex items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-left shadow-xs ${active ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-rule'}`
  if (to)
    return (
      <Link to={to} className={`${className} transition-colors hover:border-brand-300 hover:shadow-sm ${focusRing}`}>
        {body}
      </Link>
    )
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} transition-colors hover:border-brand-200 ${focusRing}`} aria-pressed={active}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
}

export function ProgressBar({ value, max, tone = 'accent', className = '' }: { value: number; max: number; tone?: 'accent' | 'success' | 'warn'; className?: string }) {
  const percent = max > 0 ? Math.min(100, (100 * value) / max) : 0
  const fill = { accent: 'bg-brand-600', success: 'bg-emerald-500', warn: 'bg-amber-500' }[tone]
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className={`h-full rounded-full ${fill} transition-[width] duration-300`} style={{ width: `${percent}%` }} />
    </div>
  )
}

/** Pill tabs above a page's content. */
export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (value: T) => void; tabs: { value: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${focusRing} ${
            value === tab.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className={`rounded-full px-1.5 text-xs tabular-nums ${value === tab.value ? 'bg-brand-50 text-brand-700' : 'bg-slate-200 text-slate-600'}`}>{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

// ---------- tables ----------

export const tableHeadClass = 'border-b border-rule bg-page text-left text-xs font-semibold whitespace-nowrap text-ink-muted'
export const thClass = 'px-4 py-2.5'
export const tdClass = 'px-4 py-3'
export const tableBodyClass = 'divide-y divide-rule'
export const tableRowClass = 'transition-colors duration-150 hover:bg-page'

/** A data table. On a phone each row becomes a small card with every value next to its column's name (`data-label`). */
export function DataTable({ dimmed, className = '', children }: { dimmed?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className={`stack-table w-full text-sm tabular-nums transition-opacity duration-150 ${dimmed ? 'opacity-60' : ''} ${className}`}>{children}</table>
    </div>
  )
}

export function SkeletonRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden>
          {Array.from({ length: columns }, (_, column) => (
            <td key={column} className="px-4 py-4">
              <div className="h-3.5 animate-pulse rounded-sm bg-slate-100 motion-reduce:animate-none" style={{ width: `${45 + ((row * 7 + column * 13) % 50)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** Grey blocks in the shape of the page to come. */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl border border-rule bg-surface motion-reduce:animate-none" />
      ))}
    </div>
  )
}

// ---------- dialogs ----------

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const modalSizes = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-6xl' }

export function Modal({ title, description, onClose, size = 'md', children }: { title: string; description?: string; onClose: () => void; size?: keyof typeof modalSizes; children: ReactNode }) {
  const { t } = useI18n()
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const node = dialog.current
    if (node && !node.contains(document.activeElement)) {
      const first = node.querySelector<HTMLElement>('[data-dialog-body] input:not([type="hidden"]):not([type="checkbox"]), [data-dialog-body] select, [data-dialog-body] textarea')
      ;(first ?? node).focus()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current()
      if (event.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 sm:items-center dark:bg-black/60 print:hidden">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${modalSizes[size]} rounded-xl border border-rule bg-surface shadow-xl outline-none motion-safe:animate-dialog`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-rule py-3 pl-5 pr-3">
          <div className="min-w-0 pt-0.5">
            <h2 id={titleId} className="text-[1.0625rem] font-semibold text-ink">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
          </div>
          <IconButton label={t('common.close')} onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <div data-dialog-body className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

export function DialogActions({ onClose, pending, submitLabel, variant = 'primary', disabled, start }: { onClose: () => void; pending: boolean; submitLabel: string; variant?: ButtonVariant; disabled?: boolean; start?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3 border-t border-rule pt-4">
      {start ? <div className="mr-auto">{start}</div> : null}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant={variant} loading={pending} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

// ---------- toasts ----------

type Toast = { id: number; text: string; kind: 'success' | 'error' }
const ToastContext = createContext<(text: string, kind?: Toast['kind']) => void>(() => {})

const TOAST_MS = { success: 4000, error: 8000 }

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const show = useCallback(
    (text: string, kind: Toast['kind'] = 'success') => {
      const id = Date.now() + Math.random()
      setToasts((current) => [...current, { id, text, kind }])
      setTimeout(() => dismiss(id), TOAST_MS[kind])
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 print:hidden">
        {toasts.map((toast) => {
          const Icon = toast.kind === 'error' ? CircleAlert : CircleCheck
          return (
            <div
              key={toast.id}
              role={toast.kind === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-lg border py-2 pl-3.5 pr-1.5 text-sm font-medium shadow-lg motion-safe:animate-toast ${
                toast.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-surface text-ink'
              }`}
            >
              <Icon className={`size-4 shrink-0 ${toast.kind === 'error' ? 'text-red-600' : 'text-emerald-600'}`} aria-hidden />
              <span className="min-w-0">{toast.text}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label={t('common.dismiss')}
                title={t('common.dismiss')}
                className="flex size-7 shrink-0 items-center justify-center rounded-sm opacity-60 hover:opacity-100"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

/** A value that only changes once it has stopped changing for a moment, so typing does not send a request per key. */
export function useDebounced<T>(value: T, delay = 300) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

export const PAGE_SIZES = [20, 50, 100]

/** The foot of a paged table: which rows are showing, rows per page, and the way to the others. */
export function Pager({ page, pageSize, total, onPage, onPageSize }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize?: (pageSize: number) => void }) {
  const { t, formatNumber } = useI18n()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  useEffect(() => {
    if (page > pages) onPage(pages)
  }, [page, pages, onPage])
  if (total === 0) return null
  const from = Math.min(total, (page - 1) * pageSize + 1)
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-rule px-4 py-2.5 text-xs tabular-nums text-ink-muted print:hidden">
      <span>{t('pager.showing', { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) })}</span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {onPageSize ? (
          <label className="flex items-center gap-2">
            {t('pager.rows')}
            <Select className="w-20" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
        <span>{t('pager.page', { page: formatNumber(page), pages: formatNumber(pages) })}</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            {t('pager.prev')}
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            {t('pager.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
