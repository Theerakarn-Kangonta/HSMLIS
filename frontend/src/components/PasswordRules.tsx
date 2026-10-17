import { Check, X } from 'lucide-react'
import { useI18n } from '../lib/i18n'

/** The password policy (same as the server's PasswordPolicy), checked live as the user types. */
export const passwordChecks = (pw: string) => [
  { key: 'pw.length', ok: pw.length >= 12 },
  { key: 'pw.upper', ok: /[A-Z]/.test(pw) },
  { key: 'pw.lower', ok: /[a-z]/.test(pw) },
  { key: 'pw.digit', ok: /\d/.test(pw) },
  { key: 'pw.symbol', ok: /[^A-Za-z0-9]/.test(pw) },
] as const

export const passwordOk = (pw: string) => passwordChecks(pw).every((c) => c.ok)

export function PasswordRules({ password }: { password: string }) {
  const { t } = useI18n()
  return (
    <ul className="grid gap-1 text-xs sm:grid-cols-2">
      {passwordChecks(password).map((c) => (
        <li key={c.key} className={`flex items-center gap-1.5 ${c.ok ? 'text-emerald-700' : 'text-ink-muted'}`}>
          {c.ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
          {t(c.key)}
        </li>
      ))}
    </ul>
  )
}
