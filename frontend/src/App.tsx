import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import type { Permission } from './lib/api'
import { useAuth } from './lib/auth'
import { useI18n } from './lib/i18n'
import { homeFor } from './lib/nav'
import { ArSummaryPage } from './pages/billing/ArSummaryPage'
import { InvoiceDocPage } from './pages/billing/InvoiceDocPage'
import { InvoicesPage } from './pages/billing/InvoicesPage'
import { CheckInPage } from './pages/checkin/CheckInPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { LabReportPage } from './pages/orders/LabReportPage'
import { NewOrderPage } from './pages/orders/NewOrderPage'
import { OrderDetailPage } from './pages/orders/OrderDetailPage'
import { OrdersPage } from './pages/orders/OrdersPage'
import { SpecimenLabelsPage } from './pages/orders/SpecimenLabelsPage'
import { PatientDetailPage } from './pages/patients/PatientDetailPage'
import { PatientFormPage } from './pages/patients/PatientFormPage'
import { PatientsPage } from './pages/patients/PatientsPage'
import { ResultEntryPage } from './pages/results/ResultEntryPage'
import { ResultsPage } from './pages/results/ResultsPage'
import { SearchPage } from './pages/SearchPage'
import { AuditLogPage } from './pages/settings/AuditLogPage'
import { BranchesPage } from './pages/settings/BranchesPage'
import { DepartmentsPage } from './pages/settings/DepartmentsPage'
import { GeneralPage } from './pages/settings/GeneralPage'
import { LabTestsPage } from './pages/settings/LabTestsPage'
import { PackagesPage } from './pages/settings/PackagesPage'
import { ReferrersPage } from './pages/settings/ReferrersPage'
import { SpecimensPage } from './pages/settings/SpecimensPage'
import { UsersPage } from './pages/settings/UsersPage'

/** Sends signed-out visitors to the login page and signed-in ones away from it. */
function Gate({ signedIn }: { signedIn: boolean }) {
  const { me, isLoading, can } = useAuth()
  const { t } = useI18n()
  if (isLoading) return <p className="p-8 text-ink-muted">{t('common.loading')}</p>
  if (signedIn) return me ? <Outlet /> : <Navigate to="/login" replace />
  return me ? <Navigate to={homeFor(can)} replace /> : <Outlet />
}

/** A page the role may not open sends it to its own first page. The API refuses the data anyway. */
function Need({ any, children }: { any: Permission[]; children: ReactNode }) {
  const { can } = useAuth()
  return any.some(can) ? children : <Navigate to={homeFor(can)} replace />
}

const results: Permission[] = ['results.enter', 'results.verify', 'results.approve']

export default function App() {
  return (
    <Routes>
      <Route element={<Gate signedIn={false} />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<Gate signedIn />}>
        {/* Printable documents: full page, no menu. */}
        <Route path="/lab-orders/:id/specimen-labels" element={<Need any={['orders']}><SpecimenLabelsPage /></Need>} />
        <Route path="/lab-orders/:id/lab-report" element={<Need any={['orders']}><LabReportPage /></Need>} />
        <Route path="/billing/:id/invoice" element={<Need any={['billing']}><InvoiceDocPage /></Need>} />
        <Route element={<Layout />}>
          <Route index element={<Need any={['dashboard']}><DashboardPage /></Need>} />
          <Route path="search" element={<Need any={['orders']}><SearchPage /></Need>} />
          <Route path="lab-orders" element={<Need any={['orders']}><OrdersPage /></Need>} />
          <Route path="lab-orders/new" element={<Need any={['orders']}><NewOrderPage /></Need>} />
          <Route path="lab-orders/:id" element={<Need any={['orders']}><OrderDetailPage /></Need>} />
          <Route path="check-in" element={<Need any={['checkin']}><CheckInPage /></Need>} />
          <Route path="lab-results" element={<Need any={results}><ResultsPage /></Need>} />
          <Route path="lab-results/:id" element={<Need any={results}><ResultEntryPage /></Need>} />
          <Route path="patients" element={<Need any={['patients']}><PatientsPage /></Need>} />
          <Route path="patients/new" element={<Need any={['patients']}><PatientFormPage /></Need>} />
          <Route path="patients/:id" element={<Need any={['patients']}><PatientDetailPage /></Need>} />
          <Route path="patients/:id/edit" element={<Need any={['patients']}><PatientFormPage /></Need>} />
          <Route path="billing" element={<Need any={['billing']}><InvoicesPage /></Need>} />
          <Route path="billing/ar-summary" element={<Need any={['billing']}><ArSummaryPage /></Need>} />
          <Route path="settings" element={<Navigate to="/settings/general" replace />} />
          <Route path="settings/departments" element={<Need any={['settings.lab']}><DepartmentsPage /></Need>} />
          <Route path="settings/specimens" element={<Need any={['settings.lab']}><SpecimensPage /></Need>} />
          <Route path="settings/lab-tests" element={<Need any={['settings.lab']}><LabTestsPage /></Need>} />
          <Route path="settings/packages" element={<Need any={['settings.lab']}><PackagesPage /></Need>} />
          <Route path="settings/referring-organizations" element={<Need any={['settings.lab']}><ReferrersPage /></Need>} />
          <Route path="settings/users" element={<Need any={['settings.admin']}><UsersPage /></Need>} />
          <Route path="settings/branches" element={<Need any={['settings.admin']}><BranchesPage /></Need>} />
          <Route path="settings/audit-logs" element={<Need any={['settings.admin']}><AuditLogPage /></Need>} />
          <Route path="settings/general" element={<GeneralPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
