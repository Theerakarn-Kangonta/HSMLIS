// Thin client for the HSMLIS API. Types mirror the backend DTOs by hand: change both sides together.

export type UserRole = 'SuperAdmin' | 'CompanyAdmin' | 'BranchAdmin' | 'LabManager' | 'LabTechnician' | 'Doctor' | 'Receptionist' | 'Cashier'
export const ROLES: UserRole[] = ['SuperAdmin', 'CompanyAdmin', 'BranchAdmin', 'LabManager', 'LabTechnician', 'Doctor', 'Receptionist', 'Cashier']

export type Permission =
  | 'dashboard'
  | 'patients'
  | 'orders'
  | 'checkin'
  | 'results.enter'
  | 'results.verify'
  | 'results.approve'
  | 'reports'
  | 'billing'
  | 'settings.lab'
  | 'settings.admin'

export type Sex = 'Unknown' | 'Male' | 'Female'
export type ResultType = 'Numeric' | 'Text' | 'Choice' | 'MultiChoice' | 'NumericText' | 'PosNeg'
export const RESULT_TYPES: ResultType[] = ['Numeric', 'NumericText', 'Text', 'Choice', 'MultiChoice', 'PosNeg']
export type OrderStatus = 'AwaitingCollection' | 'InProgress' | 'Completed' | 'Cancelled'
export type ContainerStatus = 'Pending' | 'Collected' | 'Received' | 'Rejected'
export type ResultStatus = 'Pending' | 'Entered' | 'Verified' | 'Approved' | 'Cancelled'
export type ResultFlag = 'None' | 'Low' | 'High' | 'CriticalLow' | 'CriticalHigh' | 'Abnormal' | 'Positive'
export type InvoiceStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Cancelled'
export type PaymentMethod = 'Cash' | 'Transfer' | 'PromptPay' | 'Card'
export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Transfer', 'PromptPay', 'Card']
export type DiscountType = 'Amount' | 'Percent'
export type ReferrerType = 'Hospital' | 'HealthCenter' | 'Clinic' | 'Laboratory' | 'Other'
export const REFERRER_TYPES: ReferrerType[] = ['Hospital', 'HealthCenter', 'Clinic', 'Laboratory', 'Other']
export type CheckInTab = 'Collect' | 'Receive' | 'Received' | 'Rejected'
export type WorklistStage = 'All' | 'Entry' | 'Verify' | 'Approve' | 'Critical'

export type User = {
  id: string
  username: string
  firstNameTh: string
  lastNameTh: string
  firstNameEn: string | null
  lastNameEn: string | null
  fullName: string
  position: string | null
  email: string | null
  phone: string | null
  employeeCode: string | null
  branchId: string | null
  role: UserRole
  departmentIds: string[]
  isActive: boolean
  createdAt: string
}

export type Organization = {
  id: string
  code: string
  nameTh: string
  nameEn: string | null
  email: string | null
  phone: string | null
  taxId: string | null
  address: string | null
  timeZone: string
  autoLogoutMinutes: number
}

export type Me = { user: User; organization: Organization; permissions: Permission[] }

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number }

export type Branch = { id: string; code: string; nameTh: string; nameEn: string | null; address: string | null; phone: string | null; email: string | null; taxId: string | null; isActive: boolean }
export type BranchInput = Omit<Branch, 'id'>

export type Department = { id: string; code: string; nameEn: string; nameTh: string | null; color: string; description: string | null; isActive: boolean }
export type DepartmentInput = Omit<Department, 'id'>

export type SpecimenType = {
  id: string
  code: string
  nameEn: string
  nameTh: string | null
  containerType: string | null
  collectionRequirements: string | null
  preservation: string | null
  isActive: boolean
}
export type SpecimenTypeInput = Omit<SpecimenType, 'id'>

export type ReferenceRange = {
  sex: Sex | null
  ageMinYears: number | null
  ageMaxYears: number | null
  low: number | null
  high: number | null
  criticalLow: number | null
  criticalHigh: number | null
  normalText: string | null
}

export type LabTest = {
  id: string
  code: string
  departmentId: string
  departmentName: string
  departmentColor: string
  nameEn: string
  nameTh: string | null
  specimenTypeId: string
  specimenName: string
  unit: string | null
  price: number
  resultType: ResultType
  options: string[]
  decimals: number
  tatTargetHours: number
  repeatBlockDays: number
  alertOnPositive: boolean
  referenceRanges: ReferenceRange[]
  isActive: boolean
  sortOrder: number
}
export type LabTestInput = Omit<LabTest, 'id' | 'departmentName' | 'departmentColor' | 'specimenName'>

export type Package = {
  id: string
  code: string
  nameTh: string
  nameEn: string | null
  description: string | null
  testIds: string[]
  listPrice: number
  discountType: DiscountType
  discountValue: number
  price: number
  isActive: boolean
}
export type PackageInput = Omit<Package, 'id' | 'listPrice' | 'price'>

export type Referrer = { id: string; code: string; name: string; type: ReferrerType; address: string | null; contact: string | null; phone: string | null; isActive: boolean }
export type ReferrerInput = Omit<Referrer, 'id'>

export type Patient = {
  id: string
  hn: string
  prefix: string | null
  firstNameTh: string
  lastNameTh: string
  firstNameEn: string | null
  lastNameEn: string | null
  fullName: string
  citizenId: string | null
  sex: Sex
  birthDate: string | null
  ageYears: number | null
  bloodGroup: string | null
  nationality: string | null
  phone: string | null
  email: string | null
  lineId: string | null
  address: string | null
  province: string | null
  postCode: string | null
  emergencyName: string | null
  emergencyPhone: string | null
  emergencyRelation: string | null
  allergies: string | null
  conditions: string | null
  medications: string | null
  createdAt: string
}
export type PatientInput = Omit<Patient, 'id' | 'hn' | 'fullName' | 'ageYears' | 'createdAt'>

export type OrderSummary = {
  id: string
  orderNo: string
  patientId: string
  hn: string
  patientName: string
  referrerName: string | null
  status: OrderStatus
  urgent: boolean
  itemCount: number
  enteredCount: number
  verifiedCount: number
  approvedCount: number
  containerCount: number
  collectedCount: number
  receivedCount: number
  rejectedCount: number
  hasCritical: boolean
  total: number
  orderedAt: string
  receivedAt: string | null
}

export type Container = {
  id: string
  lsn: string
  specimenTypeId: string
  specimenName: string
  containerType: string | null
  labelCount: number
  status: ContainerStatus
  collectedAt: string | null
  collectedByName: string | null
  receivedAt: string | null
  receivedByName: string | null
  volume: string | null
  condition: string | null
  comment: string | null
  rejectedAt: string | null
  rejectedByName: string | null
  rejectReason: string | null
  testCodes: string[]
}

export type OrderItem = {
  id: string
  labTestId: string
  packageId: string | null
  packageCode: string | null
  testCode: string
  testNameEn: string
  testNameTh: string | null
  departmentId: string
  departmentName: string
  departmentColor: string
  specimenTypeId: string
  containerId: string | null
  resultType: ResultType
  options: string[]
  decimals: number
  unit: string | null
  price: number
  tatTargetHours: number
  resultStatus: ResultStatus
  value: string | null
  flag: ResultFlag
  refLow: number | null
  refHigh: number | null
  criticalLow: number | null
  criticalHigh: number | null
  refText: string | null
  comment: string | null
  enteredAt: string | null
  enteredByName: string | null
  verifiedAt: string | null
  verifiedByName: string | null
  approvedAt: string | null
  approvedByName: string | null
  cancelledAt: string | null
  cancelledByName: string | null
  cancelReason: string | null
}

export type InvoiceSummary = { id: string; invoiceNo: string; amount: number; paid: number; status: InvoiceStatus }

export type OrderDetail = {
  id: string
  orderNo: string
  status: OrderStatus
  urgent: boolean
  patient: Patient
  referrer: Referrer | null
  referrerRef: string | null
  entitlement: string | null
  diagnosis: string | null
  note: string | null
  bpSystolic: number | null
  bpDiastolic: number | null
  heartRate: number | null
  temperatureC: number | null
  weightKg: number | null
  heightCm: number | null
  bmi: number | null
  subtotal: number
  discount: number
  total: number
  orderedAt: string
  orderedByName: string
  collectedAt: string | null
  receivedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  version: number
  items: OrderItem[]
  containers: Container[]
  invoice: InvoiceSummary | null
}

export type CreateOrder = {
  patientId: string
  referrerId: string | null
  referrerRef: string | null
  entitlement: string | null
  urgent: boolean
  diagnosis: string | null
  note: string | null
  bpSystolic: number | null
  bpDiastolic: number | null
  heartRate: number | null
  temperatureC: number | null
  weightKg: number | null
  heightCm: number | null
  packageIds: string[]
  testIds: string[]
  discountPercent: number
}

export type OrderFilter = {
  search?: string
  referrerId?: string
  departmentId?: string
  testId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export type ResultActionResponse = { order: OrderDetail; done: number; skipped: number; skippedReason: string | null }
export type ResultEvent = { action: string; value: string | null; flag: ResultFlag; userName: string; at: string }
/** An approved result of the same test from one of the patient's earlier orders (newest first). */
export type PreviousResult = { labTestId: string; orderId: string; orderNo: string; value: string; flag: ResultFlag; unit: string | null; refText: string | null; at: string }
/** One worklist row: the tests of one department on one order. */
export type WorklistRow = {
  orderId: string
  orderNo: string
  patientId: string
  hn: string
  patientName: string
  referrerName: string | null
  status: OrderStatus
  urgent: boolean
  orderedAt: string
  receivedAt: string | null
  departmentId: string
  departmentName: string
  departmentColor: string
  itemCount: number
  enteredCount: number
  verifiedCount: number
  approvedCount: number
  hasCritical: boolean
}
export type ResultsKpi ={ pendingEntry: number; pendingVerify: number; pendingApprove: number; criticalOpen: number }
export type SearchResult = { orders: OrderSummary[]; matchedLsn: string | null }

export type Payment = { id: string; amount: number; method: PaymentMethod; note: string | null; paidAt: string; receivedByName: string }
export type Invoice = {
  id: string
  invoiceNo: string
  labOrderId: string
  orderNo: string
  patientId: string
  hn: string
  patientName: string
  issuedAt: string
  amount: number
  paid: number
  balance: number
  status: InvoiceStatus
  version: number
  daysOutstanding: number
  payments: Payment[]
}
export type InvoiceDetail = { invoice: Invoice; lines: { code: string; name: string; price: number; packageCode: string | null }[]; subtotal: number; discount: number }
export type BillingKpi = { revenueToday: number; revenueMonth: number; unpaidCount: number; unpaidAmount: number; paidTodayCount: number }
export type ArSummary = {
  totalBilled: number
  totalPaid: number
  outstanding: number
  buckets: { label: string; minDays: number; maxDays: number | null; amount: number; count: number }[]
  items: Invoice[]
}

export type TatStep = { step: 'ordered_collected' | 'collected_received' | 'received_entered' | 'entered_verified' | 'verified_approved'; count: number; avgMinutes: number | null; medianMinutes: number | null }
/** One day of the dashboard chart: patients with orders placed, payments received (baht), specimens rejected. */
export type DailyPoint = { day: string; patients: number; revenue: number; rejected: number }

export type Dashboard = {
  from: string
  to: string
  /** revenue: payments received in the days; billed: price of the orders placed in them. */
  kpis: { revenue: number; billed: number; patients: number; completedTests: number; specimensReceived: number; avgTatHours: number | null; pending: number }
  daily: DailyPoint[]
  /** id: the referring unit (null for walk-ins). */
  workload: { name: string; count: number; id: string | null }[]
  steps: TatStep[]
  tatTotalAvgHours: number | null
  withinTargetPercent: number | null
  status: { total: number; completed: number; inProgress: number; awaiting: number; cancelled: number; rejectionRate: number }
  topTests: { name: string; count: number; id: string | null }[]
  revenueByDepartment: { name: string; amount: number; color: string | null; id: string | null }[]
}

export type AuditEntry = { id: string; at: string; userName: string; action: string; entityType: string; entityId: string | null; detail: string | null }

/** An error response from the API. `code` is stable and is what the UI translates. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(status: number, code: string | null, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

let onUnauthorized: () => void = () => {}
/** Called when a request outside sign-in comes back 401, i.e. the session ended. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

type Query = Record<string, string | number | boolean | null | undefined>

function url(path: string, query?: Query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return `${BASE}/api${path}${qs ? `?${qs}` : ''}`
}

async function send(method: string, path: string, body?: unknown, query?: Query): Promise<Response> {
  const response = await fetch(url(path, query), {
    method,
    // Sends the session cookie, also when the API is on another origin.
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      // Other sites cannot add this header, which is how the API tells our requests from forged ones.
      'X-Requested-With': 'HSMLIS',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (response.ok) return response

  let code: string | null = null
  let message = response.statusText
  try {
    const problem = await response.json()
    code = problem.code ?? null
    // Validation failures arrive as { errors: { Field: [messages] } }.
    const firstFieldError = problem.errors ? Object.values<string[]>(problem.errors)[0]?.[0] : undefined
    if (firstFieldError) code ??= 'validation'
    message = firstFieldError ?? problem.title ?? message
  } catch {
    // Body was not JSON; keep the status text.
  }
  // A 401 from /auth/ is an answer (wrong password), not a lost session.
  if (response.status === 401 && !path.startsWith('/auth/')) onUnauthorized()
  if (response.status === 429) code ??= 'rate_limited'
  if (response.status === 403) code ??= 'forbidden'
  throw new ApiError(response.status, code, message)
}

async function json<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const response = await send(method, path, body, query)
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

/** The four calls every settings list has. */
function crud<T, TInput>(path: string) {
  return {
    list: () => json<T[]>('GET', path),
    create: (body: TInput) => json<T>('POST', path, body),
    update: (id: string, body: TInput) => json<T>('PUT', `${path}/${id}`, body),
    remove: (id: string) => json<void>('DELETE', `${path}/${id}`),
  }
}

export const api = {
  login: (body: { username: string; password: string }) => json<Me>('POST', '/auth/login', body),
  logout: () => json<void>('POST', '/auth/logout'),
  me: () => json<Me>('GET', '/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => json<void>('POST', '/account/password', { currentPassword, newPassword }),
  updateProfile: (body: Pick<User, 'firstNameTh' | 'lastNameTh' | 'firstNameEn' | 'lastNameEn' | 'email' | 'phone'>) => json<Me>('PUT', '/account/profile', body),
  updateOrganization: (body: Omit<Organization, 'id'>) => json<Organization>('PUT', '/organization', body),

  users: () => json<User[]>('GET', '/users'),
  createUser: (body: Omit<User, 'id' | 'fullName' | 'isActive' | 'createdAt'> & { password: string }) => json<User>('POST', '/users', body),
  updateUser: (id: string, body: Omit<User, 'id' | 'username' | 'fullName' | 'createdAt'> & { newPassword: string | null }) => json<User>('PUT', `/users/${id}`, body),

  branches: crud<Branch, BranchInput>('/branches'),
  departments: crud<Department, DepartmentInput>('/departments'),
  specimenTypes: crud<SpecimenType, SpecimenTypeInput>('/specimen-types'),
  labTests: crud<LabTest, LabTestInput>('/lab-tests'),
  packages: crud<Package, PackageInput>('/packages'),
  referrers: crud<Referrer, ReferrerInput>('/referrers'),

  patients: (query: { search?: string; page: number; pageSize: number }) => json<Paged<Patient>>('GET', '/patients', undefined, query),
  recentPatients: () => json<Patient[]>('GET', '/patients/recent'),
  similarPatients: (query: { citizenId?: string | null; firstName: string; lastName: string; exceptId?: string }) =>
    json<Patient[]>('GET', '/patients/similar', undefined, query),
  patient: (id: string) => json<Patient>('GET', `/patients/${id}`),
  patientOrders: (id: string) => json<OrderSummary[]>('GET', `/patients/${id}/orders`),
  createPatient: (body: PatientInput) => json<Patient>('POST', '/patients', body),
  updatePatient: (id: string, body: PatientInput) => json<Patient>('PUT', `/patients/${id}`, body),
  deletePatient: (id: string) => json<void>('DELETE', `/patients/${id}`),

  orders: (query: OrderFilter & { status?: OrderStatus | ''; open?: boolean }) => json<Paged<OrderSummary>>('GET', '/orders', undefined, query),
  search: (q: string) => json<SearchResult>('GET', '/orders/search', undefined, { q }),
  order: (id: string) => json<OrderDetail>('GET', `/orders/${id}`),
  createOrder: (body: CreateOrder) => json<OrderDetail>('POST', '/orders', body),
  cancelOrder: (id: string, reason: string) => json<OrderDetail>('POST', `/orders/${id}/cancel`, { reason }),
  cancelItem: (id: string, itemId: string, reason: string) => json<OrderDetail>('POST', `/orders/${id}/items/${itemId}/cancel`, { reason }),
  addContainer: (id: string, specimenTypeId: string) => json<OrderDetail>('POST', `/orders/${id}/containers`, { specimenTypeId }),
  updateContainer: (id: string, containerId: string, body: { labelCount: number; containerType: string | null }) =>
    json<OrderDetail>('PUT', `/orders/${id}/containers/${containerId}`, body),
  removeContainer: (id: string, containerId: string) => json<OrderDetail>('DELETE', `/orders/${id}/containers/${containerId}`),

  qzCertificate: () => json<{ certificate: string }>('GET', '/qz/certificate'),
  qzSign: (data: string) => json<{ signature: string }>('POST', '/qz/sign', { data }),

  checkIn: (query: OrderFilter & { tab: CheckInTab }) => json<Paged<OrderSummary>>('GET', '/checkin', undefined, query),
  collect: (id: string, containerIds: string[] | null) => json<OrderDetail>('POST', `/checkin/${id}/collect`, { containerIds }),
  receive: (id: string, body: { containerIds: string[] | null; volume: string | null; condition: string | null; comment: string | null }) =>
    json<OrderDetail>('POST', `/checkin/${id}/receive`, body),
  bulkReceive: (orderIds: string[]) => json<{ received: number }>('POST', '/checkin/receive', { orderIds }),
  reject: (id: string, containerId: string, reason: string) => json<OrderDetail>('POST', `/checkin/${id}/reject`, { containerId, reason }),
  recollect: (id: string, containerId: string) => json<OrderDetail>('POST', `/checkin/${id}/containers/${containerId}/recollect`, {}),

  resultsKpi: () => json<ResultsKpi>('GET', '/results/kpi'),
  worklist: (query: OrderFilter & { stage: WorklistStage }) => json<Paged<WorklistRow>>('GET', '/results', undefined, query),
  saveResults: (orderId: string, version: number, results: { itemId: string; value: string | null; comment: string | null }[]) =>
    json<ResultActionResponse>('POST', `/results/${orderId}`, { version, results }),
  verifyResults: (orderId: string, version: number, itemIds: string[] | null) =>
    json<ResultActionResponse>('POST', `/results/${orderId}/verify`, { version, itemIds }),
  approveResults: (orderId: string, version: number, itemIds: string[] | null) =>
    json<ResultActionResponse>('POST', `/results/${orderId}/approve`, { version, itemIds }),
  reopenResult: (orderId: string, version: number, itemId: string, reason: string) =>
    json<ResultActionResponse>('POST', `/results/${orderId}/reopen`, { version, itemId, reason }),
  resultHistory: (orderId: string, itemId: string) => json<ResultEvent[]>('GET', `/results/${orderId}/items/${itemId}/history`),
  previousResults: (orderId: string) => json<PreviousResult[]>('GET', `/results/${orderId}/previous`),

  billingKpi: () => json<BillingKpi>('GET', '/billing/kpi'),
  invoices: (query: { search?: string; status?: InvoiceStatus | ''; referrerId?: string; from?: string; to?: string; page: number; pageSize: number }) =>
    json<Paged<Invoice>>('GET', '/billing/invoices', undefined, query),
  invoice: (id: string) => json<InvoiceDetail>('GET', `/billing/invoices/${id}`),
  pay: (id: string, body: { version: number; amount: number; method: PaymentMethod; note: string | null }) =>
    json<Invoice>('POST', `/billing/invoices/${id}/pay`, body),
  arSummary: (query: { from?: string; to?: string }) => json<ArSummary>('GET', '/billing/ar-summary', undefined, query),

  dashboard: (query: { from?: string; to?: string; referrerId?: string; departmentId?: string }) => json<Dashboard>('GET', '/dashboard', undefined, query),
  audit: (query: { search?: string; action?: string; entityType?: string; from?: string; to?: string; page: number; pageSize: number }) =>
    json<Paged<AuditEntry>>('GET', '/audit', undefined, query),
}
