using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Application.Repositories;
using HsmLis.Domain.Entities;

namespace HsmLis.Application.Services;

public interface IBillingService
{
    Task<PagedResult<InvoiceDto>> PageAsync(InvoiceFilter filter, PageRequest page, CancellationToken ct = default);
    Task<InvoiceDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<InvoiceDto> PayAsync(Guid id, PayRequest request, CancellationToken ct = default);
    Task<BillingKpiDto> KpiAsync(CancellationToken ct = default);
    Task<ArSummaryDto> ArSummaryAsync(DateRange range, CancellationToken ct = default);
}

public class BillingService(
    IInvoiceRepository invoices,
    ILabOrderRepository orders,
    IUnitOfWork unitOfWork,
    IOrgContextProvider context,
    IAuditTrail audit) : IBillingService
{
    public async Task<PagedResult<InvoiceDto>> PageAsync(InvoiceFilter filter, PageRequest page, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var (from, to) = ctx.Bounds(filter.From, filter.To);
        var (items, total) = await invoices.PageAsync(filter, from, to, page, ct);
        return new PagedResult<InvoiceDto>(items.Select(i => i.ToDto(ctx.Today, ctx.LocalDay)).ToList(), total, page.Page, page.PageSize);
    }

    public async Task<InvoiceDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var invoice = await Find(id, ct);
        var order = await orders.GetAsync(invoice.LabOrderId, ct) ?? throw new NotFoundException("order_not_found", "Order not found.");

        // A package is one line at its package price; tests ordered on their own are a line each.
        // Tests cancelled one by one are left out (a package line drops by their share), so the lines add up to the subtotal.
        var lines = order.Packages
            .Where(p => order.Items.Any(i => i.PackageId == p.PackageId && i.CancelledAt == null))
            .Select(p => new InvoiceLineDto(p.Code, p.Name, OrderState.PackageCharge(order, p), p.Code))
            .Concat(order.Items
                .Where(i => i.PackageId is null && i.CancelledAt == null)
                .OrderBy(i => i.SortOrder)
                .Select(i => new InvoiceLineDto(i.TestCode, i.TestNameTh ?? i.TestNameEn, i.Price, null)))
            .ToList();
        return new InvoiceDetailDto(invoice.ToDto(ctx.Today, ctx.LocalDay), lines, order.Subtotal, order.Discount);
    }

    public async Task<InvoiceDto> PayAsync(Guid id, PayRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var invoice = await Find(id, ct);
        if (invoice.Version != request.Version)
            throw new ConflictException("invoice_changed", "This invoice changed meanwhile. Reload it and try again.");
        if (invoice.Status == InvoiceStatus.Cancelled)
            throw new ConflictException("invoice_cancelled", "This invoice has been cancelled.");
        var balance = invoice.Amount - invoice.Paid;
        if (request.Amount > balance)
            throw new BusinessRuleException("payment_too_large", "The payment is larger than what is still owed.");

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            OrganizationId = ctx.Org.Id,
            InvoiceId = invoice.Id,
            Amount = request.Amount,
            Method = request.Method,
            Note = Text.Clean(request.Note),
            PaidAt = ctx.Now,
            ReceivedByName = ctx.UserName,
        };
        invoice.Payments.Add(payment);
        invoices.AddPayment(payment);
        invoice.Paid += request.Amount;
        invoice.Status = invoice.Paid >= invoice.Amount ? InvoiceStatus.Paid : InvoiceStatus.Partial;
        invoice.Version++;
        audit.Write(ctx, "invoice.pay", "invoice", invoice.Id.ToString(), $"{invoice.InvoiceNo}: {request.Amount:0.00} ({request.Method})");
        await unitOfWork.SaveChangesAsync(ct);
        return invoice.ToDto(ctx.Today, ctx.LocalDay);
    }

    public async Task<BillingKpiDto> KpiAsync(CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var todayStart = ctx.StartUtc(ctx.Today);
        var tomorrow = ctx.StartUtc(ctx.Today.AddDays(1));
        var monthStart = ctx.StartUtc(new DateOnly(ctx.Today.Year, ctx.Today.Month, 1));
        var (todayAmount, todayCount) = await invoices.PaymentsAsync(todayStart, tomorrow, ct: ct);
        var (monthAmount, _) = await invoices.PaymentsAsync(monthStart, tomorrow, ct: ct);
        var outstanding = await invoices.OutstandingAsync(null, null, ct);
        return new BillingKpiDto(todayAmount, monthAmount, outstanding.Count, outstanding.Sum(i => i.Amount - i.Paid), todayCount);
    }

    public async Task<ArSummaryDto> ArSummaryAsync(DateRange range, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var (billed, paid) = await invoices.TotalsAsync(ct);
        var (from, to) = ctx.Bounds(range.From, range.To);
        var items = (await invoices.OutstandingAsync(from, to, ct)).Select(i => i.ToDto(ctx.Today, ctx.LocalDay)).ToList();

        (string Label, int Min, int? Max)[] bands = [("0-30", 0, 30), ("31-60", 31, 60), ("61-90", 61, 90), ("90+", 91, null)];
        var buckets = bands
            .Select(b =>
            {
                var inBand = items.Where(i => i.DaysOutstanding >= b.Min && (b.Max is null || i.DaysOutstanding <= b.Max)).ToList();
                return new AgingBucketDto(b.Label, b.Min, b.Max, inBand.Sum(i => i.Balance), inBand.Count);
            })
            .ToList();
        return new ArSummaryDto(billed, paid, billed - paid, buckets, items);
    }

    private async Task<Invoice> Find(Guid id, CancellationToken ct) =>
        await invoices.GetAsync(id, ct) ?? throw new NotFoundException("invoice_not_found", "Invoice not found.");
}

public interface IAuditService
{
    Task<PagedResult<AuditLogDto>> PageAsync(AuditFilter filter, PageRequest page, CancellationToken ct = default);
}

public class AuditService(IAuditRepository audit, IOrgContextProvider context) : IAuditService
{
    public async Task<PagedResult<AuditLogDto>> PageAsync(AuditFilter filter, PageRequest page, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var (from, to) = ctx.Bounds(filter.From, filter.To);
        var (items, total) = await audit.PageAsync(filter, from, to, page, ct);
        return new PagedResult<AuditLogDto>(items.Select(a => a.ToDto()).ToList(), total, page.Page, page.PageSize);
    }
}
