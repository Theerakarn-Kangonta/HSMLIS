using System.ComponentModel.DataAnnotations;
using HsmLis.Domain.Entities;

namespace HsmLis.Application.Dtos;

// Request records carry their own limits: the API refuses anything outside them before a
// service sees it. Every list and string a caller sends is bounded.

// ---------- auth & account ----------

public record LoginRequest(
    [Required, StringLength(60)] string Username,
    [Required, StringLength(200)] string Password);

public record UserDto(
    Guid Id,
    string Username,
    string FirstNameTh,
    string LastNameTh,
    string? FirstNameEn,
    string? LastNameEn,
    string FullName,
    string? Position,
    string? Email,
    string? Phone,
    string? EmployeeCode,
    Guid? BranchId,
    UserRole Role,
    IReadOnlyList<Guid> DepartmentIds,
    bool IsActive,
    DateTime CreatedAt);

public record OrganizationDto(
    Guid Id,
    string Code,
    string NameTh,
    string? NameEn,
    string? Email,
    string? Phone,
    string? TaxId,
    string? Address,
    string TimeZone,
    string OrderPrefix,
    int AutoLogoutMinutes);

/// <summary>Who is signed in, their organization, and what they may do.</summary>
public record MeResponse(UserDto User, OrganizationDto Organization, IReadOnlyList<string> Permissions);

public record ChangePasswordRequest(
    [Required, StringLength(200)] string CurrentPassword,
    [Required, StringLength(200)] string NewPassword);

public record UpdateProfileRequest(
    [Required, StringLength(80)] string FirstNameTh,
    [Required, StringLength(80)] string LastNameTh,
    [StringLength(80)] string? FirstNameEn,
    [StringLength(80)] string? LastNameEn,
    [EmailAddress, StringLength(254)] string? Email,
    [StringLength(40)] string? Phone);

// ---------- users, branches, organization ----------

public record CreateUserRequest(
    [Required, StringLength(60, MinimumLength = 3), RegularExpression("^[A-Za-z0-9._-]+$")] string Username,
    [Required, StringLength(200)] string Password,
    [Required, StringLength(80)] string FirstNameTh,
    [Required, StringLength(80)] string LastNameTh,
    [StringLength(80)] string? FirstNameEn,
    [StringLength(80)] string? LastNameEn,
    [StringLength(120)] string? Position,
    [EmailAddress, StringLength(254)] string? Email,
    [StringLength(40)] string? Phone,
    [StringLength(40)] string? EmployeeCode,
    Guid? BranchId,
    UserRole Role,
    [MaxLength(100)] List<Guid>? DepartmentIds);

public record UpdateUserRequest(
    [StringLength(200)] string? NewPassword,
    [Required, StringLength(80)] string FirstNameTh,
    [Required, StringLength(80)] string LastNameTh,
    [StringLength(80)] string? FirstNameEn,
    [StringLength(80)] string? LastNameEn,
    [StringLength(120)] string? Position,
    [EmailAddress, StringLength(254)] string? Email,
    [StringLength(40)] string? Phone,
    [StringLength(40)] string? EmployeeCode,
    Guid? BranchId,
    UserRole Role,
    [MaxLength(100)] List<Guid>? DepartmentIds,
    bool IsActive);

public record OrganizationRequest(
    [Required, StringLength(20)] string Code,
    [Required, StringLength(200)] string NameTh,
    [StringLength(200)] string? NameEn,
    [EmailAddress, StringLength(254)] string? Email,
    [StringLength(40)] string? Phone,
    [StringLength(20)] string? TaxId,
    [StringLength(400)] string? Address,
    [Required, StringLength(64)] string TimeZone,
    [Required, StringLength(12, MinimumLength = 1), RegularExpression("^[A-Z0-9]+$")] string OrderPrefix,
    [Range(5, 240)] int AutoLogoutMinutes);

public record BranchDto(Guid Id, string Code, string NameTh, string? NameEn, string? Address, string? Phone, string? Email, string? TaxId, bool IsActive);

public record BranchRequest(
    [Required, StringLength(20)] string Code,
    [Required, StringLength(200)] string NameTh,
    [StringLength(200)] string? NameEn,
    [StringLength(400)] string? Address,
    [StringLength(40)] string? Phone,
    [EmailAddress, StringLength(254)] string? Email,
    [StringLength(20)] string? TaxId,
    bool IsActive);

// ---------- test catalog ----------

public record DepartmentDto(Guid Id, string Code, string NameEn, string? NameTh, string Color, string? Description, bool IsActive);

public record DepartmentRequest(
    [Required, StringLength(20)] string Code,
    [Required, StringLength(120)] string NameEn,
    [StringLength(120)] string? NameTh,
    [Required, RegularExpression("^#[0-9a-fA-F]{6}$")] string Color,
    [StringLength(500)] string? Description,
    bool IsActive);

public record SpecimenTypeDto(
    Guid Id, string Code, string NameEn, string? NameTh, string? ContainerType,
    string? CollectionRequirements, string? Preservation, bool IsActive);

public record SpecimenTypeRequest(
    [Required, StringLength(20)] string Code,
    [Required, StringLength(120)] string NameEn,
    [StringLength(120)] string? NameTh,
    [StringLength(80)] string? ContainerType,
    [StringLength(500)] string? CollectionRequirements,
    [StringLength(500)] string? Preservation,
    bool IsActive);

public record ReferenceRangeDto(
    Sex? Sex,
    [Range(0, 150)] int? AgeMinYears,
    [Range(0, 150)] int? AgeMaxYears,
    decimal? Low,
    decimal? High,
    decimal? CriticalLow,
    decimal? CriticalHigh,
    [StringLength(80)] string? NormalText);

public record LabTestDto(
    Guid Id,
    string Code,
    Guid DepartmentId,
    string DepartmentName,
    string DepartmentColor,
    string NameEn,
    string? NameTh,
    Guid SpecimenTypeId,
    string SpecimenName,
    string? Unit,
    decimal Price,
    ResultType ResultType,
    IReadOnlyList<string> Options,
    int Decimals,
    int TatTargetHours,
    int RepeatBlockDays,
    bool AlertOnPositive,
    IReadOnlyList<ReferenceRangeDto> ReferenceRanges,
    bool IsActive,
    int SortOrder);

public record LabTestRequest(
    [Required, StringLength(30)] string Code,
    Guid DepartmentId,
    [Required, StringLength(200)] string NameEn,
    [StringLength(200)] string? NameTh,
    Guid SpecimenTypeId,
    [StringLength(30)] string? Unit,
    [Range(0, 1_000_000)] decimal Price,
    ResultType ResultType,
    [MaxLength(50)] List<string>? Options,
    [Range(0, 6)] int Decimals,
    [Range(1, 24 * 90)] int TatTargetHours,
    [Range(0, 3650)] int RepeatBlockDays,
    bool AlertOnPositive,
    [MaxLength(20)] List<ReferenceRangeDto>? ReferenceRanges,
    bool IsActive,
    [Range(0, 100_000)] int SortOrder);

public record PackageDto(
    Guid Id,
    string Code,
    string NameTh,
    string? NameEn,
    string? Description,
    IReadOnlyList<Guid> TestIds,
    decimal ListPrice,
    DiscountType DiscountType,
    decimal DiscountValue,
    decimal Price,
    bool IsActive);

public record PackageRequest(
    [Required, StringLength(30)] string Code,
    [Required, StringLength(200)] string NameTh,
    [StringLength(200)] string? NameEn,
    [StringLength(500)] string? Description,
    [Required, MinLength(1), MaxLength(100)] List<Guid> TestIds,
    DiscountType DiscountType,
    [Range(0, 1_000_000)] decimal DiscountValue,
    bool IsActive);

public record ReferrerDto(Guid Id, string Code, string Name, ReferrerType Type, string? Address, string? Contact, string? Phone, bool IsActive);

public record ReferrerRequest(
    [Required, StringLength(20)] string Code,
    [Required, StringLength(200)] string Name,
    ReferrerType Type,
    [StringLength(400)] string? Address,
    [StringLength(120)] string? Contact,
    [StringLength(40)] string? Phone,
    bool IsActive);

// ---------- patients ----------

public record PatientDto(
    Guid Id,
    string Hn,
    string? Prefix,
    string FirstNameTh,
    string LastNameTh,
    string? FirstNameEn,
    string? LastNameEn,
    string FullName,
    string? CitizenId,
    Sex Sex,
    DateOnly? BirthDate,
    int? AgeYears,
    string? BloodGroup,
    string? Nationality,
    string? Phone,
    string? Email,
    string? LineId,
    string? Address,
    string? Province,
    string? PostCode,
    string? EmergencyName,
    string? EmergencyPhone,
    string? EmergencyRelation,
    string? Allergies,
    string? Conditions,
    string? Medications,
    DateTime CreatedAt);

public record PatientRequest(
    [StringLength(30)] string? Prefix,
    [Required, StringLength(80)] string FirstNameTh,
    [Required, StringLength(80)] string LastNameTh,
    [StringLength(80)] string? FirstNameEn,
    [StringLength(80)] string? LastNameEn,
    [StringLength(13, MinimumLength = 13), RegularExpression("^[0-9]{13}$")] string? CitizenId,
    Sex Sex,
    DateOnly? BirthDate,
    [StringLength(5)] string? BloodGroup,
    [StringLength(60)] string? Nationality,
    [StringLength(40)] string? Phone,
    [EmailAddress, StringLength(254)] string? Email,
    [StringLength(60)] string? LineId,
    [StringLength(400)] string? Address,
    [StringLength(80)] string? Province,
    [StringLength(10)] string? PostCode,
    [StringLength(120)] string? EmergencyName,
    [StringLength(40)] string? EmergencyPhone,
    [StringLength(60)] string? EmergencyRelation,
    [StringLength(500)] string? Allergies,
    [StringLength(500)] string? Conditions,
    [StringLength(500)] string? Medications);

// ---------- orders, specimens, results ----------

public record CreateOrderRequest(
    Guid PatientId,
    Guid? ReferrerId,
    [StringLength(60)] string? ReferrerRef,
    [StringLength(80)] string? Entitlement,
    bool Urgent,
    [StringLength(500)] string? Diagnosis,
    [StringLength(500)] string? Note,
    [Range(40, 300)] int? BpSystolic,
    [Range(20, 200)] int? BpDiastolic,
    [Range(20, 250)] int? HeartRate,
    [Range(30, 45)] decimal? TemperatureC,
    [Range(0.5, 400)] decimal? WeightKg,
    [Range(30, 250)] decimal? HeightCm,
    [MaxLength(30)] List<Guid>? PackageIds,
    [MaxLength(200)] List<Guid>? TestIds,
    [Range(0, 1_000_000)] decimal Discount);

public record OrderSummaryDto(
    Guid Id,
    string OrderNo,
    Guid PatientId,
    string Hn,
    string PatientName,
    string? ReferrerName,
    OrderStatus Status,
    bool Urgent,
    int ItemCount,
    int EnteredCount,
    int VerifiedCount,
    int ApprovedCount,
    int ContainerCount,
    int CollectedCount,
    int ReceivedCount,
    int RejectedCount,
    bool HasCritical,
    decimal Total,
    DateTime OrderedAt,
    DateTime? ReceivedAt);

public record ContainerDto(
    Guid Id,
    string Lsn,
    Guid SpecimenTypeId,
    string SpecimenName,
    string? ContainerType,
    int LabelCount,
    ContainerStatus Status,
    DateTime? CollectedAt,
    string? CollectedByName,
    DateTime? ReceivedAt,
    string? ReceivedByName,
    string? Volume,
    string? Condition,
    string? Comment,
    DateTime? RejectedAt,
    string? RejectedByName,
    string? RejectReason,
    IReadOnlyList<string> TestCodes);

public record OrderItemDto(
    Guid Id,
    Guid LabTestId,
    Guid? PackageId,
    string? PackageCode,
    string TestCode,
    string TestNameEn,
    string? TestNameTh,
    Guid DepartmentId,
    string DepartmentName,
    string DepartmentColor,
    Guid SpecimenTypeId,
    Guid? ContainerId,
    ResultType ResultType,
    IReadOnlyList<string> Options,
    int Decimals,
    string? Unit,
    decimal Price,
    int TatTargetHours,
    ResultStatus ResultStatus,
    string? Value,
    ResultFlag Flag,
    decimal? RefLow,
    decimal? RefHigh,
    decimal? CriticalLow,
    decimal? CriticalHigh,
    string? RefText,
    string? Comment,
    DateTime? EnteredAt,
    string? EnteredByName,
    DateTime? VerifiedAt,
    string? VerifiedByName,
    DateTime? ApprovedAt,
    string? ApprovedByName);

public record InvoiceSummaryDto(Guid Id, string InvoiceNo, decimal Amount, decimal Paid, InvoiceStatus Status);

public record OrderDetailDto(
    Guid Id,
    string OrderNo,
    OrderStatus Status,
    bool Urgent,
    PatientDto Patient,
    ReferrerDto? Referrer,
    string? ReferrerRef,
    string? Entitlement,
    string? Diagnosis,
    string? Note,
    int? BpSystolic,
    int? BpDiastolic,
    int? HeartRate,
    decimal? TemperatureC,
    decimal? WeightKg,
    decimal? HeightCm,
    decimal? Bmi,
    decimal Subtotal,
    decimal Discount,
    decimal Total,
    DateTime OrderedAt,
    string OrderedByName,
    DateTime? CollectedAt,
    DateTime? ReceivedAt,
    DateTime? CompletedAt,
    DateTime? CancelledAt,
    string? CancelReason,
    int Version,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<ContainerDto> Containers,
    InvoiceSummaryDto? Invoice);

public record OrderFilter(
    string? Search = null,
    OrderStatus? Status = null,
    Guid? ReferrerId = null,
    Guid? DepartmentId = null,
    Guid? TestId = null,
    DateOnly? From = null,
    DateOnly? To = null,
    bool OpenOnly = false);

/// <summary>Which tab of the check-in screen: by the state of the order's specimens.</summary>
public enum CheckInTab
{
    Collect = 0,
    Receive = 1,
    Received = 2,
    Rejected = 3,
}

/// <summary>Which results a worklist shows.</summary>
public enum WorklistStage
{
    All = 0,
    Entry = 1,
    Verify = 2,
    Approve = 3,
    Critical = 4,
}

public record CancelOrderRequest([Required, StringLength(300)] string Reason);

public record ContainerIdsRequest([MaxLength(50)] List<Guid>? ContainerIds);

public record ReceiveRequest(
    [MaxLength(50)] List<Guid>? ContainerIds,
    [StringLength(40)] string? Volume,
    [StringLength(80)] string? Condition,
    [StringLength(300)] string? Comment);

public record BulkReceiveRequest([Required, MinLength(1), MaxLength(200)] List<Guid> OrderIds);

public record RejectRequest(Guid ContainerId, [Required, StringLength(200)] string Reason);

public record AddContainerRequest(Guid SpecimenTypeId);

public record UpdateContainerRequest([Range(0, 20)] int LabelCount, [StringLength(80)] string? ContainerType);

public record ResultInput(Guid ItemId, [StringLength(200)] string? Value, [StringLength(500)] string? Comment);

public record SaveResultsRequest(int Version, [Required, MaxLength(300)] List<ResultInput> Results);

public record ResultActionRequest(int Version, [MaxLength(300)] List<Guid>? ItemIds);

/// <summary>Takes an approved or verified result back to "entered" so it can be corrected.</summary>
public record ReopenRequest(int Version, Guid ItemId, [Required, StringLength(300)] string Reason);

/// <summary>What happened to each requested result, so the screen can say "approved 4, 2 must wait".</summary>
public record ResultActionResponse(OrderDetailDto Order, int Done, int Skipped, string? SkippedReason);

public record ResultEventDto(string Action, string? Value, ResultFlag Flag, string UserName, DateTime At);

public record ResultsKpiDto(int PendingEntry, int PendingVerify, int PendingApprove, int CriticalOpen);

/// <summary>A specimen search: the orders found and, for a scanned label, which container it was.</summary>
public record SearchResultDto(IReadOnlyList<OrderSummaryDto> Orders, string? MatchedLsn);

// ---------- billing ----------

public record PaymentDto(Guid Id, decimal Amount, PaymentMethod Method, string? Note, DateTime PaidAt, string ReceivedByName);

public record InvoiceDto(
    Guid Id,
    string InvoiceNo,
    Guid LabOrderId,
    string OrderNo,
    Guid PatientId,
    string Hn,
    string PatientName,
    DateTime IssuedAt,
    decimal Amount,
    decimal Paid,
    decimal Balance,
    InvoiceStatus Status,
    int Version,
    int DaysOutstanding,
    IReadOnlyList<PaymentDto> Payments);

public record InvoiceLineDto(string Code, string Name, decimal Price, string? PackageCode);

public record InvoiceDetailDto(InvoiceDto Invoice, IReadOnlyList<InvoiceLineDto> Lines, decimal Subtotal, decimal Discount);

public record InvoiceFilter(string? Search = null, InvoiceStatus? Status = null, Guid? ReferrerId = null, DateOnly? From = null, DateOnly? To = null);

public record PayRequest(
    int Version,
    [Range(0.01, 10_000_000)] decimal Amount,
    PaymentMethod Method,
    [StringLength(300)] string? Note);

public record BillingKpiDto(decimal RevenueToday, decimal RevenueMonth, int UnpaidCount, decimal UnpaidAmount, int PaidTodayCount);

public record AgingBucketDto(string Label, int MinDays, int? MaxDays, decimal Amount, int Count);

public record ArSummaryDto(decimal TotalBilled, decimal TotalPaid, decimal Outstanding, IReadOnlyList<AgingBucketDto> Buckets, IReadOnlyList<InvoiceDto> Items);

// ---------- dashboard ----------

/// <summary><c>Revenue</c> is money received (payments) in the days; <c>Billed</c> is the price of the orders placed in them.</summary>
public record DashboardKpiDto(decimal Revenue, decimal Billed, int Patients, int CompletedTests, int SpecimensReceived, decimal? AvgTatHours, int Pending);

/// <summary>One day of the dashboard's chart: patients with orders placed that day, payments received that day, specimens rejected that day.</summary>
public record DailyCountDto(DateOnly Day, int Patients, decimal Revenue, int Rejected);

/// <summary>A labelled figure; <c>Id</c> is the referrer, test or department it counts, for linking to the list behind it.</summary>
public record NamedCountDto(string Name, int Count, string? Color = null, Guid? Id = null);

public record NamedAmountDto(string Name, decimal Amount, string? Color = null, Guid? Id = null);

/// <summary>One step of the order pipeline: how many orders reached it and how long it took to get there.</summary>
public record TatStepDto(string Step, int Count, decimal? AvgMinutes, decimal? MedianMinutes);

public record StatusCountsDto(int Total, int Completed, int InProgress, int Awaiting, int Cancelled, decimal RejectionRate);

public record DashboardDto(
    DateOnly From,
    DateOnly To,
    DashboardKpiDto Kpis,
    IReadOnlyList<DailyCountDto> Daily,
    IReadOnlyList<NamedCountDto> Workload,
    IReadOnlyList<TatStepDto> Steps,
    decimal? TatTotalAvgHours,
    decimal? WithinTargetPercent,
    StatusCountsDto Status,
    IReadOnlyList<NamedCountDto> TopTests,
    IReadOnlyList<NamedAmountDto> RevenueByDepartment);

// ---------- audit ----------

public record AuditLogDto(Guid Id, DateTime At, string UserName, string Action, string EntityType, string? EntityId, string? Detail);

public record AuditFilter(string? Search = null, string? Action = null, string? EntityType = null, DateOnly? From = null, DateOnly? To = null);
