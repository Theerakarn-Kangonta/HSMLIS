import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserRoundSearch } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Card, CardHeader, ErrorNote, Field, Input, Modal, PageHeader, Select, SkeletonCards, Textarea, useToast } from '../../components/ui'
import { api, type Patient, type PatientInput, type Sex } from '../../lib/api'
import { ageFrom, fromBuddhistYear, toBuddhistYear, today } from '../../lib/dates'
import { useI18n } from '../../lib/i18n'

const PREFIXES = ['นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'พระ', 'สามเณร', 'แม่ชี', 'Mr.', 'Mrs.', 'Ms.']
const BLOOD = ['', 'A', 'B', 'AB', 'O']

const blank: PatientInput = {
  prefix: 'นาย',
  firstNameTh: '',
  lastNameTh: '',
  firstNameEn: null,
  lastNameEn: null,
  citizenId: null,
  sex: 'Male',
  birthDate: null,
  bloodGroup: null,
  nationality: 'ไทย',
  phone: null,
  email: null,
  lineId: null,
  address: null,
  province: null,
  postCode: null,
  emergencyName: null,
  emergencyPhone: null,
  emergencyRelation: null,
  allergies: null,
  conditions: null,
  medications: null,
}

export function PatientFormPage() {
  const { id } = useParams()
  const existing = useQuery({ queryKey: ['patient', id], queryFn: () => api.patient(id!), enabled: !!id })
  if (id && !existing.data) return existing.error ? <ErrorNote error={existing.error} /> : <SkeletonCards />
  return <PatientForm key={id ?? 'new'} patient={existing.data ?? null} />
}

function PatientForm({ patient }: { patient: Patient | null }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const [form, setForm] = useState<PatientInput>(() => (patient ? { ...blank, ...patient } : blank))
  const [similar, setSimilar] = useState<Patient[] | null>(null)
  const set = <K extends keyof PatientInput>(key: K, value: PatientInput[K]) => setForm({ ...form, [key]: value })
  const text = (key: keyof PatientInput) => ({
    value: (form[key] as string | null) ?? '',
    onChange: (e: { target: { value: string } }) => set(key, (e.target.value || null) as never),
  })

  const save = useMutation({
    mutationFn: () => (patient ? api.updatePatient(patient.id, form) : api.createPatient(form)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patients-recent'] })
      queryClient.setQueryData(['patient', saved.id], saved)
      toast(t(patient ? 'patients.updated' : 'patients.created', { hn: saved.hn }))
      // Registered on the way to an order: carry on with that order.
      navigate(params.get('then') === 'order' ? `/lab-orders/new?patientId=${saved.id}` : `/patients/${saved.id}`)
    },
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    // A new patient may already be on file under the same ID or name.
    if (!patient && similar === null) {
      const matches = await api.similarPatients({ citizenId: form.citizenId, firstName: form.firstNameTh, lastName: form.lastNameTh }).catch(() => [])
      if (matches.length > 0) {
        setSimilar(matches)
        return
      }
    }
    save.mutate()
  }

  // Date of birth in either calendar: the Buddhist year is what Thai ID cards show.
  const birthYear = form.birthDate ? Number(form.birthDate.slice(0, 4)) : null
  const age = ageFrom(form.birthDate)
  const setBuddhistBirth = (value: string) => {
    const [d, m, y] = value.split('/').map(Number)
    if (d && m && y > 2400) set('birthDate', `${fromBuddhistYear(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  return (
    <div>
      <PageHeader title={t(patient ? 'patients.editTitle' : 'patients.newTitle')} description={patient ? `HN ${patient.hn}` : t('patients.newSubtitle')} back={patient ? `/patients/${patient.id}` : '/patients'} />
      <form onSubmit={submit} className="space-y-5">
        <Section title={t('patients.sectionPersonal')}>
          <Field label={t('patient.prefix')}>
            <Select value={form.prefix ?? ''} onChange={(e) => set('prefix', e.target.value || null)}>
              {PREFIXES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('patient.firstNameTh')}>
            <Input {...text('firstNameTh')} required maxLength={80} />
          </Field>
          <Field label={t('patient.lastNameTh')}>
            <Input {...text('lastNameTh')} required maxLength={80} />
          </Field>
          <Field label={t('patient.citizenId')} hint={t('patient.citizenIdHint')}>
            <Input {...text('citizenId')} inputMode="numeric" pattern="\d{13}" maxLength={13} />
          </Field>
          <Field label={t('patient.firstNameEn')}>
            <Input {...text('firstNameEn')} maxLength={80} />
          </Field>
          <Field label={t('patient.lastNameEn')}>
            <Input {...text('lastNameEn')} maxLength={80} />
          </Field>
          <Field label={t('patient.sex')}>
            <Select value={form.sex} onChange={(e) => set('sex', e.target.value as Sex)} required>
              {(['Male', 'Female', 'Unknown'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`sex.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('patient.bloodGroup')}>
            <Select value={form.bloodGroup ?? ''} onChange={(e) => set('bloodGroup', e.target.value || null)}>
              {BLOOD.map((b) => (
                <option key={b} value={b}>
                  {b || '–'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('patient.birthDateBe')} hint={t('patient.birthDateBeHint')}>
            <Input
              key={form.birthDate ?? 'none'}
              defaultValue={form.birthDate ? `${form.birthDate.slice(8, 10)}/${form.birthDate.slice(5, 7)}/${toBuddhistYear(birthYear!)}` : ''}
              onBlur={(e) => setBuddhistBirth(e.target.value)}
              placeholder="วว/ดด/2530"
            />
          </Field>
          <Field label={t('patient.birthDateCe')}>
            <Input type="date" value={form.birthDate ?? ''} onChange={(e) => set('birthDate', e.target.value || null)} max={today()} />
          </Field>
          <Field label={t('patient.age')}>
            <Input value={age ?? ''} readOnly tabIndex={-1} className="bg-page" />
          </Field>
          <Field label={t('patient.nationality')}>
            <Input {...text('nationality')} maxLength={60} />
          </Field>
        </Section>

        <Section title={t('patients.sectionContact')}>
          <Field label={t('patient.phone')}>
            <Input {...text('phone')} inputMode="tel" maxLength={40} />
          </Field>
          <Field label={t('patient.email')}>
            <Input {...text('email')} type="email" maxLength={254} />
          </Field>
          <Field label="LINE ID">
            <Input {...text('lineId')} maxLength={60} />
          </Field>
          <Field label={t('patient.province')}>
            <Input {...text('province')} maxLength={80} />
          </Field>
          <Field label={t('patient.address')} className="sm:col-span-3">
            <Input {...text('address')} maxLength={400} />
          </Field>
          <Field label={t('patient.postCode')}>
            <Input {...text('postCode')} inputMode="numeric" maxLength={10} />
          </Field>
        </Section>

        <Section title={t('patients.sectionEmergency')}>
          <Field label={t('patient.emergencyName')}>
            <Input {...text('emergencyName')} maxLength={120} />
          </Field>
          <Field label={t('patient.emergencyPhone')}>
            <Input {...text('emergencyPhone')} inputMode="tel" maxLength={40} />
          </Field>
          <Field label={t('patient.emergencyRelation')}>
            <Input {...text('emergencyRelation')} maxLength={60} />
          </Field>
        </Section>

        <Section title={t('patients.sectionMedical')}>
          <Field label={t('patient.allergies')} className="sm:col-span-2">
            <Textarea {...text('allergies')} maxLength={500} rows={2} />
          </Field>
          <Field label={t('patient.conditions')} className="sm:col-span-2">
            <Textarea {...text('conditions')} maxLength={500} rows={2} />
          </Field>
          <Field label={t('patient.medications')} className="sm:col-span-4">
            <Textarea {...text('medications')} maxLength={500} rows={2} />
          </Field>
        </Section>

        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>

      {similar ? (
        <Modal title={t('patients.similarTitle')} description={t('patients.similarHint')} onClose={() => setSimilar(null)}>
          <ul className="divide-y divide-rule rounded-lg border border-rule">
            {similar.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-ink">{p.fullName}</span>
                  <span className="block text-xs text-ink-muted">
                    HN {p.hn}
                    {p.citizenId ? ` · ${p.citizenId}` : ''}
                  </span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => navigate(params.get('then') === 'order' ? `/lab-orders/new?patientId=${p.id}` : `/patients/${p.id}`)}>
                  <UserRoundSearch className="size-4" />
                  {t('common.choose')}
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2 border-t border-rule pt-4">
            <Button variant="secondary" onClick={() => setSimilar(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              {t('patients.saveAsNew')}
            </Button>
          </div>
          <ErrorNote error={save.error} />
        </Modal>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </Card>
  )
}
