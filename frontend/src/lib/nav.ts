import {
  Building2,
  ClipboardList,
  FileClock,
  FlaskConical,
  FlaskRound,
  LayoutDashboard,
  ListChecks,
  Microscope,
  Network,
  PackageOpen,
  Receipt,
  ScanSearch,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TestTubes,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from './api'
import type { TKey } from './i18n'

export type NavItem = {
  to: string
  label: TKey
  icon: LucideIcon
  /** Active only on exactly this path, not on pages beneath it. */
  end?: boolean
  /** Shown when the role has any of these. None: shown to everyone signed in. */
  permissions?: Permission[]
  /** A menu with sub-pages, opened with the arrow beside it. */
  children?: NavItem[]
}

export type NavGroup = { label: TKey; items: NavItem[] }

const results: Permission[] = ['results.enter', 'results.verify', 'results.approve']

// The whole menu. To add a page: add it here and add its route in App.tsx.
export const groups: NavGroup[] = [
  {
    label: 'nav.groupMain',
    items: [{ to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true, permissions: ['dashboard'] }],
  },
  {
    label: 'nav.groupLab',
    items: [
      { to: '/search', label: 'nav.search', icon: ScanSearch, permissions: ['orders'] },
      {
        to: '/lab-orders',
        label: 'nav.labWork',
        icon: FlaskConical,
        children: [
          { to: '/lab-orders', label: 'nav.orders', icon: ClipboardList, permissions: ['orders'] },
          { to: '/check-in', label: 'nav.checkIn', icon: TestTubes, permissions: ['checkin'] },
          { to: '/lab-results', label: 'nav.results', icon: Microscope, permissions: results },
        ],
      },
    ],
  },
  {
    label: 'nav.groupClinic',
    items: [{ to: '/patients', label: 'nav.patients', icon: Users, permissions: ['patients'] }],
  },
  {
    label: 'nav.groupFinance',
    items: [
      {
        to: '/billing',
        label: 'nav.billing',
        icon: Wallet,
        children: [
          { to: '/billing', label: 'nav.invoices', icon: Receipt, end: true, permissions: ['billing'] },
          { to: '/billing/ar-summary', label: 'nav.arSummary', icon: FileClock, permissions: ['billing'] },
        ],
      },
    ],
  },
  {
    label: 'nav.groupSystem',
    items: [
      {
        to: '/settings',
        label: 'nav.settings',
        icon: Settings,
        children: [
          { to: '/settings/departments', label: 'nav.departments', icon: Network, permissions: ['settings.lab'] },
          { to: '/settings/specimens', label: 'nav.specimens', icon: FlaskRound, permissions: ['settings.lab'] },
          { to: '/settings/lab-tests', label: 'nav.labTests', icon: ListChecks, permissions: ['settings.lab'] },
          { to: '/settings/packages', label: 'nav.packages', icon: PackageOpen, permissions: ['settings.lab'] },
          { to: '/settings/referring-organizations', label: 'nav.referrers', icon: Building2, permissions: ['settings.lab'] },
          { to: '/settings/users', label: 'nav.users', icon: UserCog, permissions: ['settings.admin'] },
          { to: '/settings/branches', label: 'nav.branches', icon: Building2, permissions: ['settings.admin'] },
          { to: '/settings/audit-logs', label: 'nav.auditLogs', icon: ShieldCheck, permissions: ['settings.admin'] },
          { to: '/settings/general', label: 'nav.general', icon: SlidersHorizontal },
        ],
      },
    ],
  },
]

export const allowed = (item: NavItem, can: (p: Permission) => boolean) => !item.permissions || item.permissions.some(can)

/** The menu as the role sees it: pages it may open, and menus that still have one. */
export function visibleGroups(can: (p: Permission) => boolean): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => (item.children ? { ...item, children: item.children.filter((c) => allowed(c, can)) } : item))
        .filter((item) => (item.children ? item.children.length > 0 : allowed(item, can))),
    }))
    .filter((group) => group.items.length > 0)
}

export const onPath = (pathname: string, path: string, end?: boolean) =>
  pathname === path || (!end && path !== '/' && pathname.startsWith(`${path}/`))

/** The menu entry a page belongs to, with its group and parent, for the breadcrumb. */
export function findTrail(pathname: string): { group: NavGroup; parent?: NavItem; item: NavItem } | null {
  let best: { group: NavGroup; parent?: NavItem; item: NavItem; length: number } | null = null
  for (const group of groups) {
    for (const item of group.items) {
      for (const leaf of item.children ?? [item]) {
        if (onPath(pathname, leaf.to, leaf.end) && leaf.to.length > (best?.length ?? -1))
          best = { group, parent: item.children ? item : undefined, item: leaf, length: leaf.to.length }
      }
    }
  }
  return best
}

/** The first page a role may open, for sending it somewhere useful after sign-in. */
export function homeFor(can: (p: Permission) => boolean): string {
  for (const group of visibleGroups(can)) for (const item of group.items) return (item.children?.[0] ?? item).to
  return '/settings/general'
}
