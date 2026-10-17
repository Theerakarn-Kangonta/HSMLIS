namespace HsmLis.Domain.Entities;

/// <summary>Marks data that belongs to exactly one laboratory organization (tenant).</summary>
public interface IOrgOwned
{
    Guid OrganizationId { get; set; }
}

/// <summary>Settings rows that are looked up by a short code the lab chooses itself.</summary>
public interface ICoded
{
    Guid Id { get; set; }
    string Code { get; set; }
}

public enum UserRole
{
    SuperAdmin = 0,
    CompanyAdmin = 1,
    BranchAdmin = 2,
    LabManager = 3,
    LabTechnician = 4,
    Doctor = 5,
    Receptionist = 6,
    Cashier = 7,
}

public enum Sex
{
    Unknown = 0,
    Male = 1,
    Female = 2,
}

/// <summary>What kind of answer a test takes, which decides the input on the result screen.</summary>
public enum ResultType
{
    Numeric = 0,
    Text = 1,
    Choice = 2,
    MultiChoice = 3,
    /// <summary>A number, or text such as "&lt;0.5" or "Not done".</summary>
    NumericText = 4,
    /// <summary>Positive or negative (Reactive / Non reactive, Detected / Not detected).</summary>
    PosNeg = 5,
}

public enum OrderStatus
{
    AwaitingCollection = 0,
    InProgress = 1,
    Completed = 2,
    Cancelled = 3,
}

public enum ContainerStatus
{
    Pending = 0,
    Collected = 1,
    Received = 2,
    Rejected = 3,
}

public enum ResultStatus
{
    Pending = 0,
    Entered = 1,
    Verified = 2,
    Approved = 3,
    /// <summary>Will not be done: the specimen was rejected and not recollected, or the order was cancelled.</summary>
    Cancelled = 4,
}

public enum ResultFlag
{
    None = 0,
    Low = 1,
    High = 2,
    CriticalLow = 3,
    CriticalHigh = 4,
    Abnormal = 5,
    Positive = 6,
}

public enum InvoiceStatus
{
    Unpaid = 0,
    Partial = 1,
    Paid = 2,
    Cancelled = 3,
}

public enum PaymentMethod
{
    Cash = 0,
    Transfer = 1,
    PromptPay = 2,
    Card = 3,
}

public enum DiscountType
{
    Amount = 0,
    Percent = 1,
}

public enum ReferrerType
{
    Hospital = 0,
    HealthCenter = 1,
    Clinic = 2,
    Laboratory = 3,
    Other = 4,
}

/// <summary>The laboratory organization: the tenant every other record hangs off.</summary>
public class Organization
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "";
    public string NameTh { get; set; } = "";
    public string? NameEn { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? TaxId { get; set; }
    public string? Address { get; set; }
    /// <summary>IANA time zone deciding what "today" is for order numbers and reports.</summary>
    public string TimeZone { get; set; } = "Asia/Bangkok";
    /// <summary>Start of every order number, e.g. CENTER → CENTER2609210001.</summary>
    public string OrderPrefix { get; set; } = "CENTER";
    /// <summary>Signed-in screens sign out after this many idle minutes.</summary>
    public int AutoLogoutMinutes { get; set; } = 20;
    public DateTime CreatedAt { get; set; }
}

public class Branch : IOrgOwned, ICoded
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Code { get; set; } = "";
    public string NameTh { get; set; } = "";
    public string? NameEn { get; set; }
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? TaxId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class User : IOrgOwned
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    /// <summary>Stored lower-case; unique across all organizations.</summary>
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string FirstNameTh { get; set; } = "";
    public string LastNameTh { get; set; } = "";
    public string? FirstNameEn { get; set; }
    public string? LastNameEn { get; set; }
    /// <summary>Job title shown under the name, e.g. นักเทคนิคการแพทย์ชำนาญการ.</summary>
    public string? Position { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? EmployeeCode { get; set; }
    public Guid? BranchId { get; set; }
    public UserRole Role { get; set; }
    /// <summary>Departments whose work the user may see; empty means all of them.</summary>
    public List<Guid> DepartmentIds { get; set; } = [];
    public bool IsActive { get; set; } = true;
    public int FailedLoginCount { get; set; }
    public DateTime? LockedUntil { get; set; }
    public DateTime CreatedAt { get; set; }

    public string FullName => $"{FirstNameTh} {LastNameTh}".Trim();
}

public class Department : IOrgOwned, ICoded
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Code { get; set; } = "";
    public string NameEn { get; set; } = "";
    public string? NameTh { get; set; }
    /// <summary>A #rrggbb colour used for the department's dot and badges.</summary>
    public string Color { get; set; } = "#4f46e5";
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>A kind of specimen (Serum, Sputum, Blood EDTA…), collected in its own container.</summary>
public class SpecimenType : IOrgOwned, ICoded
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Code { get; set; } = "";
    public string NameEn { get; set; } = "";
    public string? NameTh { get; set; }
    /// <summary>The container it goes in, e.g. "Red top tube", printed on the label.</summary>
    public string? ContainerType { get; set; }
    public string? CollectionRequirements { get; set; }
    public string? Preservation { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>A reference interval for one sex and age band. Stored as JSON inside its test.</summary>
public class ReferenceRange
{
    /// <summary>Null: applies to both sexes.</summary>
    public Sex? Sex { get; set; }
    public int? AgeMinYears { get; set; }
    public int? AgeMaxYears { get; set; }
    public decimal? Low { get; set; }
    public decimal? High { get; set; }
    public decimal? CriticalLow { get; set; }
    public decimal? CriticalHigh { get; set; }
    /// <summary>For text results: the expected answer, e.g. "Negative". Anything else is abnormal.</summary>
    public string? NormalText { get; set; }
}

public class LabTest : IOrgOwned, ICoded
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Code { get; set; } = "";
    public Guid DepartmentId { get; set; }
    public Department? Department { get; set; }
    public string NameEn { get; set; } = "";
    public string? NameTh { get; set; }
    public Guid SpecimenTypeId { get; set; }
    public SpecimenType? SpecimenType { get; set; }
    public string? Unit { get; set; }
    public decimal Price { get; set; }
    public ResultType ResultType { get; set; }
    /// <summary>The answers offered for Choice, MultiChoice, PosNeg and NumericText results.</summary>
    public List<string> Options { get; set; } = [];
    /// <summary>Decimal places a numeric result is shown with.</summary>
    public int Decimals { get; set; } = 1;
    /// <summary>Target turnaround from order to approval, in hours.</summary>
    public int TatTargetHours { get; set; } = 24;
    /// <summary>Warn when the same patient had this test within this many days (0 = never).</summary>
    public int RepeatBlockDays { get; set; }
    /// <summary>Raise a surveillance alert when the result is positive.</summary>
    public bool AlertOnPositive { get; set; }
    public List<ReferenceRange> ReferenceRanges { get; set; } = [];
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

/// <summary>A set of tests ordered together for one price.</summary>
public class TestPackage : IOrgOwned, ICoded
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public string Code { get; set; } = "";
    public string NameTh { get; set; } = "";
    public string? NameEn { get; set; }
    public string? Description { get; set; }
    public List<Guid> TestIds { get; set; } = [];
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>A hospital or health unit that sends specimens to the lab.</summary>
public class ReferringOrganization : IOrgOwned, ICoded
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    /// <summary>The 5-digit NHSO health-facility code (hcode), or the lab's own code.</summary>
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public ReferrerType Type { get; set; }
    public string? Address { get; set; }
    public string? Contact { get; set; }
    public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
}

public class Patient : IOrgOwned
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    /// <summary>Hospital number: YYMM + running number, e.g. 26090049.</summary>
    public string Hn { get; set; } = "";
    public string? Prefix { get; set; }
    public string FirstNameTh { get; set; } = "";
    public string LastNameTh { get; set; } = "";
    public string? FirstNameEn { get; set; }
    public string? LastNameEn { get; set; }
    public string? CitizenId { get; set; }
    public Sex Sex { get; set; }
    public DateOnly? BirthDate { get; set; }
    public string? BloodGroup { get; set; }
    public string? Nationality { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? LineId { get; set; }
    public string? Address { get; set; }
    public string? Province { get; set; }
    public string? PostCode { get; set; }
    public string? EmergencyName { get; set; }
    public string? EmergencyPhone { get; set; }
    public string? EmergencyRelation { get; set; }
    public string? Allergies { get; set; }
    public string? Conditions { get; set; }
    public string? Medications { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    /// <summary>Soft delete: hidden everywhere, kept for the records that point at it.</summary>
    public DateTime? DeletedAt { get; set; }

    public string FullNameTh => $"{Prefix}{FirstNameTh} {LastNameTh}".Trim();
}

public class LabOrder : IOrgOwned
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    /// <summary>Prefix + YYMMDD + running number, e.g. CENTER2609210001.</summary>
    public string OrderNo { get; set; } = "";
    public Guid PatientId { get; set; }
    public Patient? Patient { get; set; }
    public Guid? ReferrerId { get; set; }
    public ReferringOrganization? Referrer { get; set; }
    /// <summary>The referring unit's own request number, if it gave one.</summary>
    public string? ReferrerRef { get; set; }
    public string? Entitlement { get; set; }
    public OrderStatus Status { get; set; }
    public bool Urgent { get; set; }
    public string? Diagnosis { get; set; }
    public string? Note { get; set; }
    // Vital signs taken at the visit.
    public int? BpSystolic { get; set; }
    public int? BpDiastolic { get; set; }
    public int? HeartRate { get; set; }
    public decimal? TemperatureC { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public DateTime OrderedAt { get; set; }
    public Guid? OrderedById { get; set; }
    public string OrderedByName { get; set; } = "";
    /// <summary>First specimen collected / received, and when the last result was approved.</summary>
    public DateTime? CollectedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }
    /// <summary>Bumped on every change, so two people cannot overwrite each other's work.</summary>
    public int Version { get; set; }
    /// <summary>The packages ordered, as they were priced then. Their tests are among <see cref="Items"/>.</summary>
    public List<OrderPackage> Packages { get; set; } = [];
    public List<OrderItem> Items { get; set; } = [];
    public List<SpecimenContainer> Containers { get; set; } = [];
}

/// <summary>A package on an order, with its name and price copied in. Stored as JSON inside the order.</summary>
public class OrderPackage
{
    public Guid PackageId { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
}

/// <summary>One test on an order, with its result. Test details are copied in, so later catalog edits never change history.</summary>
public class OrderItem : IOrgOwned
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid LabOrderId { get; set; }
    public Guid LabTestId { get; set; }
    public Guid? PackageId { get; set; }
    public string? PackageCode { get; set; }
    public string TestCode { get; set; } = "";
    public string TestNameEn { get; set; } = "";
    public string? TestNameTh { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid SpecimenTypeId { get; set; }
    public Guid? ContainerId { get; set; }
    public ResultType ResultType { get; set; }
    public List<string> Options { get; set; } = [];
    public int Decimals { get; set; }
    public string? Unit { get; set; }
    public decimal Price { get; set; }
    public int TatTargetHours { get; set; }
    public int SortOrder { get; set; }

    public ResultStatus ResultStatus { get; set; }
    public string? Value { get; set; }
    public ResultFlag Flag { get; set; }
    /// <summary>The reference interval the result was judged against, as it was then.</summary>
    public decimal? RefLow { get; set; }
    public decimal? RefHigh { get; set; }
    public decimal? CriticalLow { get; set; }
    public decimal? CriticalHigh { get; set; }
    public string? RefText { get; set; }
    public string? Comment { get; set; }
    public DateTime? EnteredAt { get; set; }
    public Guid? EnteredById { get; set; }
    public string? EnteredByName { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public Guid? VerifiedById { get; set; }
    public string? VerifiedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public Guid? ApprovedById { get; set; }
    public string? ApprovedByName { get; set; }
}

/// <summary>One tube or pot. Its LSN (order number + -01, -02…) is the barcode on its label.</summary>
public class SpecimenContainer : IOrgOwned
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid LabOrderId { get; set; }
    public string Lsn { get; set; } = "";
    public Guid SpecimenTypeId { get; set; }
    public string SpecimenName { get; set; } = "";
    public string? ContainerType { get; set; }
    public int LabelCount { get; set; } = 1;
    public ContainerStatus Status { get; set; }
    public DateTime? CollectedAt { get; set; }
    public string? CollectedByName { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public string? ReceivedByName { get; set; }
    public string? Volume { get; set; }
    public string? Condition { get; set; }
    public string? Comment { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectedByName { get; set; }
    public string? RejectReason { get; set; }
    /// <summary>The container this one replaces after a rejection.</summary>
    public Guid? ReplacesId { get; set; }
}

/// <summary>Immutable history of a result: every save, verification and approval writes one.</summary>
public class ResultEvent : IOrgOwned
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid OrderItemId { get; set; }
    public string Action { get; set; } = "";
    public string? Value { get; set; }
    public ResultFlag Flag { get; set; }
    public Guid? UserId { get; set; }
    public string UserName { get; set; } = "";
    public DateTime At { get; set; }
}

public class Invoice : IOrgOwned
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    /// <summary>INV + YYMMDD + running number.</summary>
    public string InvoiceNo { get; set; } = "";
    public Guid LabOrderId { get; set; }
    public LabOrder? LabOrder { get; set; }
    public Guid PatientId { get; set; }
    public Patient? Patient { get; set; }
    public DateTime IssuedAt { get; set; }
    public decimal Amount { get; set; }
    public decimal Paid { get; set; }
    public InvoiceStatus Status { get; set; }
    public int Version { get; set; }
    public List<Payment> Payments { get; set; } = [];
}

public class Payment : IOrgOwned
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid InvoiceId { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public string? Note { get; set; }
    public DateTime PaidAt { get; set; }
    public string ReceivedByName { get; set; } = "";
}

/// <summary>Append-only: the database refuses to change or delete these rows.</summary>
public class AuditLog : IOrgOwned
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public DateTime At { get; set; }
    public Guid? UserId { get; set; }
    public string UserName { get; set; } = "";
    /// <summary>What was done, e.g. "login", "order.create", "result.approve".</summary>
    public string Action { get; set; } = "";
    /// <summary>The kind of record, e.g. "auth", "order", "patient".</summary>
    public string EntityType { get; set; } = "";
    public string? EntityId { get; set; }
    public string? Detail { get; set; }
}

/// <summary>A running number per organization and key (e.g. "order:260921"), handed out atomically.</summary>
public class NumberSequence
{
    public Guid OrganizationId { get; set; }
    public string Key { get; set; } = "";
    public int Value { get; set; }
}
