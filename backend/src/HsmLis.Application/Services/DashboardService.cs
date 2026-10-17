using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Application.Repositories;
using HsmLis.Domain.Entities;

namespace HsmLis.Application.Services;

public interface IDashboardService
{
    Task<DashboardDto> GetAsync(DateRange range, Guid? referrerId, Guid? departmentId, CancellationToken ct = default);
}

/// <summary>The overview's figures, over the orders placed in the chosen days.</summary>
public class DashboardService(ILabOrderRepository orders, IInvoiceRepository invoices, ICatalogRepository<Department> departments, IOrgContextProvider context) : IDashboardService
{
    public const int MaxDays = 366;

    /// <summary>The steps of the pipeline in order, by the stable names the screen translates.</summary>
    public static readonly string[] StepNames = ["ordered_collected", "collected_received", "received_entered", "entered_verified", "verified_approved"];

    public async Task<DashboardDto> GetAsync(DateRange range, Guid? referrerId, Guid? departmentId, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var to = range.To ?? ctx.Today;
        var from = range.From ?? to.AddDays(-6);
        if (from > to) (from, to) = (to, from);
        if (to.DayNumber - from.DayNumber >= MaxDays)
            throw new BusinessRuleException("range_too_long", "Choose at most a year.");

        var facts = await orders.FactsAsync(ctx.StartUtc(from), ctx.StartUtc(to.AddDays(1)), referrerId, departmentId, ct);
        var deps = (await departments.ListAsync(ct)).ToDictionary(d => d.Id);
        var live = facts.Where(f => f.Status != OrderStatus.Cancelled).ToList();
        var completed = live.Where(f => f.CompletedAt is not null).ToList();

        var tatHours = completed.Select(f => (decimal)(f.CompletedAt!.Value - f.OrderedAt).TotalHours).ToList();
        var withinTarget = completed.Count(f => (f.CompletedAt!.Value - f.OrderedAt).TotalHours <= f.Items.Select(i => i.TatTargetHours).DefaultIfEmpty(24).Max());

        var payments = await invoices.PaymentListAsync(ctx.StartUtc(from), ctx.StartUtc(to.AddDays(1)), referrerId, departmentId, ct);
        var kpis = new DashboardKpiDto(
            payments.Sum(p => p.Amount),
            live.Sum(f => f.Total),
            live.Select(f => f.PatientId).Distinct().Count(),
            live.Sum(f => f.Items.Count(i => i.Status == ResultStatus.Approved)),
            facts.Sum(f => f.Containers.Count(c => c.ReceivedAt is not null)),
            tatHours.Count > 0 ? Math.Round(tatHours.Average(), 1) : null,
            live.Count(f => f.Status is OrderStatus.AwaitingCollection or OrderStatus.InProgress));

        var daily = new List<DailyCountDto>();
        for (var day = from; day <= to; day = day.AddDays(1))
        {
            var d = day;
            daily.Add(new DailyCountDto(
                d,
                live.Where(f => ctx.LocalDay(f.OrderedAt) == d).Select(f => f.PatientId).Distinct().Count(),
                payments.Where(p => ctx.LocalDay(p.PaidAt) == d).Sum(p => p.Amount),
                facts.Sum(f => f.Containers.Count(c => c.RejectedAt is { } at && ctx.LocalDay(at) == d))));
        }

        var workload = live
            .GroupBy(f => (f.ReferrerId, Name: f.ReferrerName ?? ""))
            .Select(g => new NamedCountDto(g.Key.Name, g.Count(), null, g.Key.ReferrerId))
            .OrderByDescending(x => x.Count)
            .Take(8)
            .ToList();

        // Each order contributes the time between two steps when it reached both.
        var steps = new List<TatStepDto>();
        Func<OrderFact, (DateTime? Start, DateTime? End)>[] spans =
        [
            f => (f.OrderedAt, f.CollectedAt),
            f => (f.CollectedAt, f.ReceivedAt),
            f => (f.ReceivedAt, Min(f.Items.Select(i => i.EnteredAt))),
            f => (Min(f.Items.Select(i => i.EnteredAt)), Max(f.Items.Select(i => i.VerifiedAt))),
            f => (Max(f.Items.Select(i => i.VerifiedAt)), f.CompletedAt),
        ];
        for (var s = 0; s < spans.Length; s++)
        {
            var minutes = live
                .Select(spans[s])
                .Where(x => x.Start is not null && x.End is not null && x.End >= x.Start)
                .Select(x => (decimal)(x.End!.Value - x.Start!.Value).TotalMinutes)
                .Order()
                .ToList();
            steps.Add(new TatStepDto(StepNames[s], minutes.Count,
                minutes.Count > 0 ? Math.Round(minutes.Average(), 1) : null,
                minutes.Count > 0 ? Math.Round(Median(minutes), 1) : null));
        }

        var containers = facts.SelectMany(f => f.Containers).ToList();
        var status = new StatusCountsDto(
            facts.Count,
            facts.Count(f => f.Status == OrderStatus.Completed),
            facts.Count(f => f.Status == OrderStatus.InProgress),
            facts.Count(f => f.Status == OrderStatus.AwaitingCollection),
            facts.Count(f => f.Status == OrderStatus.Cancelled),
            containers.Count > 0 ? Math.Round(100m * containers.Count(c => c.Status == ContainerStatus.Rejected) / containers.Count, 1) : 0);

        var topTests = live
            .SelectMany(f => f.Items)
            .GroupBy(i => i.TestId)
            .Select(g => new NamedCountDto($"{g.First().TestCode} · {g.First().TestName}", g.Count(), null, g.Key))
            .OrderByDescending(x => x.Count)
            .Take(5)
            .ToList();

        var revenueByDepartment = live
            .SelectMany(f => f.Items)
            .GroupBy(i => i.DepartmentId)
            .Select(g =>
            {
                var dep = deps.GetValueOrDefault(g.Key);
                return new NamedAmountDto(dep?.NameEn ?? "", g.Sum(i => i.Price), dep?.Color, g.Key);
            })
            .OrderByDescending(x => x.Amount)
            .ToList();

        return new DashboardDto(
            from, to, kpis, daily, workload, steps,
            tatHours.Count > 0 ? Math.Round(tatHours.Average(), 1) : null,
            completed.Count > 0 ? Math.Round(100m * withinTarget / completed.Count, 1) : null,
            status, topTests, revenueByDepartment);
    }

    private static DateTime? Min(IEnumerable<DateTime?> values) => values.Where(v => v is not null).DefaultIfEmpty(null).Min();

    private static DateTime? Max(IEnumerable<DateTime?> values)
    {
        var list = values.ToList();
        // A step is reached only once every result has passed it.
        return list.Count > 0 && list.All(v => v is not null) ? list.Max() : null;
    }

    private static decimal Median(List<decimal> sorted) =>
        sorted.Count % 2 == 1 ? sorted[sorted.Count / 2] : (sorted[sorted.Count / 2 - 1] + sorted[sorted.Count / 2]) / 2;
}
