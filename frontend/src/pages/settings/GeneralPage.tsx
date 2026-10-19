import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { PasswordRules, passwordOk } from '../../components/PasswordRules'
import { Button, Callout, Card, CardHeader, DisplayToggles, ErrorNote, Field, Input, PageHeader, Tabs, Textarea, useToast } from '../../components/ui'
import { api, type Me, type Organization } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'

type Tab = 'organization' | 'profile' | 'preferences' | 'security'

export function GeneralPage() {
  const { t } = useI18n()
  const { me, can } = useAuth()
  const [tab, setTab] = useState<Tab>(can('settings.admin') ? 'organization' : 'profile')
  if (!me) return null
  const tabs: { value: Tab; label: string }[] = [
    ...(can('settings.admin') ? [{ value: 'organization' as const, label: t('general.tabOrganization') }] : []),
    { value: 'profile', label: t('general.tabProfile') },
    { value: 'preferences', label: t('general.tabPreferences') },
    { value: 'security', label: t('general.tabSecurity') },
  ]
  return (
    <div className="space-y-5">
      <PageHeader title={t('general.title')} description={t('general.subtitle')} />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'organization' ? <OrganizationForm org={me.organization} /> : null}
      {tab === 'profile' ? <ProfileForm me={me} /> : null}
      {tab === 'preferences' ? (
        <Card className="max-w-2xl">
          <CardHeader title={t('general.tabPreferences')} description={t('general.preferencesHint')} />
          <div className="space-y-4 p-5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-ink">{t('general.languageTheme')}</span>
              <DisplayToggles />
            </div>
            <p className="text-ink-muted">{t('general.timeZone', { zone: me.organization.timeZone })}</p>
            <p className="text-ink-muted">{t('general.currency')}</p>
          </div>
        </Card>
      ) : null}
      {tab === 'security' ? <SecurityForm me={me} /> : null}
    </div>
  )
}

function OrganizationForm({ org }: { org: Organization }) {
  const { t } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [f, setF] = useState({ ...org })
  const set = (patch: Partial<Organization>) => setF({ ...f, ...patch })
  const save = useMutation({
    mutationFn: () => {
      const { id: _id, ...body } = f
      return api.updateOrganization(body)
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<Me | null>(['me'], (me) => (me ? { ...me, organization: saved } : me))
      toast(t('common.savedToast'))
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }
  const text = (key: 'nameEn' | 'email' | 'phone' | 'taxId' | 'address') => ({ value: f[key] ?? '', onChange: (e: { target: { value: string } }) => set({ [key]: e.target.value || null }) })
  return (
    <Card className="max-w-3xl">
      <CardHeader title={t('general.tabOrganization')} description={t('general.organizationHint')} />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label={t('org.nameTh')} className="sm:col-span-2">
          <Input value={f.nameTh} onChange={(e) => set({ nameTh: e.target.value })} required maxLength={200} />
        </Field>
        <Field label={t('org.nameEn')} className="sm:col-span-2">
          <Input {...text('nameEn')} maxLength={200} />
        </Field>
        <Field label={t('org.code')}>
          <Input value={f.code} onChange={(e) => set({ code: e.target.value })} required maxLength={20} />
        </Field>
        <Field label={t('org.taxId')}>
          <Input {...text('taxId')} maxLength={20} />
        </Field>
        <Field label={t('patient.email')}>
          <Input type="email" {...text('email')} maxLength={254} />
        </Field>
        <Field label={t('patient.phone')}>
          <Input {...text('phone')} maxLength={40} />
        </Field>
        <Field label={t('patient.address')} className="sm:col-span-2">
          <Textarea {...text('address')} maxLength={400} rows={2} />
        </Field>
        <Field label={t('org.timeZone')}>
          <Input value={f.timeZone} onChange={(e) => set({ timeZone: e.target.value })} required maxLength={64} />
        </Field>
        <Field label={t('org.autoLogout')} hint={t('org.autoLogoutHint')}>
          <Input type="number" min={5} max={240} value={f.autoLogoutMinutes} onChange={(e) => set({ autoLogoutMinutes: Number(e.target.value) })} required />
        </Field>
        <div className="sm:col-span-2">
          <ErrorNote error={save.error} />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function ProfileForm({ me }: { me: Me }) {
  const { t } = useI18n()
  const { signIn } = useAuth()
  const toast = useToast()
  const u = me.user
  const [f, setF] = useState({ firstNameTh: u.firstNameTh, lastNameTh: u.lastNameTh, firstNameEn: u.firstNameEn ?? '', lastNameEn: u.lastNameEn ?? '', email: u.email ?? '', phone: u.phone ?? '' })
  const save = useMutation({
    mutationFn: () => api.updateProfile({ ...f, firstNameEn: f.firstNameEn || null, lastNameEn: f.lastNameEn || null, email: f.email || null, phone: f.phone || null }),
    onSuccess: (updated) => {
      signIn(updated)
      toast(t('common.savedToast'))
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch })
  return (
    <Card className="max-w-3xl">
      <CardHeader title={t('general.tabProfile')} />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
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
        <Field label={t('patient.email')}>
          <Input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} maxLength={254} />
        </Field>
        <Field label={t('patient.phone')}>
          <Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={40} />
        </Field>
        <Field label={t('users.role')}>
          <Input value={t(`role.${u.role}`)} readOnly className="bg-page" />
        </Field>
        <Field label={t('login.username')}>
          <Input value={u.username} readOnly className="bg-page font-mono" />
        </Field>
        <div className="sm:col-span-2">
          <ErrorNote error={save.error} />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function SecurityForm({ me }: { me: Me }) {
  const { t } = useI18n()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const change = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      setCurrent('')
      setNext('')
      setAgain('')
      toast(t('general.passwordChanged'))
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    change.mutate()
  }
  return (
    <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('general.changePassword')} description={t('general.changePasswordHint')} />
        <form onSubmit={submit} className="space-y-4 p-5">
          <Field label={t('general.currentPassword')}>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
          </Field>
          <Field label={t('users.newPassword')}>
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" />
          </Field>
          <PasswordRules password={next} />
          <Field label={t('general.repeatPassword')}>
            <Input type="password" value={again} onChange={(e) => setAgain(e.target.value)} required autoComplete="new-password" />
          </Field>
          {again && again !== next ? <p className="text-xs text-red-700">{t('general.passwordMismatch')}</p> : null}
          <ErrorNote error={change.error} />
          <Button type="submit" loading={change.isPending} disabled={!passwordOk(next) || next !== again}>
            {t('general.changePassword')}
          </Button>
        </form>
      </Card>
      <Card>
        <CardHeader title={t('general.sessionTitle')} />
        <div className="space-y-3 p-5 text-sm">
          <Callout tone="info">{t('general.autoLogoutInfo', { n: me.organization.autoLogoutMinutes })}</Callout>
          <p className="text-ink-muted">{t('general.twoFactorSoon')}</p>
        </div>
      </Card>
    </div>
  )
}
