using System.Globalization;
using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Application.Repositories;
using HsmLis.Domain;
using HsmLis.Domain.Entities;

namespace HsmLis.Application.Services;

public interface IOrderService
{
    Task<PagedResult<OrderSummaryDto>> PageAsync(OrderFilter filter, PageRequest page, CancellationToken ct = default);
    Task<OrderDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<OrderDetailDto> CreateAsync(CreateOrderRequest request, CancellationToken ct = default);
    Task<OrderDetailDto> CancelAsync(Guid id, CancelOrderRequest request, CancellationToken ct = default);
    Task<SearchResultDto> SearchAsync(string text, CancellationToken ct = default);

    Task<PagedResult<OrderSummaryDto>> CheckInAsync(CheckInTab tab, OrderFilter filter, PageRequest page, CancellationToken ct = default);
    Task<OrderDetailDto> CollectAsync(Guid id, ContainerIdsRequest request, CancellationToken ct = default);
    Task<OrderDetailDto> ReceiveAsync(Guid id, ReceiveRequest request, CancellationToken ct = default);
    /// <summary>Receives every collected container of the given orders. Returns how many containers were received.</summary>
    Task<int> BulkReceiveAsync(BulkReceiveRequest request, CancellationToken ct = default);
    Task<OrderDetailDto> RejectAsync(Guid id, RejectRequest request, CancellationToken ct = default);
    Task<OrderDetailDto> RecollectAsync(Guid id, Guid containerId, CancellationToken ct = default);
    Task<OrderDetailDto> AddContainerAsync(Guid id, AddContainerRequest request, CancellationToken ct = default);
    Task<OrderDetailDto> UpdateContainerAsync(Guid id, Guid containerId, UpdateContainerRequest request, CancellationToken ct = default);
    Task<OrderDetailDto> RemoveContainerAsync(Guid id, Guid containerId, CancellationToken ct = default);
}

/// <summary>Helpers shared by the services that change an order.</summary>
internal static class OrderState
{
    /// <summary>Re-derives the status after a change and bumps the version, so a stale screen cannot save over it.</summary>
    public static void Refresh(LabOrder order, DateTime now)
    {
        var status = OrderRules.StatusOf(order.CancelledAt is not null, order.Containers.Select(c => c.Status), order.Items.Select(i => i.ResultStatus));
        if (status == OrderStatus.Completed && order.Status != OrderStatus.Completed) order.CompletedAt = now;
        if (status != OrderStatus.Completed) order.CompletedAt = null;
        order.Status = status;
        order.Version++;
    }

    public static void EnsureOpen(LabOrder order)
    {
        if (order.Status == OrderStatus.Cancelled)
            throw new ConflictException("order_cancelled", "This order has been cancelled.");
    }
}

public class OrderService(
    ILabOrderRepository orders,
    IPatientRepository patients,
    IInvoiceRepository invoices,
    ICatalogRepository<LabTest> tests,
    ICatalogRepository<TestPackage> packages,
    ICatalogRepository<SpecimenType> specimens,
    ICatalogRepository<Department> departments,
    ICatalogRepository<ReferringOrganization> referrers,
    ISequenceRepository sequences,
    IUnitOfWork unitOfWork,
    IOrgContextProvider context,
    IAuditTrail audit) : IOrderService
{
    public async Task<PagedResult<OrderSummaryDto>> PageAsync(OrderFilter filter, PageRequest page, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var (from, to) = ctx.Bounds(filter.From, filter.To);
        return await orders.PageAsync(filter, from, to, page, ct);
    }

    public async Task<OrderDetailDto> GetAsync(Guid id, CancellationToken ct = default) =>
        await DetailAsync(await Find(id, ct), await context.GetAsync(ct), ct);

    public async Task<SearchResultDto> SearchAsync(string text, CancellationToken ct = default)
    {
        var query = text.Trim();
        if (query.Length < 2) return new SearchResultDto([], null);
        var (found, lsn) = await orders.SearchAsync(query, 30, ct);
        return new SearchResultDto(found, lsn);
    }

    public async Task<OrderDetailDto> CreateAsync(CreateOrderRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var patient = await patients.GetAsync(request.PatientId, ct)
            ?? throw new NotFoundException("patient_not_found", "Patient not found.");

        ReferringOrganization? referrer = null;
        if (request.ReferrerId is { } referrerId)
        {
            referrer = await referrers.GetAsync(referrerId, ct);
            if (referrer is not { IsActive: true })
                throw new BusinessRuleException("referrer_not_found", "The referring unit does not exist or is switched off.");
        }

        var packageIds = request.PackageIds?.Distinct().ToList() ?? [];
        var chosenPackages = await packages.GetManyAsync(packageIds, ct);
        if (chosenPackages.Count != packageIds.Count || chosenPackages.Any(p => !p.IsActive))
            throw new BusinessRuleException("package_not_found", "A chosen package does not exist or is switched off.");

        var standaloneIds = request.TestIds?.Distinct().ToList() ?? [];
        var allTestIds = chosenPackages.SelectMany(p => p.TestIds).Concat(standaloneIds).Distinct().ToList();
        var testsById = (await tests.GetManyAsync(allTestIds, ct)).ToDictionary(t => t.Id);
        if (testsById.Count != allTestIds.Count || testsById.Values.Any(t => !t.IsActive))
            throw new BusinessRuleException("test_not_found", "A chosen test does not exist or is switched off.");

        var specimensById = (await specimens.ListAsync(ct)).ToDictionary(s => s.Id);
        var departmentsById = (await departments.ListAsync(ct)).ToDictionary(d => d.Id);

        var order = new LabOrder
        {
            Id = Guid.NewGuid(),
            OrganizationId = ctx.Org.Id,
            PatientId = patient.Id,
            Patient = patient,
            ReferrerId = referrer?.Id,
            Referrer = referrer,
            ReferrerRef = Text.Clean(request.ReferrerRef),
            Entitlement = Text.Clean(request.Entitlement),
            Urgent = request.Urgent,
            Diagnosis = Text.Clean(request.Diagnosis),
            Note = Text.Clean(request.Note),
            BpSystolic = request.BpSystolic,
            BpDiastolic = request.BpDiastolic,
            HeartRate = request.HeartRate,
            TemperatureC = request.TemperatureC,
            WeightKg = request.WeightKg,
            HeightCm = request.HeightCm,
            OrderedAt = ctx.Now,
            OrderedById = ctx.User.Id,
            OrderedByName = ctx.UserName,
            Status = OrderStatus.AwaitingCollection,
        };

        // A test that is both in a package and chosen on its own is done (and charged) once, in the package.
        var seen = new HashSet<Guid>();
        decimal subtotal = 0;
        foreach (var package in chosenPackages.OrderBy(p => p.Code, StringComparer.Ordinal))
        {
            var listPrice = package.TestIds.Sum(id => testsById[id].Price);
            var price = OrderRules.PackagePrice(listPrice, package.DiscountType, package.DiscountValue);
            order.Packages.Add(new OrderPackage { PackageId = package.Id, Code = package.Code, Name = package.NameTh, Price = price });
            subtotal += price;
            foreach (var testId in package.TestIds.Where(seen.Add))
                order.Items.Add(NewItem(ctx, order, testsById[testId], package));
        }
        foreach (var testId in standaloneIds.Where(seen.Add))
        {
            order.Items.Add(NewItem(ctx, order, testsById[testId], null));
            subtotal += testsById[testId].Price;
        }
        if (order.Items.Count == 0)
            throw new BusinessRuleException("order_no_tests", "Choose at least one test or package.");
        if (request.Discount > subtotal)
            throw new BusinessRuleException("discount_too_large", "The discount is larger than the total.");

        order.Subtotal = subtotal;
        order.Discount = request.Discount;
        order.Total = subtotal - request.Discount;

        // Department, then the catalog's own order: the order results are entered and printed in.
        var sort = 0;
        foreach (var item in order.Items
                     .OrderBy(i => departmentsById.GetValueOrDefault(i.DepartmentId)?.Code, StringComparer.Ordinal)
                     .ThenBy(i => testsById[i.LabTestId].SortOrder)
                     .ThenBy(i => i.TestCode, StringComparer.Ordinal))
            item.SortOrder = sort++;

        return await unitOfWork.InTransactionAsync(async () =>
        {
            var seq = await sequences.NextAsync(ctx.Org.Id, Numbering.OrderKey(ctx.Today), ct);
            order.OrderNo = Numbering.OrderNo(ctx.Org.OrderPrefix, ctx.Today, seq);

            // One container per kind of specimen, numbered in specimen-code order.
            var index = 0;
            foreach (var group in order.Items
                         .GroupBy(i => i.SpecimenTypeId)
                         .OrderBy(g => specimensById.GetValueOrDefault(g.Key)?.Code, StringComparer.Ordinal))
            {
                var specimen = specimensById.GetValueOrDefault(group.Key);
                var container = NewContainer(ctx, order, specimen, group.Key, ++index);
                order.Containers.Add(container);
                foreach (var item in group) item.ContainerId = container.Id;
            }

            orders.Add(order);
            var invoiceSeq = await sequences.NextAsync(ctx.Org.Id, Numbering.InvoiceKey(ctx.Today), ct);
            var invoice = new Invoice
            {
                Id = Guid.NewGuid(),
                OrganizationId = ctx.Org.Id,
                InvoiceNo = Numbering.InvoiceNo(ctx.Today, invoiceSeq),
                LabOrderId = order.Id,
                PatientId = patient.Id,
                IssuedAt = ctx.Now,
                Amount = order.Total,
                Status = order.Total == 0 ? InvoiceStatus.Paid : InvoiceStatus.Unpaid,
            };
            invoices.Add(invoice);
            audit.Write(ctx, "order.create", "order", order.Id.ToString(), $"{order.OrderNo} · {patient.Hn} · {order.Items.Count} test(s)");
            await unitOfWork.SaveChangesAsync(ct);
            return order.ToDetail(departmentsById, ctx.Today, invoice);
        }, ct);
    }

    public async Task<OrderDetailDto> CancelAsync(Guid id, CancelOrderRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Find(id, ct);
        OrderState.EnsureOpen(order);
        if (order.Items.Any(i => i.ResultStatus == ResultStatus.Approved))
            throw new ConflictException("order_has_results", "Results of this order have already been approved.");
        var invoice = await invoices.GetByOrderAsync(order.Id, ct);
        if (invoice is { Paid: > 0 })
            throw new ConflictException("order_has_payments", "Payments were recorded for this order. Refund them first.");

        order.CancelledAt = ctx.Now;
        order.CancelReason = request.Reason.Trim();
        foreach (var item in order.Items) item.ResultStatus = ResultStatus.Cancelled;
        if (invoice is not null)
        {
            invoice.Status = InvoiceStatus.Cancelled;
            invoice.Version++;
        }
        OrderState.Refresh(order, ctx.Now);
        audit.Write(ctx, "order.cancel", "order", order.Id.ToString(), $"{order.OrderNo}: {order.CancelReason}");
        await unitOfWork.SaveChangesAsync(ct);
        return await DetailAsync(order, ctx, ct);
    }

    // ---------- specimens ----------

    public async Task<PagedResult<OrderSummaryDto>> CheckInAsync(CheckInTab tab, OrderFilter filter, PageRequest page, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var (from, to) = ctx.Bounds(filter.From, filter.To);
        return await orders.CheckInAsync(tab, filter, from, to, page, ct);
    }

    public async Task<OrderDetailDto> CollectAsync(Guid id, ContainerIdsRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Find(id, ct);
        OrderState.EnsureOpen(order);
        var targets = Pick(order, request.ContainerIds, c => c.Status == ContainerStatus.Pending, "container_not_pending");
        foreach (var c in targets)
        {
            c.Status = ContainerStatus.Collected;
            c.CollectedAt = ctx.Now;
            c.CollectedByName = ctx.UserName;
        }
        order.CollectedAt ??= ctx.Now;
        OrderState.Refresh(order, ctx.Now);
        audit.Write(ctx, "specimen.collect", "order", order.Id.ToString(), $"{order.OrderNo}: {string.Join(", ", targets.Select(c => c.Lsn))}");
        await unitOfWork.SaveChangesAsync(ct);
        return await DetailAsync(order, ctx, ct);
    }

    public async Task<OrderDetailDto> ReceiveAsync(Guid id, ReceiveRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Find(id, ct);
        OrderState.EnsureOpen(order);
        var targets = Pick(order, request.ContainerIds, c => c.Status is ContainerStatus.Pending or ContainerStatus.Collected, "container_not_receivable");
        Receive(ctx, order, targets, Text.Clean(request.Volume), Text.Clean(request.Condition), Text.Clean(request.Comment));
        audit.Write(ctx, "specimen.receive", "order", order.Id.ToString(), $"{order.OrderNo}: {string.Join(", ", targets.Select(c => c.Lsn))}");
        await unitOfWork.SaveChangesAsync(ct);
        return await DetailAsync(order, ctx, ct);
    }

    public async Task<int> BulkReceiveAsync(BulkReceiveRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var received = 0;
        foreach (var id in request.OrderIds.Distinct())
        {
            var order = await orders.GetAsync(id, ct);
            if (order is null || order.Status == OrderStatus.Cancelled) continue;
            var targets = order.Containers.Where(c => c.Status == ContainerStatus.Collected).ToList();
            if (targets.Count == 0) continue;
            Receive(ctx, order, targets, null, null, null);
            audit.Write(ctx, "specimen.receive", "order", order.Id.ToString(), $"{order.OrderNo}: {string.Join(", ", targets.Select(c => c.Lsn))}");
            received += targets.Count;
        }
        await unitOfWork.SaveChangesAsync(ct);
        return received;
    }

    private static void Receive(OrgContext ctx, LabOrder order, List<SpecimenContainer> targets, string? volume, string? condition, string? comment)
    {
        foreach (var c in targets)
        {
            if (c.Status == ContainerStatus.Pending)
            {
                c.CollectedAt = ctx.Now;
                c.CollectedByName = ctx.UserName;
            }
            c.Status = ContainerStatus.Received;
            c.ReceivedAt = ctx.Now;
            c.ReceivedByName = ctx.UserName;
            c.Volume = volume ?? c.Volume;
            c.Condition = condition ?? c.Condition;
            c.Comment = comment ?? c.Comment;
        }
        order.CollectedAt ??= ctx.Now;
        order.ReceivedAt ??= ctx.Now;
        OrderState.Refresh(order, ctx.Now);
    }

    public async Task<OrderDetailDto> RejectAsync(Guid id, RejectRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Find(id, ct);
        OrderState.EnsureOpen(order);
        var container = FindContainer(order, request.ContainerId);
        if (container.Status == ContainerStatus.Rejected)
            throw new ConflictException("container_already_rejected", "This specimen has already been rejected.");
        if (order.Items.Any(i => i.ContainerId == container.Id && i.ResultStatus is not (ResultStatus.Pending or ResultStatus.Cancelled)))
            throw new ConflictException("container_has_results", "Results were already entered from this specimen.");

        container.Status = ContainerStatus.Rejected;
        container.RejectedAt = ctx.Now;
        container.RejectedByName = ctx.UserName;
        container.RejectReason = request.Reason.Trim();
        OrderState.Refresh(order, ctx.Now);
        audit.Write(ctx, "specimen.reject", "order", order.Id.ToString(), $"{container.Lsn}: {container.RejectReason}");
        await unitOfWork.SaveChangesAsync(ct);
        return await DetailAsync(order, ctx, ct);
    }

    /// <summary>A new container for the tests of a rejected one, so the specimen can be taken again.</summary>
    public async Task<OrderDetailDto> RecollectAsync(Guid id, Guid containerId, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Find(id, ct);
        OrderState.EnsureOpen(order);
        var old = FindContainer(order, containerId);
        if (old.Status != ContainerStatus.Rejected || order.Containers.Any(c => c.ReplacesId == old.Id))
            throw new ConflictException("container_not_recollectable", "Only a rejected specimen can be collected again, and only once.");

        var replacement = NewContainer(ctx, order, null, old.SpecimenTypeId, NextIndex(order));
        replacement.SpecimenName = old.SpecimenName;
        replacement.ContainerType = old.ContainerType;
        replacement.ReplacesId = old.Id;
        order.Containers.Add(replacement);
        orders.AddContainer(replacement);
        foreach (var item in order.Items.Where(i => i.ContainerId == old.Id)) item.ContainerId = replacement.Id;
        OrderState.Refresh(order, ctx.Now);
        audit.Write(ctx, "specimen.recollect", "order", order.Id.ToString(), $"{old.Lsn} → {replacement.Lsn}");
        await unitOfWork.SaveChangesAsync(ct);
        return await DetailAsync(order, ctx, ct);
    }

    public async Task<OrderDetailDto> AddContainerAsync(Guid id, AddContainerRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Find(id, ct);
        OrderState.EnsureOpen(order);
        var specimen = await specimens.GetAsync(request.SpecimenTypeId, ct)
            ?? throw new BusinessRuleException("specimen_not_found", "The specimen type does not exist.");
        var container = NewContainer(ctx, order, specimen, specimen.Id, NextIndex(order));
        order.Containers.Add(container);
        orders.AddContainer(container);
        OrderState.Refresh(order, ctx.Now);
        audit.Write(ctx, "specimen.add", "order", order.Id.ToString(), container.Lsn);
        await unitOfWork.SaveChangesAsync(ct);
        return await DetailAsync(order, ctx, ct);
    }

    public async Task<OrderDetailDto> UpdateContainerAsync(Guid id, Guid containerId, UpdateContainerRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Find(id, ct);
        var container = FindContainer(order, containerId);
        container.LabelCount = request.LabelCount;
        container.ContainerType = Text.Clean(request.ContainerType);
        order.Version++;
        await unitOfWork.SaveChangesAsync(ct);
        return await DetailAsync(order, ctx, ct);
    }

    public async Task<OrderDetailDto> RemoveContainerAsync(Guid id, Guid containerId, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Find(id, ct);
        var container = FindContainer(order, containerId);
        if (container.Status != ContainerStatus.Pending || order.Items.Any(i => i.ContainerId == container.Id))
            throw new ConflictException("container_in_use", "Only an extra, uncollected container without tests can be removed.");
        order.Containers.Remove(container);
        OrderState.Refresh(order, ctx.Now);
        audit.Write(ctx, "specimen.remove", "order", order.Id.ToString(), container.Lsn);
        await unitOfWork.SaveChangesAsync(ct);
        return await DetailAsync(order, ctx, ct);
    }

    // ---------- helpers ----------

    private async Task<LabOrder> Find(Guid id, CancellationToken ct) =>
        await orders.GetAsync(id, ct) ?? throw new NotFoundException("order_not_found", "Order not found.");

    private async Task<OrderDetailDto> DetailAsync(LabOrder order, OrgContext ctx, CancellationToken ct)
    {
        var deps = (await departments.ListAsync(ct)).ToDictionary(d => d.Id);
        return order.ToDetail(deps, ctx.Today, await invoices.GetByOrderAsync(order.Id, ct));
    }

    private static SpecimenContainer FindContainer(LabOrder order, Guid containerId) =>
        order.Containers.FirstOrDefault(c => c.Id == containerId)
        ?? throw new NotFoundException("container_not_found", "Specimen container not found.");

    /// <summary>The requested containers (or, when none are named, all that qualify). A named one that does not qualify is an error.</summary>
    private static List<SpecimenContainer> Pick(LabOrder order, List<Guid>? ids, Func<SpecimenContainer, bool> qualifies, string errorCode)
    {
        if (ids is null || ids.Count == 0)
        {
            var all = order.Containers.Where(qualifies).ToList();
            return all.Count > 0 ? all : throw new ConflictException(errorCode, "No specimen of this order is in a state for this.");
        }
        var picked = ids.Distinct().Select(id => FindContainer(order, id)).ToList();
        if (picked.Any(c => !qualifies(c)))
            throw new ConflictException(errorCode, "A chosen specimen is not in a state for this.");
        return picked;
    }

    private static int NextIndex(LabOrder order) =>
        order.Containers
            .Select(c => int.TryParse(c.Lsn[(c.Lsn.LastIndexOf('-') + 1)..], NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max() + 1;

    private static SpecimenContainer NewContainer(OrgContext ctx, LabOrder order, SpecimenType? specimen, Guid specimenTypeId, int index) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = ctx.Org.Id,
        LabOrderId = order.Id,
        Lsn = Numbering.Lsn(order.OrderNo, index),
        SpecimenTypeId = specimenTypeId,
        SpecimenName = specimen?.NameEn ?? "",
        ContainerType = specimen?.ContainerType,
        LabelCount = 1,
        Status = ContainerStatus.Pending,
    };

    private static OrderItem NewItem(OrgContext ctx, LabOrder order, LabTest test, TestPackage? package) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = ctx.Org.Id,
        LabOrderId = order.Id,
        LabTestId = test.Id,
        PackageId = package?.Id,
        PackageCode = package?.Code,
        TestCode = test.Code,
        TestNameEn = test.NameEn,
        TestNameTh = test.NameTh,
        DepartmentId = test.DepartmentId,
        SpecimenTypeId = test.SpecimenTypeId,
        ResultType = test.ResultType,
        Options = [.. test.Options],
        Decimals = test.Decimals,
        Unit = test.Unit,
        Price = test.Price,
        TatTargetHours = test.TatTargetHours,
        ResultStatus = ResultStatus.Pending,
    };
}
