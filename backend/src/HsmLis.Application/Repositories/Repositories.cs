using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Domain.Entities;

namespace HsmLis.Application.Repositories;

// Every repository except IOrganizationRepository and the *AnyOrg methods is automatically
// scoped to the current user's organization by the data layer.
// List screens are read models: their queries project straight into the DTOs they show.

public interface IOrganizationRepository
{
    Task<Organization?> GetAsync(Guid id, CancellationToken ct = default);
    Task<bool> AnyAsync(CancellationToken ct = default);
    void Add(Organization organization);
}

public interface IUserRepository
{
    /// <summary>Looks across all organizations; only for sign-in.</summary>
    Task<User?> GetByUsernameAnyOrgAsync(string username, CancellationToken ct = default);
    /// <summary>Looks across all organizations; only for resolving the caller of a token.</summary>
    Task<User?> GetAnyOrgAsync(Guid id, CancellationToken ct = default);
    /// <summary>Usernames are unique across all organizations.</summary>
    Task<bool> UsernameExistsAnyOrgAsync(string username, CancellationToken ct = default);
    /// <summary>Counts one wrong password; on reaching <paramref name="maxAttempts"/> locks the account. Sign-in only.</summary>
    Task RecordFailedLoginAnyOrgAsync(Guid id, int maxAttempts, DateTime lockedUntil, CancellationToken ct = default);
    Task ClearFailedLoginsAnyOrgAsync(Guid id, CancellationToken ct = default);
    Task<User?> GetAsync(Guid id, CancellationToken ct = default);
    Task<List<User>> ListAsync(CancellationToken ct = default);
    void Add(User user);
}

/// <summary>Plain storage for the settings lists that are identified by a code.</summary>
public interface ICatalogRepository<T> where T : class, IOrgOwned, ICoded
{
    Task<T?> GetAsync(Guid id, CancellationToken ct = default);
    Task<List<T>> ListAsync(CancellationToken ct = default);
    Task<List<T>> GetManyAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct = default);
    Task<bool> CodeExistsAsync(string code, Guid? exceptId, CancellationToken ct = default);
    void Add(T entity);
    void Remove(T entity);
}

/// <summary>Whether a settings row is still referred to, so deleting it would break records.</summary>
public interface ICatalogUsage
{
    Task<bool> DepartmentInUseAsync(Guid id, CancellationToken ct = default);
    Task<bool> SpecimenTypeInUseAsync(Guid id, CancellationToken ct = default);
    Task<bool> LabTestInUseAsync(Guid id, CancellationToken ct = default);
    Task<bool> PackageInUseAsync(Guid id, CancellationToken ct = default);
    Task<bool> ReferrerInUseAsync(Guid id, CancellationToken ct = default);
    Task<bool> BranchInUseAsync(Guid id, CancellationToken ct = default);
}

public interface IPatientRepository
{
    Task<Patient?> GetAsync(Guid id, CancellationToken ct = default);
    Task<(List<Patient> Items, int Total)> PageAsync(string? search, PageRequest page, CancellationToken ct = default);
    /// <summary>Patients who may be the same person: the same citizen ID, or the same Thai name.</summary>
    Task<List<Patient>> FindSimilarAsync(string? citizenId, string firstName, string lastName, Guid? exceptId, CancellationToken ct = default);
    Task<bool> CitizenIdExistsAsync(string citizenId, Guid? exceptId, CancellationToken ct = default);
    Task<List<Patient>> RecentAsync(int take, CancellationToken ct = default);
    /// <summary>Whether the patient has an order that is neither completed nor cancelled.</summary>
    Task<bool> HasOpenOrdersAsync(Guid patientId, CancellationToken ct = default);
    void Add(Patient patient);
    Task<PatientPhoto?> GetPhotoAsync(Guid patientId, CancellationToken ct = default);
    void AddPhoto(PatientPhoto photo);
    void RemovePhoto(PatientPhoto photo);
}

/// <summary>An order reduced to what the dashboard's figures need.</summary>
public record OrderFact(
    Guid Id,
    DateTime OrderedAt,
    DateTime? CollectedAt,
    DateTime? ReceivedAt,
    DateTime? CompletedAt,
    OrderStatus Status,
    Guid? ReferrerId,
    string? ReferrerName,
    Guid PatientId,
    decimal Total,
    IReadOnlyList<ItemFact> Items,
    IReadOnlyList<ContainerFact> Containers);

public record ItemFact(Guid TestId, string TestCode, string TestName, Guid DepartmentId, decimal Price, ResultStatus Status, DateTime? EnteredAt, DateTime? VerifiedAt, DateTime? ApprovedAt, int TatTargetHours);

public record ContainerFact(ContainerStatus Status, DateTime? ReceivedAt, DateTime? RejectedAt);

public interface ILabOrderRepository
{
    /// <summary>With its patient, referrer, items and containers, tracked for changes.</summary>
    Task<LabOrder?> GetAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<OrderSummaryDto>> PageAsync(OrderFilter filter, DateTime? fromUtc, DateTime? toUtc, PageRequest page, CancellationToken ct = default);
    Task<PagedResult<OrderSummaryDto>> CheckInAsync(CheckInTab tab, OrderFilter filter, DateTime? fromUtc, DateTime? toUtc, PageRequest page, CancellationToken ct = default);
    /// <summary>One row per order and department with work at this stage.</summary>
    Task<PagedResult<WorklistRowDto>> WorklistAsync(WorklistStage stage, OrderFilter filter, DateTime? fromUtc, DateTime? toUtc, PageRequest page, CancellationToken ct = default);
    Task<ResultsKpiDto> ResultsKpiAsync(CancellationToken ct = default);
    Task<List<OrderSummaryDto>> ForPatientAsync(Guid patientId, CancellationToken ct = default);
    /// <summary>Orders matching a scanned or typed code: LSN, order number, HN or patient name.</summary>
    Task<(List<OrderSummaryDto> Orders, string? MatchedLsn)> SearchAsync(string text, int take, CancellationToken ct = default);
    Task<List<OrderFact>> FactsAsync(DateTime fromUtc, DateTime toUtc, Guid? referrerId, Guid? departmentId, CancellationToken ct = default);
    Task<List<ResultEvent>> HistoryAsync(Guid itemId, CancellationToken ct = default);
    /// <summary>The patient's approved results for these tests from orders placed before <paramref name="before"/>, newest first.</summary>
    Task<List<PreviousResultDto>> PreviousResultsAsync(Guid patientId, Guid exceptOrderId, IReadOnlyCollection<Guid> testIds, DateTime before, int take, CancellationToken ct = default);
    void Add(LabOrder order);
    /// <summary>A container added to an order that is already stored must be announced here too.</summary>
    void AddContainer(SpecimenContainer container);
    void AddEvent(ResultEvent resultEvent);
}

public interface IInvoiceRepository
{
    /// <summary>With its payments, patient and order, tracked for changes.</summary>
    Task<Invoice?> GetAsync(Guid id, CancellationToken ct = default);
    Task<Invoice?> GetByOrderAsync(Guid orderId, CancellationToken ct = default);
    Task<(List<Invoice> Items, int Total)> PageAsync(InvoiceFilter filter, DateTime? fromUtc, DateTime? toUtc, PageRequest page, CancellationToken ct = default);
    /// <summary>Every invoice not yet fully paid, oldest first.</summary>
    Task<List<Invoice>> OutstandingAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct = default);
    Task<(decimal Billed, decimal Paid)> TotalsAsync(CancellationToken ct = default);
    /// <summary>The sum and number of payments received in [from, to), optionally only for one referrer's or department's orders.</summary>
    Task<(decimal Amount, int Count)> PaymentsAsync(DateTime fromUtc, DateTime toUtc, Guid? referrerId = null, Guid? departmentId = null, CancellationToken ct = default);
    /// <summary>Each payment received in [from, to) as (when, how much), with the same optional filters.</summary>
    Task<List<(DateTime PaidAt, decimal Amount)>> PaymentListAsync(DateTime fromUtc, DateTime toUtc, Guid? referrerId = null, Guid? departmentId = null, CancellationToken ct = default);
    void Add(Invoice invoice);
    void AddPayment(Payment payment);
}

public interface IAuditRepository
{
    void Add(AuditLog entry);
    Task<(List<AuditLog> Items, int Total)> PageAsync(AuditFilter filter, DateTime? fromUtc, DateTime? toUtc, PageRequest page, CancellationToken ct = default);
}

public interface ISequenceRepository
{
    /// <summary>The next number for <paramref name="key"/>, starting at 1. Safe when called in parallel.</summary>
    Task<int> NextAsync(Guid organizationId, string key, CancellationToken ct = default);
}
