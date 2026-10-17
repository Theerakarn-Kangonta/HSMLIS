using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Application.Repositories;
using HsmLis.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace HsmLis.Infrastructure.Persistence;

public class UnitOfWork(AppDbContext db) : IUnitOfWork
{
    public Task SaveChangesAsync(CancellationToken ct = default) => db.SaveChangesAsync(ct);

    public async Task<T> InTransactionAsync<T>(Func<Task<T>> work, CancellationToken ct = default)
    {
        if (db.Database.CurrentTransaction is not null) return await work();

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var result = await work();
        await transaction.CommitAsync(ct);
        return result;
    }
}

public class OrganizationRepository(AppDbContext db) : IOrganizationRepository
{
    public Task<Organization?> GetAsync(Guid id, CancellationToken ct = default) =>
        db.Organizations.FirstOrDefaultAsync(o => o.Id == id, ct);

    public Task<bool> AnyAsync(CancellationToken ct = default) => db.Organizations.AnyAsync(ct);

    public void Add(Organization organization) => db.Organizations.Add(organization);
}

public class UserRepository(AppDbContext db) : IUserRepository
{
    public Task<User?> GetByUsernameAnyOrgAsync(string username, CancellationToken ct = default) =>
        db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Username == username, ct);

    public Task<User?> GetAnyOrgAsync(Guid id, CancellationToken ct = default) =>
        db.Users.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<bool> UsernameExistsAnyOrgAsync(string username, CancellationToken ct = default) =>
        db.Users.IgnoreQueryFilters().AnyAsync(u => u.Username == username, ct);

    public Task RecordFailedLoginAnyOrgAsync(Guid id, int maxAttempts, DateTime lockedUntil, CancellationToken ct = default)
    {
        DateTime? until = lockedUntil;
        // One UPDATE, so parallel guesses are all counted instead of overwriting each other.
        return db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.LockedUntil, u => u.FailedLoginCount + 1 >= maxAttempts ? until : u.LockedUntil)
                .SetProperty(u => u.FailedLoginCount, u => u.FailedLoginCount + 1 >= maxAttempts ? 0 : u.FailedLoginCount + 1), ct);
    }

    public Task ClearFailedLoginsAnyOrgAsync(Guid id, CancellationToken ct = default) =>
        db.Users.IgnoreQueryFilters()
            .Where(u => u.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.FailedLoginCount, 0)
                .SetProperty(u => u.LockedUntil, (DateTime?)null), ct);

    public Task<User?> GetAsync(Guid id, CancellationToken ct = default) => db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<List<User>> ListAsync(CancellationToken ct = default) =>
        db.Users.AsNoTracking().OrderBy(u => u.FirstNameTh).ThenBy(u => u.LastNameTh).ToListAsync(ct);

    public void Add(User user) => db.Users.Add(user);
}

public class CatalogRepository<T>(AppDbContext db) : ICatalogRepository<T> where T : class, IOrgOwned, ICoded
{
    public Task<T?> GetAsync(Guid id, CancellationToken ct = default) => db.Set<T>().FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task<List<T>> ListAsync(CancellationToken ct = default) => db.Set<T>().ToListAsync(ct);

    public Task<List<T>> GetManyAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct = default) =>
        ids.Count == 0 ? Task.FromResult(new List<T>()) : db.Set<T>().Where(x => ids.Contains(x.Id)).ToListAsync(ct);

    public Task<bool> CodeExistsAsync(string code, Guid? exceptId, CancellationToken ct = default) =>
        db.Set<T>().AnyAsync(x => x.Code == code && x.Id != exceptId, ct);

    public void Add(T entity) => db.Set<T>().Add(entity);

    public void Remove(T entity) => db.Set<T>().Remove(entity);
}

public class CatalogUsage(AppDbContext db) : ICatalogUsage
{
    public async Task<bool> DepartmentInUseAsync(Guid id, CancellationToken ct = default) =>
        await db.LabTests.AnyAsync(t => t.DepartmentId == id, ct)
        || await db.OrderItems.AnyAsync(i => i.DepartmentId == id, ct)
        || await db.Users.AnyAsync(u => u.DepartmentIds.Contains(id), ct);

    public async Task<bool> SpecimenTypeInUseAsync(Guid id, CancellationToken ct = default) =>
        await db.LabTests.AnyAsync(t => t.SpecimenTypeId == id, ct)
        || await db.Containers.AnyAsync(c => c.SpecimenTypeId == id, ct);

    public async Task<bool> LabTestInUseAsync(Guid id, CancellationToken ct = default) =>
        await db.OrderItems.AnyAsync(i => i.LabTestId == id, ct)
        || await db.TestPackages.AnyAsync(p => p.TestIds.Contains(id), ct);

    public Task<bool> PackageInUseAsync(Guid id, CancellationToken ct = default) =>
        db.OrderItems.AnyAsync(i => i.PackageId == id, ct);

    public Task<bool> ReferrerInUseAsync(Guid id, CancellationToken ct = default) =>
        db.LabOrders.AnyAsync(o => o.ReferrerId == id, ct);

    public Task<bool> BranchInUseAsync(Guid id, CancellationToken ct = default) =>
        db.Users.AnyAsync(u => u.BranchId == id, ct);
}

public class PatientRepository(AppDbContext db) : IPatientRepository
{
    private IQueryable<Patient> Live => db.Patients.Where(p => p.DeletedAt == null);

    public Task<Patient?> GetAsync(Guid id, CancellationToken ct = default) => Live.FirstOrDefaultAsync(p => p.Id == id, ct);

    public async Task<(List<Patient> Items, int Total)> PageAsync(string? search, PageRequest page, CancellationToken ct = default)
    {
        var query = Live.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = Like.Contains(search);
            query = query.Where(p =>
                EF.Functions.ILike(p.Hn, pattern, Like.Escape)
                || EF.Functions.ILike(p.FirstNameTh, pattern, Like.Escape)
                || EF.Functions.ILike(p.LastNameTh, pattern, Like.Escape)
                || EF.Functions.ILike(p.FirstNameTh + " " + p.LastNameTh, pattern, Like.Escape)
                || (p.FirstNameEn != null && EF.Functions.ILike(p.FirstNameEn + " " + p.LastNameEn, pattern, Like.Escape))
                || (p.CitizenId != null && EF.Functions.ILike(p.CitizenId, pattern, Like.Escape))
                || (p.Phone != null && EF.Functions.ILike(p.Phone, pattern, Like.Escape)));
        }
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id).Skip(page.Skip).Take(page.PageSize).ToListAsync(ct);
        return (items, total);
    }

    public Task<List<Patient>> FindSimilarAsync(string? citizenId, string firstName, string lastName, Guid? exceptId, CancellationToken ct = default) =>
        Live.AsNoTracking()
            .Where(p => p.Id != exceptId
                && ((citizenId != null && p.CitizenId == citizenId)
                    || (p.FirstNameTh.ToLower() == firstName.ToLower() && p.LastNameTh.ToLower() == lastName.ToLower())))
            .OrderBy(p => p.Hn)
            .Take(10)
            .ToListAsync(ct);

    public Task<bool> CitizenIdExistsAsync(string citizenId, Guid? exceptId, CancellationToken ct = default) =>
        Live.AnyAsync(p => p.CitizenId == citizenId && p.Id != exceptId, ct);

    public Task<List<Patient>> RecentAsync(int take, CancellationToken ct = default) =>
        Live.AsNoTracking().OrderByDescending(p => p.UpdatedAt).Take(take).ToListAsync(ct);

    public Task<bool> HasOpenOrdersAsync(Guid patientId, CancellationToken ct = default) =>
        db.LabOrders.AnyAsync(o => o.PatientId == patientId && (o.Status == OrderStatus.AwaitingCollection || o.Status == OrderStatus.InProgress), ct);

    public void Add(Patient patient) => db.Patients.Add(patient);
}

public class LabOrderRepository(AppDbContext db) : ILabOrderRepository
{
    public Task<LabOrder?> GetAsync(Guid id, CancellationToken ct = default) =>
        db.LabOrders
            .Include(o => o.Patient)
            .Include(o => o.Referrer)
            .Include(o => o.Items)
            .Include(o => o.Containers)
            .AsSplitQuery()
            .FirstOrDefaultAsync(o => o.Id == id, ct);

    public async Task<PagedResult<OrderSummaryDto>> PageAsync(OrderFilter filter, DateTime? fromUtc, DateTime? toUtc, PageRequest page, CancellationToken ct = default)
    {
        var query = Filtered(filter, fromUtc, toUtc);
        return await Page(query, query.OrderByDescending(o => o.OrderedAt).ThenBy(o => o.Id), page, ct);
    }

    public async Task<PagedResult<OrderSummaryDto>> CheckInAsync(CheckInTab tab, OrderFilter filter, DateTime? fromUtc, DateTime? toUtc, PageRequest page, CancellationToken ct = default)
    {
        var query = Filtered(filter with { Status = null }, fromUtc, toUtc);
        query = tab switch
        {
            CheckInTab.Collect => query.Where(o => o.Status != OrderStatus.Cancelled && o.Containers.Any(c => c.Status == ContainerStatus.Pending)),
            CheckInTab.Receive => query.Where(o => o.Status != OrderStatus.Cancelled && o.Containers.Any(c => c.Status == ContainerStatus.Collected)),
            CheckInTab.Received => query.Where(o => o.Containers.Any(c => c.Status == ContainerStatus.Received)),
            _ => query.Where(o => o.Containers.Any(c => c.Status == ContainerStatus.Rejected)),
        };
        // Work still to do: urgent first, then oldest first. Done work: newest first.
        var ordered = tab is CheckInTab.Collect or CheckInTab.Receive
            ? query.OrderByDescending(o => o.Urgent).ThenBy(o => o.OrderedAt).ThenBy(o => o.Id)
            : query.OrderByDescending(o => o.ReceivedAt ?? o.OrderedAt).ThenBy(o => o.Id);
        return await Page(query, ordered, page, ct);
    }

    public async Task<PagedResult<OrderSummaryDto>> WorklistAsync(WorklistStage stage, OrderFilter filter, DateTime? fromUtc, DateTime? toUtc, PageRequest page, CancellationToken ct = default)
    {
        var query = Stage(Filtered(filter with { Status = null }, fromUtc, toUtc), stage);
        return await Page(query, query.OrderByDescending(o => o.Urgent).ThenBy(o => o.OrderedAt).ThenBy(o => o.Id), page, ct);
    }

    private static IQueryable<LabOrder> Stage(IQueryable<LabOrder> query, WorklistStage stage) => stage switch
    {
        WorklistStage.Entry => query.Where(o => o.Status != OrderStatus.Cancelled
            && o.Items.Any(i => i.ResultStatus == ResultStatus.Pending && o.Containers.Any(c => c.Id == i.ContainerId && c.Status == ContainerStatus.Received))),
        WorklistStage.Verify => query.Where(o => o.Status != OrderStatus.Cancelled && o.Items.Any(i => i.ResultStatus == ResultStatus.Entered)),
        WorklistStage.Approve => query.Where(o => o.Status != OrderStatus.Cancelled && o.Items.Any(i => i.ResultStatus == ResultStatus.Verified)),
        WorklistStage.Critical => query.Where(o => o.Status != OrderStatus.Cancelled
            && o.Items.Any(i => (i.Flag == ResultFlag.CriticalLow || i.Flag == ResultFlag.CriticalHigh) && i.ResultStatus != ResultStatus.Approved)),
        _ => query.Where(o => o.Status == OrderStatus.InProgress || o.Status == OrderStatus.Completed),
    };

    public async Task<ResultsKpiDto> ResultsKpiAsync(CancellationToken ct = default)
    {
        var all = db.LabOrders.AsQueryable();
        return new ResultsKpiDto(
            await Stage(all, WorklistStage.Entry).CountAsync(ct),
            await Stage(all, WorklistStage.Verify).CountAsync(ct),
            await Stage(all, WorklistStage.Approve).CountAsync(ct),
            await db.OrderItems.CountAsync(i => (i.Flag == ResultFlag.CriticalLow || i.Flag == ResultFlag.CriticalHigh)
                && (i.ResultStatus == ResultStatus.Entered || i.ResultStatus == ResultStatus.Verified), ct));
    }

    public Task<List<OrderSummaryDto>> ForPatientAsync(Guid patientId, CancellationToken ct = default) =>
        Summaries(db.LabOrders.Where(o => o.PatientId == patientId).OrderByDescending(o => o.OrderedAt)).Take(200).ToListAsync(ct);

    public async Task<(List<OrderSummaryDto> Orders, string? MatchedLsn)> SearchAsync(string text, int take, CancellationToken ct = default)
    {
        // A scanned label is an exact LSN: that container's order, and nothing else.
        var lsn = text.Trim().ToUpperInvariant();
        var byLabel = await db.Containers.Where(c => c.Lsn == lsn).Select(c => c.LabOrderId).FirstOrDefaultAsync(ct);
        if (byLabel != Guid.Empty)
            return (await Summaries(db.LabOrders.Where(o => o.Id == byLabel)).ToListAsync(ct), lsn);

        var query = Filtered(new OrderFilter(Search: text), null, null).OrderByDescending(o => o.OrderedAt).ThenBy(o => o.Id);
        return (await Summaries(query).Take(take).ToListAsync(ct), null);
    }

    public async Task<List<OrderFact>> FactsAsync(DateTime fromUtc, DateTime toUtc, Guid? referrerId, Guid? departmentId, CancellationToken ct = default)
    {
        var query = db.LabOrders.AsNoTracking().Where(o => o.OrderedAt >= fromUtc && o.OrderedAt < toUtc);
        if (referrerId is { } r) query = query.Where(o => o.ReferrerId == r);
        if (departmentId is { } d) query = query.Where(o => o.Items.Any(i => i.DepartmentId == d));

        var rows = await query
            .OrderBy(o => o.OrderedAt)
            .Take(20_000)
            .Select(o => new
            {
                o.Id,
                o.OrderedAt,
                o.CollectedAt,
                o.ReceivedAt,
                o.CompletedAt,
                o.Status,
                o.ReferrerId,
                ReferrerName = o.Referrer != null ? o.Referrer.Name : null,
                o.PatientId,
                o.Total,
                Items = o.Items.Select(i => new ItemFact(i.LabTestId, i.TestCode, i.TestNameEn, i.DepartmentId, i.Price, i.ResultStatus, i.EnteredAt, i.VerifiedAt, i.ApprovedAt, i.TatTargetHours)).ToList(),
                Containers = o.Containers.Select(c => new ContainerFact(c.Status, c.ReceivedAt, c.RejectedAt)).ToList(),
            })
            .AsSplitQuery()
            .ToListAsync(ct);
        return rows
            .Select(o => new OrderFact(o.Id, o.OrderedAt, o.CollectedAt, o.ReceivedAt, o.CompletedAt, o.Status, o.ReferrerId, o.ReferrerName, o.PatientId, o.Total, o.Items, o.Containers))
            .ToList();
    }

    public Task<List<ResultEvent>> HistoryAsync(Guid itemId, CancellationToken ct = default) =>
        db.ResultEvents.AsNoTracking().Where(e => e.OrderItemId == itemId).OrderByDescending(e => e.At).Take(100).ToListAsync(ct);

    public void Add(LabOrder order) => db.LabOrders.Add(order);

    public void AddContainer(SpecimenContainer container) => db.Containers.Add(container);

    public void AddEvent(ResultEvent resultEvent) => db.ResultEvents.Add(resultEvent);

    private IQueryable<LabOrder> Filtered(OrderFilter f, DateTime? fromUtc, DateTime? toUtc)
    {
        var query = db.LabOrders.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(f.Search))
        {
            var text = f.Search.Trim();
            var pattern = Like.Contains(text);
            query = query.Where(o =>
                EF.Functions.ILike(o.OrderNo, pattern, Like.Escape)
                || EF.Functions.ILike(o.Patient!.Hn, pattern, Like.Escape)
                || EF.Functions.ILike(o.Patient.FirstNameTh + " " + o.Patient.LastNameTh, pattern, Like.Escape)
                || (o.Patient.CitizenId != null && o.Patient.CitizenId == text)
                || (o.ReferrerRef != null && EF.Functions.ILike(o.ReferrerRef, pattern, Like.Escape))
                || o.Containers.Any(c => EF.Functions.ILike(c.Lsn, pattern, Like.Escape)));
        }
        if (f.Status is { } status) query = query.Where(o => o.Status == status);
        if (f.OpenOnly) query = query.Where(o => o.Status == OrderStatus.AwaitingCollection || o.Status == OrderStatus.InProgress);
        if (f.ReferrerId is { } referrer) query = query.Where(o => o.ReferrerId == referrer);
        if (f.DepartmentId is { } department) query = query.Where(o => o.Items.Any(i => i.DepartmentId == department));
        if (f.TestId is { } test) query = query.Where(o => o.Items.Any(i => i.LabTestId == test));
        if (fromUtc is { } from) query = query.Where(o => o.OrderedAt >= from);
        if (toUtc is { } to) query = query.Where(o => o.OrderedAt < to);
        return query;
    }

    private static async Task<PagedResult<OrderSummaryDto>> Page(IQueryable<LabOrder> query, IQueryable<LabOrder> ordered, PageRequest page, CancellationToken ct)
    {
        var total = await query.CountAsync(ct);
        var items = await Summaries(ordered.Skip(page.Skip).Take(page.PageSize)).ToListAsync(ct);
        return new PagedResult<OrderSummaryDto>(items, total, page.Page, page.PageSize);
    }

    private static IQueryable<OrderSummaryDto> Summaries(IQueryable<LabOrder> query) => query.Select(o => new OrderSummaryDto(
        o.Id,
        o.OrderNo,
        o.PatientId,
        o.Patient!.Hn,
        (o.Patient.Prefix ?? "") + o.Patient.FirstNameTh + " " + o.Patient.LastNameTh,
        o.Referrer != null ? o.Referrer.Name : null,
        o.Status,
        o.Urgent,
        o.Items.Count(i => i.ResultStatus != ResultStatus.Cancelled),
        o.Items.Count(i => i.ResultStatus == ResultStatus.Entered || i.ResultStatus == ResultStatus.Verified || i.ResultStatus == ResultStatus.Approved),
        o.Items.Count(i => i.ResultStatus == ResultStatus.Verified || i.ResultStatus == ResultStatus.Approved),
        o.Items.Count(i => i.ResultStatus == ResultStatus.Approved),
        o.Containers.Count(),
        o.Containers.Count(c => c.Status == ContainerStatus.Collected),
        o.Containers.Count(c => c.Status == ContainerStatus.Received),
        o.Containers.Count(c => c.Status == ContainerStatus.Rejected),
        o.Items.Any(i => i.Flag == ResultFlag.CriticalLow || i.Flag == ResultFlag.CriticalHigh),
        o.Total,
        o.OrderedAt,
        o.ReceivedAt));
}

public class InvoiceRepository(AppDbContext db) : IInvoiceRepository
{
    private IQueryable<Invoice> WithDetails => db.Invoices.Include(i => i.Patient).Include(i => i.LabOrder).Include(i => i.Payments);

    public Task<Invoice?> GetAsync(Guid id, CancellationToken ct = default) =>
        WithDetails.AsSplitQuery().FirstOrDefaultAsync(i => i.Id == id, ct);

    public Task<Invoice?> GetByOrderAsync(Guid orderId, CancellationToken ct = default) =>
        db.Invoices.FirstOrDefaultAsync(i => i.LabOrderId == orderId, ct);

    public async Task<(List<Invoice> Items, int Total)> PageAsync(InvoiceFilter filter, DateTime? fromUtc, DateTime? toUtc, PageRequest page, CancellationToken ct = default)
    {
        var query = WithDetails.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var pattern = Like.Contains(filter.Search);
            query = query.Where(i =>
                EF.Functions.ILike(i.InvoiceNo, pattern, Like.Escape)
                || EF.Functions.ILike(i.LabOrder!.OrderNo, pattern, Like.Escape)
                || EF.Functions.ILike(i.Patient!.Hn, pattern, Like.Escape)
                || EF.Functions.ILike(i.Patient.FirstNameTh + " " + i.Patient.LastNameTh, pattern, Like.Escape));
        }
        if (filter.Status is { } status) query = query.Where(i => i.Status == status);
        if (filter.ReferrerId is { } referrer) query = query.Where(i => i.LabOrder!.ReferrerId == referrer);
        if (fromUtc is { } from) query = query.Where(i => i.IssuedAt >= from);
        if (toUtc is { } to) query = query.Where(i => i.IssuedAt < to);

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(i => i.IssuedAt).ThenBy(i => i.Id).Skip(page.Skip).Take(page.PageSize).AsSplitQuery().ToListAsync(ct);
        return (items, total);
    }

    public Task<List<Invoice>> OutstandingAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct = default)
    {
        var query = WithDetails.AsNoTracking().Where(i => i.Status == InvoiceStatus.Unpaid || i.Status == InvoiceStatus.Partial);
        if (fromUtc is { } from) query = query.Where(i => i.IssuedAt >= from);
        if (toUtc is { } to) query = query.Where(i => i.IssuedAt < to);
        return query.OrderBy(i => i.IssuedAt).Take(5000).AsSplitQuery().ToListAsync(ct);
    }

    public async Task<(decimal Billed, decimal Paid)> TotalsAsync(CancellationToken ct = default)
    {
        var live = db.Invoices.Where(i => i.Status != InvoiceStatus.Cancelled);
        return (await live.SumAsync(i => i.Amount, ct), await live.SumAsync(i => i.Paid, ct));
    }

    public async Task<(decimal Amount, int Count)> PaymentsAsync(DateTime fromUtc, DateTime toUtc, Guid? referrerId = null, Guid? departmentId = null, CancellationToken ct = default)
    {
        var query = Payments(fromUtc, toUtc, referrerId, departmentId);
        return (await query.SumAsync(p => p.Amount, ct), await query.CountAsync(ct));
    }

    public async Task<List<(DateTime PaidAt, decimal Amount)>> PaymentListAsync(DateTime fromUtc, DateTime toUtc, Guid? referrerId = null, Guid? departmentId = null, CancellationToken ct = default)
    {
        var rows = await Payments(fromUtc, toUtc, referrerId, departmentId).Select(p => new { p.PaidAt, p.Amount }).ToListAsync(ct);
        return rows.Select(p => (p.PaidAt, p.Amount)).ToList();
    }

    private IQueryable<Payment> Payments(DateTime fromUtc, DateTime toUtc, Guid? referrerId, Guid? departmentId)
    {
        var query = db.Payments.AsNoTracking().Where(p => p.PaidAt >= fromUtc && p.PaidAt < toUtc);
        if (referrerId is { } r)
            query = query.Where(p => db.Invoices.Any(i => i.Id == p.InvoiceId && i.LabOrder!.ReferrerId == r));
        if (departmentId is { } d)
            query = query.Where(p => db.Invoices.Any(i => i.Id == p.InvoiceId && i.LabOrder!.Items.Any(x => x.DepartmentId == d)));
        return query;
    }

    public void Add(Invoice invoice) => db.Invoices.Add(invoice);

    public void AddPayment(Payment payment) => db.Payments.Add(payment);
}

public class AuditRepository(AppDbContext db) : IAuditRepository
{
    public void Add(AuditLog entry) => db.AuditLogs.Add(entry);

    public async Task<(List<AuditLog> Items, int Total)> PageAsync(AuditFilter filter, DateTime? fromUtc, DateTime? toUtc, PageRequest page, CancellationToken ct = default)
    {
        var query = db.AuditLogs.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var pattern = Like.Contains(filter.Search);
            query = query.Where(a =>
                EF.Functions.ILike(a.UserName, pattern, Like.Escape)
                || (a.Detail != null && EF.Functions.ILike(a.Detail, pattern, Like.Escape))
                || (a.EntityId != null && EF.Functions.ILike(a.EntityId, pattern, Like.Escape)));
        }
        if (!string.IsNullOrWhiteSpace(filter.Action)) query = query.Where(a => a.Action == filter.Action);
        if (!string.IsNullOrWhiteSpace(filter.EntityType)) query = query.Where(a => a.EntityType == filter.EntityType);
        if (fromUtc is { } from) query = query.Where(a => a.At >= from);
        if (toUtc is { } to) query = query.Where(a => a.At < to);

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(a => a.At).ThenBy(a => a.Id).Skip(page.Skip).Take(page.PageSize).ToListAsync(ct);
        return (items, total);
    }
}

public class SequenceRepository(AppDbContext db) : ISequenceRepository
{
    public async Task<int> NextAsync(Guid organizationId, string key, CancellationToken ct = default)
    {
        // One statement: two requests at the same moment can never get the same number.
        var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open) await db.Database.OpenConnectionAsync(ct);
        await using var command = connection.CreateCommand();
        command.Transaction = db.Database.CurrentTransaction?.GetDbTransaction();
        command.CommandText =
            $"INSERT INTO {AppDbContext.Schema}.number_sequences (organization_id, key, value) VALUES (@org, @key, 1) " +
            "ON CONFLICT (organization_id, key) DO UPDATE SET value = number_sequences.value + 1 RETURNING value";
        AddParameter(command, "org", organizationId);
        AddParameter(command, "key", key);
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
    }

    private static void AddParameter(System.Data.Common.DbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}

internal static class Like
{
    public const string Escape = "\\";

    /// <summary>Wraps user text for a "contains" match, escaping LIKE wildcards in it.</summary>
    public static string Contains(string text) =>
        "%" + text.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
}
