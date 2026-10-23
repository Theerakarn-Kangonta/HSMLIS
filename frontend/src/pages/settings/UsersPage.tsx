import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, UserCog } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PasswordRules, passwordOk } from '../../components/PasswordRules'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  DialogActions,
  EmptyState,
  ErrorNote,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  SkeletonRows,
  Toolbar,
  tableBodyClass,
  tableHeadClass,
  tableRowClass,
  tdClass,
  thClass,
  useToast,
} from '../../components/ui'
import { api, needsLicense, ROLES, type User, type UserRole } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useBranches, useDepartments } from '../../lib/catalog'
import { useI18n } from '../../lib/i18n'

const level = (r: UserRole) => (r === 'SuperAdmin' ? 0 : r === 'CompanyAdmin' ? 1 : r === 'BranchAdmin' ? 2 : 3)

type Form = {
  username: string
  password: string
  firstNameTh: string
  lastNameTh: string
  firstNameEn: string
  lastNameEn: string
  position: string
  email: string
  phone: string
  employeeCode: string
  licenseNo: string
  branchId: string
  role: UserRole
  departmentIds: string[]
  isActive: boolean
}

export function UsersPage() {
  const { t } = useI18n()
  const { me } = useAuth()
  const branches = useBranches()
  const users = useQuery({ queryKey: ['users'], queryFn: api.users })
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const needle = search.trim().toLowerCase()
  const rows = (users.data ?? []).filter((u) => !needle || `${u.fullName} ${u.username} ${u.email ?? ''}`.toLowerCase().includes(needle))
  const branchName = (id: string | null) => branches.data?.find((b) => b.id === id)?.nameTh ?? '–'
  const myLevel = me ? level(me.user.role) : 3

  return (
    <div className="space-y-4">
      <PageHeader title={t('users.title')} description={t('users.subtitle')}>
        <Button onClick={() => setEditing('new')}>
          <Plus className="size-4" />
          {t('users.add')}
        </Button>
      </PageHeader>
      <Card>
        <Toolbar>
          <SearchInput value={search} onChange={setSearch} placeholder={t('common.search')} className="w-full max-w-sm" />
        </Toolbar>
        <ErrorNote error={users.error} />
        {users.data && rows.length === 0 ? (
          <EmptyState icon={UserCog} title={t('common.noMatches')} />
        ) : (
          <DataTable>
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>{t('users.name')}</th>
                <th className={thClass}>{t('login.username')}</th>
                <th className={thClass}>{t('patient.email')}</th>
                <th className={thClass}>{t('users.branch')}</th>
                <th className={thClass}>{t('users.role')}</th>
                <th className={thClass}>{t('common.status')}</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {users.isLoading ? <SkeletonRows columns={7} /> : null}
              {rows.map((u) => (
                <tr key={u.id} className={tableRowClass}>
                  <td className={tdClass} data-title>
                    <span className="font-medium text-ink">{u.fullName}</span>
                    {u.position ? <span className="block text-xs text-ink-muted">{u.position}</span> : null}
                  </td>
                  <td className={`${tdClass} font-mono`} data-label={t('login.username')}>
                    {u.username}
                  </td>
                  <td className={`${tdClass} text-ink-muted`} data-label={t('patient.email')}>
                    {u.email ?? '–'}
                  </td>
                  <td className={tdClass} data-label={t('users.branch')}>
                    {branchName(u.branchId)}
                  </td>
                  <td className={tdClass} data-label={t('users.role')}>
                    <Badge tone="accent">{t(`role.${u.role}`)}</Badge>
                  </td>
                  <td className={tdClass} data-label={t('common.status')}>
                    <Badge tone={u.isActive ? 'success' : 'danger'}>{t(u.isActive ? 'users.active' : 'users.suspended')}</Badge>
                  </td>
                  <td className={`${tdClass} text-right`} data-actions>
                    {level(u.role) >= myLevel ? (
                      <IconButton label={t('common.edit')} onClick={() => setEditing(u)}>
                        <Pencil className="size-4" />
                      </IconButton>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
      {editing ? <UserDialog user={editing === 'new' ? null : editing} myLevel={myLevel} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}

function UserDialog({ user, myLevel, onClose }: { user: User | null; myLevel: number; onClose: () => void }) {
  const { t } = useI18n()
  const { me } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const branches = useBranches()
  const departments = useDepartments()
  const [f, setF] = useState<Form>(() => ({
    username: user?.username ?? '',
    password: '',
    firstNameTh: user?.firstNameTh ?? '',
    lastNameTh: user?.lastNameTh ?? '',
    firstNameEn: user?.firstNameEn ?? '',
    lastNameEn: user?.lastNameEn ?? '',
    position: user?.position ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    employeeCode: user?.employeeCode ?? '',
    licenseNo: user?.licenseNo ?? '',
    branchId: user?.branchId ?? '',
    role: user?.role ?? 'LabTechnician',
    departmentIds: user?.departmentIds ?? [],
    isActive: user?.isActive ?? true,
  }))
  const set = (patch: Partial<Form>) => setF({ ...f, ...patch })
  const self = user?.id === me?.user.id
  const n = (s: string) => s.trim() || null

  const save = useMutation({
    mutationFn: () => {
      const common = {
        firstNameTh: f.firstNameTh,
        lastNameTh: f.lastNameTh,
        firstNameEn: n(f.firstNameEn),
        lastNameEn: n(f.lastNameEn),
        position: n(f.position),
        email: n(f.email),
        phone: n(f.phone),
        employeeCode: n(f.employeeCode),
        licenseNo: n(f.licenseNo),
        branchId: f.branchId || null,
        role: f.role,
        departmentIds: f.departmentIds,
      }
      return user ? api.updateUser(user.id, { ...common, isActive: f.isActive, newPassword: f.password || null }) : api.createUser({ ...common, username: f.username, password: f.password })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast(t('common.savedToast'))
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }
  const passwordNeeded = !user || f.password.length > 0

  return (
    <Modal title={user ? t('users.editTitle', { name: user.fullName }) : t('users.add')} size="lg" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('login.username')} hint={user ? undefined : t('users.usernameHint')}>
            <Input value={f.username} onChange={(e) => set({ username: e.target.value })} required disabled={!!user} pattern="[A-Za-z0-9._\-]+" minLength={3} maxLength={60} autoComplete="off" />
          </Field>
          <Field label={user ? t('users.newPassword') : t('login.password')} hint={user ? t('users.newPasswordHint') : undefined}>
            <Input type="password" value={f.password} onChange={(e) => set({ password: e.target.value })} required={!user} autoComplete="new-password" />
          </Field>
          {passwordNeeded ? (
            <div className="sm:col-span-2">
              <PasswordRules password={f.password} />
            </div>
          ) : null}
          <Field label={t('patient.firstNameTh')}>
            <Input value={f.firstNameTh} onChange={(e) => set({ firstNameTh: e.target.value })} required maxLength={80} />
          </Field>
          <Field label={t('patient.lastNameTh')}>
            <Input value={f.lastNameTh} onChange={(e) => set({ lastNameTh: e.target.value })} required maxLength={80} />
          </Field>
          <Field label={t('patient.firstNameEn')}>
            <Input value={f.firstNameEn} onChange={(e) => set({ firstNameEn: e.target.value })} maxLength={80} />
          </Field>
          <Field label={t('patient.lastNameEn')}>
            <Input value={f.lastNameEn} onChange={(e) => set({ lastNameEn: e.target.value })} maxLength={80} />
          </Field>
          <Field label={t('users.position')}>
            <Input value={f.position} onChange={(e) => set({ position: e.target.value })} maxLength={120} />
          </Field>
          <Field label={t('users.employeeCode')}>
            <Input value={f.employeeCode} onChange={(e) => set({ employeeCode: e.target.value })} maxLength={40} />
          </Field>
          <Field label={t('users.licenseNo')} hint={needsLicense(f.role) ? t('users.licenseNoHint') : undefined}>
            <Input value={f.licenseNo} onChange={(e) => set({ licenseNo: e.target.value })} required={needsLicense(f.role)} maxLength={40} autoComplete="off" />
          </Field>
          <Field label={t('patient.email')}>
            <Input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} maxLength={254} />
          </Field>
          <Field label={t('patient.phone')}>
            <Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={40} />
          </Field>
          <Field label={t('users.branch')}>
            <Select value={f.branchId} onChange={(e) => set({ branchId: e.target.value })}>
              <option value="">–</option>
              {(branches.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.nameTh}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('users.role')} hint={self ? t('users.ownRoleHint') : undefined}>
            <Select value={f.role} onChange={(e) => set({ role: e.target.value as UserRole })} disabled={self} required>
              {ROLES.filter((r) => level(r) >= myLevel).map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-700">{t('users.departments')}</p>
          <p className="mb-2 text-xs text-ink-muted">{t('users.departmentsHint')}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(departments.data ?? []).map((d) => (
              <Checkbox
                key={d.id}
                label={d.nameTh ?? d.nameEn}
                checked={f.departmentIds.includes(d.id)}
                onChange={() => set({ departmentIds: f.departmentIds.includes(d.id) ? f.departmentIds.filter((x) => x !== d.id) : [...f.departmentIds, d.id] })}
              />
            ))}
          </div>
        </div>
        {user && !self ? <Checkbox label={t('users.activeLabel')} checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> : null}
        <ErrorNote error={save.error} />
        <DialogActions onClose={onClose} pending={save.isPending} submitLabel={t('common.save')} disabled={passwordNeeded && !passwordOk(f.password)} />
      </form>
    </Modal>
  )
}
