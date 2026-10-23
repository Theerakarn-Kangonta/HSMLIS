using System.ComponentModel.DataAnnotations;
using HsmLis.Api.Infrastructure;
using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Application.Services;
using HsmLis.Domain;
using HsmLis.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HsmLis.Api.Controllers;

[ApiController]
[Route("api/patients")]
[Authorize(Policy = Permissions.Patients)]
public class PatientsController(IPatientService patients) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<PatientDto>> List(
        [FromQuery, StringLength(100)] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) => patients.PageAsync(search, new PageRequest(page, pageSize), ct);

    [HttpGet("recent")]
    public Task<List<PatientDto>> Recent(CancellationToken ct) => patients.RecentAsync(ct);

    /// <summary>Patients who may be the same person, asked before registering a new one.</summary>
    [HttpGet("similar")]
    public Task<List<PatientDto>> Similar(
        [FromQuery, StringLength(13)] string? citizenId,
        [FromQuery, Required, StringLength(80)] string firstName,
        [FromQuery, Required, StringLength(80)] string lastName,
        [FromQuery] Guid? exceptId,
        CancellationToken ct) => patients.SimilarAsync(citizenId, firstName, lastName, exceptId, ct);

    [HttpGet("{id:guid}")]
    public Task<PatientDto> Get(Guid id, CancellationToken ct) => patients.GetAsync(id, ct);

    [HttpGet("{id:guid}/orders")]
    public Task<List<OrderSummaryDto>> Orders(Guid id, CancellationToken ct) => patients.OrdersAsync(id, ct);

    [HttpPost]
    public Task<PatientDto> Create(PatientRequest request, CancellationToken ct) => patients.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    public Task<PatientDto> Update(Guid id, PatientRequest request, CancellationToken ct) => patients.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await patients.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/photo")]
    public async Task<IActionResult> Photo(Guid id, CancellationToken ct)
    {
        var photo = await patients.GetPhotoAsync(id, ct);
        return File(photo.Data, photo.ContentType);
    }

    [HttpPut("{id:guid}/photo")]
    public Task<PatientDto> SetPhoto(Guid id, PatientPhotoRequest request, CancellationToken ct) => patients.SetPhotoAsync(id, request, ct);

    [HttpDelete("{id:guid}/photo")]
    public Task<PatientDto> RemovePhoto(Guid id, CancellationToken ct) => patients.RemovePhotoAsync(id, ct);
}

[ApiController]
[Route("api/orders")]
[Authorize(Policy = Permissions.Orders)]
public class OrdersController(IOrderService orders) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<OrderSummaryDto>> List(
        [FromQuery, StringLength(100)] string? search,
        [FromQuery] OrderStatus? status,
        [FromQuery] Guid? referrerId,
        [FromQuery] Guid? departmentId,
        [FromQuery] Guid? testId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] bool open = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        orders.PageAsync(new OrderFilter(search, status, referrerId, departmentId, testId, from, to, open), new PageRequest(page, pageSize), ct);

    /// <summary>Finds orders by a scanned barcode (LSN), order number, HN or patient name.</summary>
    [HttpGet("search")]
    public Task<SearchResultDto> Search([FromQuery, Required, StringLength(100)] string q, CancellationToken ct) => orders.SearchAsync(q, ct);

    [HttpGet("{id:guid}")]
    public Task<OrderDetailDto> Get(Guid id, CancellationToken ct) => orders.GetAsync(id, ct);

    [HttpPost]
    public Task<OrderDetailDto> Create(CreateOrderRequest request, CancellationToken ct) => orders.CreateAsync(request, ct);

    [HttpPost("{id:guid}/cancel")]
    public Task<OrderDetailDto> Cancel(Guid id, CancelOrderRequest request, CancellationToken ct) => orders.CancelAsync(id, request, ct);

    /// <summary>Cancels one test of the order, with a reason. Same permission as cancelling the order.</summary>
    [HttpPost("{id:guid}/items/{itemId:guid}/cancel")]
    public Task<OrderDetailDto> CancelItem(Guid id, Guid itemId, CancelItemRequest request, CancellationToken ct) =>
        orders.CancelItemAsync(id, itemId, request, ct);

    // Containers and their labels.

    [HttpPost("{id:guid}/containers")]
    public Task<OrderDetailDto> AddContainer(Guid id, AddContainerRequest request, CancellationToken ct) => orders.AddContainerAsync(id, request, ct);

    [HttpPut("{id:guid}/containers/{containerId:guid}")]
    public Task<OrderDetailDto> UpdateContainer(Guid id, Guid containerId, UpdateContainerRequest request, CancellationToken ct) =>
        orders.UpdateContainerAsync(id, containerId, request, ct);

    [HttpDelete("{id:guid}/containers/{containerId:guid}")]
    public Task<OrderDetailDto> RemoveContainer(Guid id, Guid containerId, CancellationToken ct) => orders.RemoveContainerAsync(id, containerId, ct);
}

[ApiController]
[Route("api/checkin")]
[Authorize(Policy = Permissions.CheckIn)]
public class CheckInController(IOrderService orders) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<OrderSummaryDto>> List(
        [FromQuery] CheckInTab tab,
        [FromQuery, StringLength(100)] string? search,
        [FromQuery] Guid? referrerId,
        [FromQuery] Guid? departmentId,
        [FromQuery] Guid? testId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        orders.CheckInAsync(tab, new OrderFilter(search, null, referrerId, departmentId, testId, from, to), new PageRequest(page, pageSize), ct);

    [HttpPost("{id:guid}/collect")]
    public Task<OrderDetailDto> Collect(Guid id, ContainerIdsRequest request, CancellationToken ct) => orders.CollectAsync(id, request, ct);

    [HttpPost("{id:guid}/receive")]
    public Task<OrderDetailDto> Receive(Guid id, ReceiveRequest request, CancellationToken ct) => orders.ReceiveAsync(id, request, ct);

    [HttpPost("receive")]
    public async Task<object> BulkReceive(BulkReceiveRequest request, CancellationToken ct) => new { received = await orders.BulkReceiveAsync(request, ct) };

    [HttpPost("{id:guid}/reject")]
    public Task<OrderDetailDto> Reject(Guid id, RejectRequest request, CancellationToken ct) => orders.RejectAsync(id, request, ct);

    [HttpPost("{id:guid}/containers/{containerId:guid}/recollect")]
    public Task<OrderDetailDto> Recollect(Guid id, Guid containerId, CancellationToken ct) => orders.RecollectAsync(id, containerId, ct);
}

[ApiController]
[Route("api/results")]
[Authorize(Policy = Policies.ResultsAny)]
public class ResultsController(IResultService results) : ControllerBase
{
    [HttpGet("kpi")]
    public Task<ResultsKpiDto> Kpi(CancellationToken ct) => results.KpiAsync(ct);

    [HttpGet]
    public Task<PagedResult<WorklistRowDto>> Worklist(
        [FromQuery] WorklistStage stage,
        [FromQuery, StringLength(100)] string? search,
        [FromQuery] Guid? referrerId,
        [FromQuery] Guid? departmentId,
        [FromQuery] Guid? testId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        results.WorklistAsync(stage, new OrderFilter(search, null, referrerId, departmentId, testId, from, to), new PageRequest(page, pageSize), ct);

    [HttpPost("{orderId:guid}")]
    [Authorize(Policy = Permissions.ResultsEnter)]
    public Task<ResultActionResponse> Save(Guid orderId, SaveResultsRequest request, CancellationToken ct) => results.SaveAsync(orderId, request, ct);

    [HttpPost("{orderId:guid}/verify")]
    [Authorize(Policy = Permissions.ResultsVerify)]
    public Task<ResultActionResponse> Verify(Guid orderId, ResultActionRequest request, CancellationToken ct) => results.VerifyAsync(orderId, request, ct);

    [HttpPost("{orderId:guid}/approve")]
    [Authorize(Policy = Permissions.ResultsApprove)]
    public Task<ResultActionResponse> Approve(Guid orderId, ResultActionRequest request, CancellationToken ct) => results.ApproveAsync(orderId, request, ct);

    [HttpPost("{orderId:guid}/reopen")]
    [Authorize(Policy = Permissions.ResultsApprove)]
    public Task<ResultActionResponse> Reopen(Guid orderId, ReopenRequest request, CancellationToken ct) => results.ReopenAsync(orderId, request, ct);

    [HttpGet("{orderId:guid}/items/{itemId:guid}/history")]
    public Task<List<ResultEventDto>> History(Guid orderId, Guid itemId, CancellationToken ct) => results.HistoryAsync(orderId, itemId, ct);

    /// <summary>The patient's earlier approved results for this order's tests (results policy, like the rest of this controller).</summary>
    [HttpGet("{orderId:guid}/previous")]
    public Task<List<PreviousResultDto>> Previous(Guid orderId, CancellationToken ct) => results.PreviousAsync(orderId, ct);
}

[ApiController]
[Route("api/billing")]
[Authorize(Policy = Permissions.Billing)]
public class BillingController(IBillingService billing) : ControllerBase
{
    [HttpGet("kpi")]
    public Task<BillingKpiDto> Kpi(CancellationToken ct) => billing.KpiAsync(ct);

    [HttpGet("invoices")]
    public Task<PagedResult<InvoiceDto>> List(
        [FromQuery, StringLength(100)] string? search,
        [FromQuery] InvoiceStatus? status,
        [FromQuery] Guid? referrerId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default) =>
        billing.PageAsync(new InvoiceFilter(search, status, referrerId, from, to), new PageRequest(page, pageSize), ct);

    [HttpGet("invoices/{id:guid}")]
    public Task<InvoiceDetailDto> Get(Guid id, CancellationToken ct) => billing.GetAsync(id, ct);

    [HttpPost("invoices/{id:guid}/pay")]
    public Task<InvoiceDto> Pay(Guid id, PayRequest request, CancellationToken ct) => billing.PayAsync(id, request, ct);

    [HttpGet("ar-summary")]
    public Task<ArSummaryDto> ArSummary([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct) =>
        billing.ArSummaryAsync(new DateRange(from, to), ct);
}
