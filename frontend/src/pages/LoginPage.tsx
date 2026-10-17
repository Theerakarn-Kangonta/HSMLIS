import { useMutation } from '@tanstack/react-query'
import { BarChart3, Eye, EyeOff, ShieldCheck, Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, DisplayToggles, ErrorNote, Field, Input, Logo } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'

const YEAR = new Date().getFullYear()

export function LoginPage() {
  const { t } = useI18n()
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const login = useMutation({ mutationFn: () => api.login({ username, password }), onSuccess: signIn })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate()
  }

  const points = [
    { icon: Zap, text: t('login.point1') },
    { icon: ShieldCheck, text: t('login.point2') },
    { icon: BarChart3, text: t('login.point3') },
  ]

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-800 to-violet-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <Logo className="size-8 bg-transparent shadow-none" />
          </span>
          <span className="text-xl font-bold tracking-wide">HSMLIS</span>
        </div>
        <div className="max-w-md">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20">Laboratory Information Management System</span>
          <h1 className="mt-5 text-4xl font-semibold leading-tight">{t('login.headline')}</h1>
          <p className="mt-4 text-base text-indigo-100">{t('login.subhead')}</p>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-indigo-200">© {YEAR} HSMLIS · {t('login.footer')}</p>
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-violet-500/30 blur-3xl" aria-hidden />
      </div>

      <div className="relative flex items-center justify-center bg-surface p-6">
        <div className="absolute right-4 top-4">
          <DisplayToggles />
        </div>
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="flex items-center gap-3 lg:hidden">
            <Logo />
            <span className="text-lg font-bold text-ink">HSMLIS</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-ink">{t('login.welcome')}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t('login.instructions')}</p>
          </div>
          <Field label={t('login.username')}>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
          </Field>
          <Field label={t('login.password')}>
            <div className="relative">
              <Input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className="pr-10" />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-ink-muted hover:text-ink"
                aria-label={t(show ? 'login.hidePassword' : 'login.showPassword')}
                title={t(show ? 'login.hidePassword' : 'login.showPassword')}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <ErrorNote error={login.error} />
          <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
            {t('login.submit')}
          </Button>
        </form>
      </div>
    </div>
  )
}
