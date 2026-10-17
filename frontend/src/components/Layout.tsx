import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, LogOut, Menu, PanelLeftClose, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { findTrail, onPath, visibleGroups, type NavGroup, type NavItem } from '../lib/nav'
import { Button, DisplayToggles, Logo, Modal, focusRing } from './ui'

function useStoredFlag(key: string, initial = false) {
  const [on, setOn] = useState(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved === null ? initial : saved === '1'
    } catch {
      return initial
    }
  })
  const set = (next: boolean) => {
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      // Private mode: remember for this visit only.
    }
    setOn(next)
  }
  return [on, set] as const
}

const rowClass = (active: boolean) =>
  `group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors duration-150 ${focusRing} ${
    active ? 'bg-brand-50 font-semibold text-brand-700' : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-ink'
  }`

/** The menu: groups with their pages, a search box and "expand all". Used by the sidebar and the phone drawer. */
function NavTree({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const all = useMemo(() => visibleGroups(can), [can])

  // A search keeps only the pages whose name matches, with their menus open.
  const needle = query.trim().toLowerCase()
  const shown: NavGroup[] = needle
    ? all
        .map((g) => ({
          ...g,
          items: g.items
            .map((item) => (item.children ? { ...item, children: item.children.filter((c) => t(c.label).toLowerCase().includes(needle)) } : item))
            .filter((item) => (item.children ? item.children.length > 0 : t(item.label).toLowerCase().includes(needle))),
        }))
        .filter((g) => g.items.length > 0)
    : all

  const parents = all.flatMap((g) => g.items.filter((i) => i.children))
  const isOpen = (item: NavItem) => needle.length > 0 || (open[item.to] ?? item.children!.some((c) => onPath(location.pathname, c.to, c.end)))
  const allOpen = parents.every(isOpen)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 px-3 pb-2 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('nav.searchMenu')}
            aria-label={t('nav.searchMenu')}
            className="h-9 w-full rounded-lg border border-rule bg-page pl-8 pr-3 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen(Object.fromEntries(parents.map((p) => [p.to, !allOpen])))}
          className={`inline-flex items-center gap-1.5 rounded-md px-1 text-xs font-medium text-ink-muted hover:text-ink ${focusRing}`}
        >
          {allOpen ? <ChevronsDownUp className="size-3.5" /> : <ChevronsUpDown className="size-3.5" />}
          {t(allOpen ? 'nav.collapseAll' : 'nav.expandAll')}
        </button>
      </div>
      <nav aria-label={t('nav.menu')} className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {shown.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-subtle">{t(group.label)}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon
                if (!item.children) {
                  return (
                    <li key={item.to}>
                      <NavLink to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => rowClass(isActive)}>
                        <Icon className="size-4.5 shrink-0" aria-hidden />
                        <span className="truncate">{t(item.label)}</span>
                      </NavLink>
                    </li>
                  )
                }
                const expanded = isOpen(item)
                const hasActive = item.children.some((c) => onPath(location.pathname, c.to, c.end))
                return (
                  <li key={item.to}>
                    <button type="button" aria-expanded={expanded} onClick={() => setOpen({ ...open, [item.to]: !expanded })} className={rowClass(false)}>
                      <Icon className={`size-4.5 shrink-0 ${hasActive ? 'text-brand-600' : ''}`} aria-hidden />
                      <span className={`flex-1 truncate text-left ${hasActive ? 'text-ink' : ''}`}>{t(item.label)}</span>
                      <ChevronRight className={`size-4 shrink-0 text-ink-subtle transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden />
                    </button>
                    {expanded ? (
                      <ul className="ml-4.5 mt-0.5 space-y-0.5 border-l border-rule pl-2.5 motion-safe:animate-reveal">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                          return (
                            <li key={child.to}>
                              <NavLink to={child.to} end={child.end} onClick={onNavigate} className={({ isActive }) => rowClass(isActive || (!child.end && onPath(location.pathname, child.to)))}>
                                <ChildIcon className="size-4 shrink-0" aria-hidden />
                                <span className="truncate">{t(child.label)}</span>
                              </NavLink>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {shown.length === 0 ? <p className="px-2.5 text-xs text-ink-muted">{t('common.noMatches')}</p> : null}
      </nav>
    </div>
  )
}

function Brand() {
  const { me } = useAuth()
  const { t } = useI18n()
  return (
    <Link to="/" className={`flex min-w-0 items-center gap-2.5 rounded-md ${focusRing}`}>
      <Logo />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-ink">{me?.organization.nameTh ?? 'HSMLIS'}</span>
        <span className="block truncate text-xs text-ink-muted">{t('app.tagline')}</span>
      </span>
    </Link>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <NavTree onNavigate={onNavigate} />
      <div className="border-t border-rule px-5 py-3 text-xs font-semibold tracking-wide text-ink-subtle">HSMLIS</div>
    </>
  )
}

/** What is waiting, from the counts the lab screens use. New specimens waiting announce themselves. */
function Notifications() {
  const { can } = useAuth()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [arrived, setArrived] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const seeResults = can('results.enter') || can('results.verify') || can('results.approve')
  const kpi = useQuery({ queryKey: ['results-kpi'], queryFn: api.resultsKpi, enabled: seeResults, refetchInterval: 60_000 })
  const waiting = useQuery({
    queryKey: ['checkin-waiting'],
    queryFn: () => api.checkIn({ tab: 'Receive', page: 1, pageSize: 1 }),
    enabled: can('checkin'),
    refetchInterval: 60_000,
    select: (r) => r.total,
  })

  const last = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (waiting.data === undefined) return
    if (last.current !== undefined && waiting.data > last.current) setArrived(waiting.data - last.current)
    last.current = waiting.data
  }, [waiting.data])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  const rows = [
    ...(can('checkin') ? [{ label: t('notify.toReceive'), count: waiting.data ?? 0, to: '/check-in?tab=Receive', urgent: false }] : []),
    ...(seeResults && kpi.data
      ? [
          { label: t('notify.toEnter'), count: kpi.data.pendingEntry, to: '/lab-results?stage=Entry', urgent: false },
          { label: t('notify.toVerify'), count: kpi.data.pendingVerify, to: '/lab-results?stage=Verify', urgent: false },
          { label: t('notify.toApprove'), count: kpi.data.pendingApprove, to: '/lab-results?stage=Approve', urgent: false },
          { label: t('notify.critical'), count: kpi.data.criticalOpen, to: '/lab-results?stage=Critical', urgent: true },
        ]
      : []),
  ]
  if (rows.length === 0) return null
  const total = rows.reduce((s, r) => s + r.count, 0)
  const alarming = rows.some((r) => r.urgent && r.count > 0)

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t('notify.title')}
        title={t('notify.title')}
        className={`relative flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 hover:text-ink ${focusRing}`}
      >
        <Bell className="size-4.5" />
        {total > 0 ? (
          <span className={`absolute right-1 top-1 min-w-4 rounded-full px-1 text-[0.625rem] font-bold leading-4 text-white ${alarming ? 'bg-red-600' : 'bg-brand-600'}`}>{total > 99 ? '99+' : total}</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-rule bg-surface p-2 shadow-lg motion-safe:animate-pop">
          <p className="px-2 pb-2 pt-1 text-xs font-semibold text-ink-muted">{t('notify.title')}</p>
          {rows.map((row) => (
            <Link key={row.label} to={row.to} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-100">
              <span className="text-ink">{row.label}</span>
              <span className={`rounded-full px-2 text-xs font-semibold tabular-nums ${row.urgent && row.count > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{row.count}</span>
            </Link>
          ))}
        </div>
      ) : null}
      {arrived ? (
        <div role="status" className="fixed right-4 top-20 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-brand-200 bg-surface px-4 py-3 text-sm shadow-lg motion-safe:animate-pop print:hidden">
          <Bell className="size-4 shrink-0 text-brand-600" aria-hidden />
          <span className="text-ink">{t('notify.newSpecimens', { n: arrived })}</span>
          <Link to="/check-in?tab=Receive" onClick={() => setArrived(null)} className="shrink-0 font-semibold text-brand-700 hover:underline">
            {t('notify.view')}
          </Link>
          <button type="button" onClick={() => setArrived(null)} aria-label={t('common.dismiss')} className="text-ink-subtle hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ProfileMenu() {
  const { me, signOut } = useAuth()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])
  if (!me) return null
  const initials = `${me.user.firstNameTh[0] ?? ''}${me.user.lastNameTh[0] ?? ''}`
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }
  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} className={`flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 ${focusRing}`}>
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{initials}</span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block max-w-40 truncate text-sm font-medium text-ink">{me.user.fullName}</span>
          <span className="block text-xs text-ink-muted">{t(`role.${me.user.role}`)}</span>
        </span>
        <ChevronDown className={`size-4 text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-rule bg-surface p-1.5 shadow-lg motion-safe:animate-pop">
          <div className="border-b border-rule px-3 pb-2.5 pt-1.5">
            <div className="truncate text-sm font-semibold text-ink">{me.user.fullName}</div>
            <div className="truncate text-xs text-ink-muted">@{me.user.username}</div>
          </div>
          <div className="pt-1.5">
            <Link role="menuitem" to="/settings/general" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              <SlidersHorizontal className="size-4 text-ink-subtle" aria-hidden /> {t('nav.general')}
            </Link>
            <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-negative hover:bg-slate-100">
              <LogOut className="size-4" aria-hidden /> {t('nav.logout')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Signs out after the organization's idle time, with a minute's warning first. */
function IdleGuard() {
  const { me, signOut } = useAuth()
  const { t } = useI18n()
  const minutes = me?.organization.autoLogoutMinutes ?? 20
  // Seconds left before signing out, once the last minute has started; null before that.
  const [left, setLeft] = useState<number | null>(null)
  const lastActive = useRef(0)

  useEffect(() => {
    lastActive.current = Date.now()
    const mark = () => {
      lastActive.current = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'pointermove'] as const
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }))
    const timer = setInterval(() => {
      const remaining = lastActive.current + minutes * 60_000 - Date.now()
      if (remaining <= 0) signOut()
      else setLeft(remaining <= 60_000 ? Math.ceil(remaining / 1000) : null)
    }, 1000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark))
      clearInterval(timer)
    }
  }, [minutes, signOut])

  const stay = () => {
    lastActive.current = Date.now()
    setLeft(null)
  }
  if (left === null) return null
  return (
    <Modal title={t('idle.title')} onClose={stay}>
      <p className="text-sm text-ink">{t('idle.body', { n: left })}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={signOut}>
          {t('nav.logout')}
        </Button>
        <Button onClick={stay}>{t('idle.stay')}</Button>
      </div>
    </Modal>
  )
}

export function Layout() {
  const { t } = useI18n()
  const location = useLocation()
  const [hidden, setHidden] = useStoredFlag('hsmlis.nav.hidden')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const trail = findTrail(location.pathname)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="flex min-h-screen">
      {hidden ? null : (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-rule bg-surface lg:flex print:hidden">
          <div className="flex h-16 shrink-0 items-center border-b border-rule px-4">
            <Brand />
          </div>
          <Sidebar />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-rule bg-surface/90 px-4 backdrop-blur sm:px-6 print:hidden">
          <button type="button" onClick={() => setDrawerOpen(true)} className={`flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 lg:hidden ${focusRing}`} aria-label={t('nav.menu')}>
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            className={`hidden size-9 items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 lg:flex ${focusRing}`}
            aria-label={t(hidden ? 'nav.expand' : 'nav.collapse')}
            title={t(hidden ? 'nav.expand' : 'nav.collapse')}
          >
            {hidden ? <Menu className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
          <nav aria-label={t('nav.breadcrumb')} className="hidden min-w-0 flex-1 items-center gap-1.5 truncate text-sm sm:flex">
            {trail ? (
              <>
                <span className="text-ink-subtle">{t(trail.group.label)}</span>
                {trail.parent ? (
                  <>
                    <ChevronRight className="size-3.5 text-ink-subtle" aria-hidden />
                    <span className="text-ink-subtle">{t(trail.parent.label)}</span>
                  </>
                ) : null}
                <ChevronRight className="size-3.5 text-ink-subtle" aria-hidden />
                <span className="truncate font-medium text-ink">{t(trail.item.label)}</span>
              </>
            ) : null}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <DisplayToggles />
            <Notifications />
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 print:p-0">
          <div className="mx-auto max-w-[100rem]">
            <Outlet />
          </div>
        </main>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-slate-950/45 dark:bg-black/60" onClick={() => setDrawerOpen(false)} />
          <aside role="dialog" aria-modal="true" aria-label={t('nav.menu')} className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-rule bg-surface shadow-xl motion-safe:animate-[drawer_180ms_ease-out]">
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-rule px-4">
              <Brand />
              <button type="button" onClick={() => setDrawerOpen(false)} className={`flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-slate-100 ${focusRing}`} aria-label={t('common.close')}>
                <X className="size-5" />
              </button>
            </div>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}
      <IdleGuard />
    </div>
  )
}
