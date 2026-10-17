import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardPlus, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FlagBadge } from '../../components/lab'
import { OrderTable } from '../../components/OrderTable'
import { Badge, Button, Card, CardHeader, ErrorNote, LinkButton, Modal, PageHeader, SkeletonCards, Tabs, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'

export function PatientDetailPage() {
  const { id } = useParams()
  const { t, formatDate, formatDateTime } = useI18n()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'general' | 'orders' | 'results'>('general')
  const [confirm, setConfirm] = useState(false)
  const patient = useQuery({ queryKey: ['patient', id], queryFn: () => api.patient(id!) })
  const orders = useQuery({ queryKey: ['patient-orders', id], queryFn: () => api.patientOrders(id!), enabled: tab !== 'general' })
  // The results tab shows approved results across the patient's orders, newest first.
  const resultOrders = useQuery({
    queryKey: ['patient-results', id, orders.data?.map((o) => o.id).join()],
    queryFn: () => Promise.all((orders.data ?? []).filter((o) => o.approvedCount > 0).slice(0, 10).map((o) => api.order(o.id))),
    enabled: tab === 'results' && !!orders.data && can('orders'),
  })
  const remove = useMutation({
    mutationFn: () => api.deletePatient(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast(t('patients.deleted'))
      navigate('/patients')
    },
  })

  const p = patient.data
  if (!p) return patient.error ? <ErrorNote error={patient.error} /> : <SkeletonCards />

  const rows = (pairs: [string, string | null | undefined][]) => (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 p-5 text-sm">
      {pairs.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-muted">{label}</dt>
          <dd className="text-ink">{value || '–'}</dd>
        </div>
      ))}
    </dl>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-600 text-base font-semibold text-white">{`${p.firstNameTh[0] ?? ''}${p.lastNameTh[0] ?? ''}`}</span>
            <span>
              {p.fullName}{' '}
              <Badge tone="accent">
                HN <span className="font-mono">{p.hn}</span>
              </Badge>
              <span className="block text-sm font-normal text-ink-muted">
                {[p.firstNameEn ? `${p.firstNameEn} ${p.lastNameEn ?? ''}` : null, p.ageYears !== null ? t('patient.ageYears', { n: p.ageYears }) : null, t(`sex.${p.sex}`)].filter(Boolean).join(' · ')}
              </span>
            </span>
          </span>
        }
        back="/patients"
      >
        {can('orders') ? (
          <LinkButton to={`/lab-orders/new?patientId=${p.id}`}>
            <ClipboardPlus className="size-4" />
            {t('patients.newOrder')}
          </LinkButton>
        ) : null}
        <LinkButton to={`/patients/${p.id}/edit`} variant="secondary">
          <Pencil className="size-4" />
          {t('common.edit')}
        </LinkButton>
        <Button variant="dangerOutline" onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" />
          {t('common.delete')}
        </Button>
      </PageHeader>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'general', label: t('patients.tabGeneral') },
          { value: 'orders', label: t('patients.tabOrders') },
          { value: 'results', label: t('patients.tabResults') },
        ]}
      />

      {tab === 'general' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title={t('patients.sectionPersonal')} />
            {rows([
              [t('patient.prefix'), p.prefix],
              [t('patient.citizenId'), p.citizenId],
              [t('patient.birthDate'), p.birthDate ? formatDate(p.birthDate) : null],
              [t('patient.sex'), t(`sex.${p.sex}`)],
              [t('patient.bloodGroup'), p.bloodGroup],
              [t('patient.nationality'), p.nationality],
            ])}
          </Card>
          <Card>
            <CardHeader title={t('patients.sectionContact')} />
            {rows([
              [t('patient.phone'), p.phone],
              [t('patient.email'), p.email],
              ['LINE ID', p.lineId],
              [t('patient.address'), [p.address, p.province, p.postCode].filter(Boolean).join(' ')],
              [t('patient.emergencyName'), [p.emergencyName, p.emergencyRelation, p.emergencyPhone].filter(Boolean).join(' · ')],
            ])}
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title={t('patients.sectionMedical')} />
            {rows([
              [t('patient.allergies'), p.allergies],
              [t('patient.conditions'), p.conditions],
              [t('patient.medications'), p.medications],
            ])}
          </Card>
        </div>
      ) : null}

      {tab === 'orders' ? (
        <Card>
          <ErrorNote error={orders.error} />
          {orders.data?.length === 0 ? <p className="p-5 text-sm text-ink-muted">{t('patients.noOrders')}</p> : <OrderTable orders={orders.data} loading={orders.isLoading} />}
        </Card>
      ) : null}

      {tab === 'results' ? (
        <div className="space-y-4">
          <ErrorNote error={resultOrders.error} />
          {resultOrders.data?.length === 0 ? <p className="text-sm text-ink-muted">{t('patients.noResults')}</p> : null}
          {resultOrders.data?.map((o) => (
            <Card key={o.id}>
              <CardHeader title={<span className="font-mono">{o.orderNo}</span>} description={formatDateTime(o.orderedAt)} />
              <table className="w-full text-sm">
                <tbody className="divide-y divide-rule">
                  {o.items
                    .filter((i) => i.resultStatus === 'Approved')
                    .map((i) => (
                      <tr key={i.id}>
                        <td className="px-5 py-2 font-mono text-xs text-ink-muted">{i.testCode}</td>
                        <td className="px-5 py-2">{i.testNameEn}</td>
                        <td className="px-5 py-2 font-medium">
                          {i.value} <span className="text-xs font-normal text-ink-muted">{i.unit}</span>
                        </td>
                        <td className="px-5 py-2">
                          <FlagBadge flag={i.flag} />
                        </td>
                        <td className="px-5 py-2 text-xs text-ink-muted">{i.refText}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      ) : null}

      {confirm ? (
        <Modal title={t('patients.deleteTitle')} onClose={() => setConfirm(false)}>
          <p className="text-sm text-ink">{t('patients.deleteHint')}</p>
          <ErrorNote error={remove.error} />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => remove.mutate()} loading={remove.isPending}>
              {t('common.delete')}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
