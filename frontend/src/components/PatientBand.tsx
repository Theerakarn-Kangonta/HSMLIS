import { HeartPulse, Pill, Siren } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Patient } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { PatientPhoto } from './PatientPhoto'

/**
 * The patient's identity, drawn like a hospital wristband: who this sample belongs to, always in view.
 * The clasp turns red when the patient has a drug allergy, as allergy wristbands do on the ward.
 */
export function PatientBand({ patient, critical, urgent, sticky = true, children }: { patient: Patient; critical?: boolean; urgent?: boolean; sticky?: boolean; children?: ReactNode }) {
  const { t, formatDate } = useI18n()
  const allergy = !!patient.allergies
  return (
    <section
      aria-label={t('band.label')}
      className={`${sticky ? 'z-20 lg:sticky lg:top-16' : ''} relative flex flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden rounded-full border bg-surface py-2 pl-2 pr-5 shadow-md max-sm:rounded-2xl ${allergy ? 'border-red-300' : 'border-rule'}`}
    >
      <span className={`band-clasp absolute inset-y-0 left-0 w-9 ${allergy ? 'bg-red-500' : 'bg-brand-600'}`} aria-hidden />
      <span className="relative ml-8 rounded-full ring-2 ring-surface">
        <PatientPhoto patientId={patient.id} photoAt={patient.photoAt} name={patient.fullName} size="band" />
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2 font-semibold text-ink">
          {patient.fullName}
          <span className="font-mono text-sm font-medium text-brand-700">HN {patient.hn}</span>
        </p>
        <p className="text-xs text-ink-muted">
          {[patient.ageYears !== null ? t('patient.ageYears', { n: patient.ageYears }) : null, t(`sex.${patient.sex}`), patient.birthDate ? formatDate(patient.birthDate) : null, patient.bloodGroup ? `${t('patient.bloodGroup')} ${patient.bloodGroup}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {allergy ? <Alert tone="red" icon={<Pill className="size-3.5" />} text={`${t('patient.allergies')}: ${patient.allergies}`} /> : null}
        {patient.conditions ? <Alert tone="amber" icon={<HeartPulse className="size-3.5" />} text={patient.conditions} /> : null}
        {critical ? <Alert tone="red" icon={<Siren className="size-3.5" />} text={t('flag.critical')} pulse /> : null}
        {urgent ? <Alert tone="red" icon={<Siren className="size-3.5" />} text={t('order.urgent')} /> : null}
      </div>
      {children ? <div className="ml-auto flex flex-wrap items-center gap-3">{children}</div> : null}
    </section>
  )
}

function Alert({ tone, icon, text, pulse }: { tone: 'red' | 'amber'; icon: ReactNode; text: string; pulse?: boolean }) {
  const colors = tone === 'red' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-900'
  return (
    <span className={`inline-flex max-w-72 items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs font-semibold ${colors} ${pulse ? 'motion-safe:animate-pulse' : ''}`} title={text}>
      {icon}
      <span className="truncate">{text}</span>
    </span>
  )
}
