import { UserRound } from 'lucide-react'
import { useState } from 'react'
import { api } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { focusRing, Modal } from './ui'

const sizes = {
  sm: 'size-8 rounded-full',
  band: 'size-11 rounded-full',
  md: 'h-16 w-12 rounded-md',
  lg: 'h-32 w-24 rounded-lg',
}

/**
 * The patient's photo, so staff can check they have the right person. Click to see it large;
 * zoom={false} inside something already clickable (a button, a row link).
 */
export function PatientPhoto({ patientId, photoAt, name, size = 'sm', zoom = true }: { patientId: string; photoAt: string | null; name: string; size?: keyof typeof sizes; zoom?: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const box = `${sizes[size]} shrink-0 overflow-hidden border border-rule bg-page`
  if (!photoAt)
    return (
      <span className={`${box} grid place-items-center text-ink-muted`} title={t('patient.noPhoto')}>
        <UserRound className="size-1/2" aria-hidden />
      </span>
    )
  const src = api.patientPhotoUrl(patientId, photoAt)
  if (!zoom)
    return (
      <span className={box}>
        <img src={src} alt={t('patient.photoOf', { name })} className="size-full object-cover" loading="lazy" />
      </span>
    )
  return (
    // Clicks here (and in the dialog, which sits inside this element) must not reach a clickable row around it.
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(true)} className={`${box} cursor-zoom-in ${focusRing}`} aria-label={t('patient.photoOf', { name })}>
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      </button>
      {open ? (
        <Modal title={name} onClose={() => setOpen(false)}>
          <img src={src} alt={t('patient.photoOf', { name })} className="mx-auto max-h-[70vh] rounded-lg border border-rule" />
        </Modal>
      ) : null}
    </span>
  )
}
