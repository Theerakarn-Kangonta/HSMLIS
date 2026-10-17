using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Application.Repositories;
using HsmLis.Domain;
using HsmLis.Domain.Entities;

namespace HsmLis.Application.Services;

public interface IResultService
{
    Task<ResultsKpiDto> KpiAsync(CancellationToken ct = default);
    Task<PagedResult<OrderSummaryDto>> WorklistAsync(WorklistStage stage, OrderFilter filter, PageRequest page, CancellationToken ct = default);
    Task<ResultActionResponse> SaveAsync(Guid orderId, SaveResultsRequest request, CancellationToken ct = default);
    Task<ResultActionResponse> VerifyAsync(Guid orderId, ResultActionRequest request, CancellationToken ct = default);
    Task<ResultActionResponse> ApproveAsync(Guid orderId, ResultActionRequest request, CancellationToken ct = default);
    Task<ResultActionResponse> ReopenAsync(Guid orderId, ReopenRequest request, CancellationToken ct = default);
    Task<List<ResultEventDto>> HistoryAsync(Guid orderId, Guid itemId, CancellationToken ct = default);
}

/// <summary>
/// Results go Pending → Entered → Verified → Approved. Entering needs a received specimen;
/// approving needs a verified result and, for one's own work, a minute's wait (ApprovalRule).
/// </summary>
public class ResultService(
    ILabOrderRepository orders,
    IInvoiceRepository invoices,
    ICatalogRepository<LabTest> tests,
    ICatalogRepository<Department> departments,
    IUnitOfWork unitOfWork,
    IOrgContextProvider context,
    IAuditTrail audit) : IResultService
{
    public Task<ResultsKpiDto> KpiAsync(CancellationToken ct = default) => orders.ResultsKpiAsync(ct);

    public async Task<PagedResult<OrderSummaryDto>> WorklistAsync(WorklistStage stage, OrderFilter filter, PageRequest page, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var (from, to) = ctx.Bounds(filter.From, filter.To);
        return await orders.WorklistAsync(stage, filter, from, to, page, ct);
    }

    public async Task<ResultActionResponse> SaveAsync(Guid orderId, SaveResultsRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Load(orderId, request.Version, ct);
        var testsById = (await tests.GetManyAsync(order.Items.Select(i => i.LabTestId).Distinct().ToList(), ct)).ToDictionary(t => t.Id);
        var age = ResultRules.AgeInYears(order.Patient!.BirthDate, ctx.Today);

        var done = 0;
        var skipped = 0;
        string? skippedReason = null;
        foreach (var input in request.Results)
        {
            var item = FindItem(order, input.ItemId);
            var value = Text.Clean(input.Value);
            var comment = Text.Clean(input.Comment);
            if (value == item.Value && comment == item.Comment) continue;

            var blocked = item.ResultStatus switch
            {
                ResultStatus.Approved => "result_approved",
                ResultStatus.Cancelled => "result_cancelled",
                _ => order.Containers.FirstOrDefault(c => c.Id == item.ContainerId)?.Status != ContainerStatus.Received ? "specimen_not_received" : null,
            };
            if (blocked is not null)
            {
                skipped++;
                skippedReason ??= blocked;
                continue;
            }

            if (value is null)
            {
                ClearResult(item);
                AddEvent(ctx, item, "clear");
            }
            else if (value != item.Value || item.ResultStatus == ResultStatus.Pending)
            {
                if (ResultRules.Validate(item.ResultType, value, item.Options) is { } problem)
                    throw new BusinessRuleException(problem, $"{item.TestCode}: the result is not valid for this test.");

                var range = testsById.TryGetValue(item.LabTestId, out var test)
                    ? ResultRules.PickRange(test.ReferenceRanges, order.Patient.Sex, age)
                    : null;
                item.Value = value;
                item.Flag = ResultRules.Evaluate(item.ResultType, value, range);
                item.RefLow = range?.Low;
                item.RefHigh = range?.High;
                item.CriticalLow = range?.CriticalLow;
                item.CriticalHigh = range?.CriticalHigh;
                item.RefText = ResultRules.Describe(range);
                item.ResultStatus = ResultStatus.Entered;
                item.EnteredAt = ctx.Now;
                item.EnteredById = ctx.User.Id;
                item.EnteredByName = ctx.UserName;
                item.VerifiedAt = null;
                item.VerifiedById = null;
                item.VerifiedByName = null;
                AddEvent(ctx, item, "enter");
            }
            item.Comment = comment;
            done++;
        }

        if (done == 0 && skippedReason is not null)
            throw new BusinessRuleException(skippedReason, "None of these results can be changed.");
        if (done > 0)
        {
            OrderState.Refresh(order, ctx.Now);
            audit.Write(ctx, "result.enter", "order", order.Id.ToString(), $"{order.OrderNo}: {done} result(s)");
            await unitOfWork.SaveChangesAsync(ct);
        }
        return await Respond(order, ctx, done, skipped, skippedReason, ct);
    }

    public async Task<ResultActionResponse> VerifyAsync(Guid orderId, ResultActionRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Load(orderId, request.Version, ct);
        var targets = Targets(order, request.ItemIds, ResultStatus.Entered);
        if (targets.Count == 0)
            throw new BusinessRuleException("nothing_to_verify", "There are no entered results to verify.");

        foreach (var item in targets)
        {
            item.ResultStatus = ResultStatus.Verified;
            item.VerifiedAt = ctx.Now;
            item.VerifiedById = ctx.User.Id;
            item.VerifiedByName = ctx.UserName;
            AddEvent(ctx, item, "verify");
        }
        OrderState.Refresh(order, ctx.Now);
        audit.Write(ctx, "result.verify", "order", order.Id.ToString(), $"{order.OrderNo}: {targets.Count} result(s)");
        await unitOfWork.SaveChangesAsync(ct);
        return await Respond(order, ctx, targets.Count, 0, null, ct);
    }

    public async Task<ResultActionResponse> ApproveAsync(Guid orderId, ResultActionRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Load(orderId, request.Version, ct);
        var targets = Targets(order, request.ItemIds, ResultStatus.Verified);
        if (targets.Count == 0)
            throw new BusinessRuleException("nothing_to_approve", "There are no verified results to approve.");

        var allowed = targets.Where(i => !ApprovalRule.Blocks(ctx.User.Id, i, ctx.Now)).ToList();
        var waiting = targets.Count - allowed.Count;
        if (allowed.Count == 0)
            throw new BusinessRuleException("self_approval_wait",
                $"{waiting} result(s) were entered or verified by you in the last minute. Wait a minute or ask a colleague to approve.");

        foreach (var item in allowed)
        {
            item.ResultStatus = ResultStatus.Approved;
            item.ApprovedAt = ctx.Now;
            item.ApprovedById = ctx.User.Id;
            item.ApprovedByName = ctx.UserName;
            AddEvent(ctx, item, "approve");
        }
        OrderState.Refresh(order, ctx.Now);
        audit.Write(ctx, "result.approve", "order", order.Id.ToString(), $"{order.OrderNo}: {allowed.Count} result(s)");
        await unitOfWork.SaveChangesAsync(ct);
        return await Respond(order, ctx, allowed.Count, waiting, waiting > 0 ? "self_approval_wait" : null, ct);
    }

    public async Task<ResultActionResponse> ReopenAsync(Guid orderId, ReopenRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var order = await Load(orderId, request.Version, ct);
        var item = FindItem(order, request.ItemId);
        if (item.ResultStatus is not (ResultStatus.Verified or ResultStatus.Approved))
            throw new BusinessRuleException("result_not_reopenable", "Only a verified or approved result can be reopened.");

        var wasApproved = item.ResultStatus == ResultStatus.Approved;
        item.ResultStatus = ResultStatus.Entered;
        item.VerifiedAt = null;
        item.VerifiedById = null;
        item.VerifiedByName = null;
        item.ApprovedAt = null;
        item.ApprovedById = null;
        item.ApprovedByName = null;
        AddEvent(ctx, item, "reopen");
        OrderState.Refresh(order, ctx.Now);
        audit.Write(ctx, wasApproved ? "result.amend" : "result.reopen", "order", order.Id.ToString(),
            $"{order.OrderNo} {item.TestCode} ({item.Value}): {request.Reason.Trim()}");
        await unitOfWork.SaveChangesAsync(ct);
        return await Respond(order, ctx, 1, 0, null, ct);
    }

    public async Task<List<ResultEventDto>> HistoryAsync(Guid orderId, Guid itemId, CancellationToken ct = default)
    {
        var order = await orders.GetAsync(orderId, ct) ?? throw new NotFoundException("order_not_found", "Order not found.");
        FindItem(order, itemId);
        return (await orders.HistoryAsync(itemId, ct)).Select(e => new ResultEventDto(e.Action, e.Value, e.Flag, e.UserName, e.At)).ToList();
    }

    private async Task<LabOrder> Load(Guid id, int version, CancellationToken ct)
    {
        var order = await orders.GetAsync(id, ct) ?? throw new NotFoundException("order_not_found", "Order not found.");
        OrderState.EnsureOpen(order);
        if (order.Version != version)
            throw new ConflictException("order_changed", "Someone else changed this order. Reload it and try again.");
        return order;
    }

    private static OrderItem FindItem(LabOrder order, Guid itemId) =>
        order.Items.FirstOrDefault(i => i.Id == itemId) ?? throw new NotFoundException("result_not_found", "Result not found.");

    private static List<OrderItem> Targets(LabOrder order, List<Guid>? ids, ResultStatus status) =>
        ids is { Count: > 0 }
            ? ids.Distinct().Select(id => FindItem(order, id)).Where(i => i.ResultStatus == status).ToList()
            : order.Items.Where(i => i.ResultStatus == status).ToList();

    private static void ClearResult(OrderItem item)
    {
        item.Value = null;
        item.Flag = ResultFlag.None;
        item.RefLow = item.RefHigh = item.CriticalLow = item.CriticalHigh = null;
        item.RefText = null;
        item.ResultStatus = ResultStatus.Pending;
        item.EnteredAt = null;
        item.EnteredById = null;
        item.EnteredByName = null;
        item.VerifiedAt = null;
        item.VerifiedById = null;
        item.VerifiedByName = null;
    }

    private void AddEvent(OrgContext ctx, OrderItem item, string action) => orders.AddEvent(new ResultEvent
    {
        Id = Guid.NewGuid(),
        OrganizationId = ctx.Org.Id,
        OrderItemId = item.Id,
        Action = action,
        Value = item.Value,
        Flag = item.Flag,
        UserId = ctx.User.Id,
        UserName = ctx.UserName,
        At = ctx.Now,
    });

    private async Task<ResultActionResponse> Respond(LabOrder order, OrgContext ctx, int done, int skipped, string? reason, CancellationToken ct)
    {
        var deps = (await departments.ListAsync(ct)).ToDictionary(d => d.Id);
        var detail = order.ToDetail(deps, ctx.Today, await invoices.GetByOrderAsync(order.Id, ct));
        return new ResultActionResponse(detail, done, skipped, reason);
    }
}
