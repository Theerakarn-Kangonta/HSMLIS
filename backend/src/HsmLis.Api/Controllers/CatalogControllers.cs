using HsmLis.Application.Dtos;
using HsmLis.Application.Services;
using HsmLis.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HsmLis.Api.Controllers;

// The settings lists. Anyone signed in may read them (ordering and result entry need them);
// changing the test catalog needs settings.lab, and branches need settings.admin.

[ApiController]
[Route("api/departments")]
public class DepartmentsController(ICatalogService<DepartmentDto, DepartmentRequest> service) : ControllerBase
{
    [HttpGet]
    public Task<List<DepartmentDto>> List(CancellationToken ct) => service.ListAsync(ct);

    [HttpPost, Authorize(Policy = Permissions.SettingsLab)]
    public Task<DepartmentDto> Create(DepartmentRequest request, CancellationToken ct) => service.CreateAsync(request, ct);

    [HttpPut("{id:guid}"), Authorize(Policy = Permissions.SettingsLab)]
    public Task<DepartmentDto> Update(Guid id, DepartmentRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}"), Authorize(Policy = Permissions.SettingsLab)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/specimen-types")]
public class SpecimenTypesController(ICatalogService<SpecimenTypeDto, SpecimenTypeRequest> service) : ControllerBase
{
    [HttpGet]
    public Task<List<SpecimenTypeDto>> List(CancellationToken ct) => service.ListAsync(ct);

    [HttpPost, Authorize(Policy = Permissions.SettingsLab)]
    public Task<SpecimenTypeDto> Create(SpecimenTypeRequest request, CancellationToken ct) => service.CreateAsync(request, ct);

    [HttpPut("{id:guid}"), Authorize(Policy = Permissions.SettingsLab)]
    public Task<SpecimenTypeDto> Update(Guid id, SpecimenTypeRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}"), Authorize(Policy = Permissions.SettingsLab)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/lab-tests")]
public class LabTestsController(ICatalogService<LabTestDto, LabTestRequest> service) : ControllerBase
{
    [HttpGet]
    public Task<List<LabTestDto>> List(CancellationToken ct) => service.ListAsync(ct);

    [HttpPost, Authorize(Policy = Permissions.SettingsLab)]
    public Task<LabTestDto> Create(LabTestRequest request, CancellationToken ct) => service.CreateAsync(request, ct);

    [HttpPut("{id:guid}"), Authorize(Policy = Permissions.SettingsLab)]
    public Task<LabTestDto> Update(Guid id, LabTestRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}"), Authorize(Policy = Permissions.SettingsLab)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/packages")]
public class PackagesController(ICatalogService<PackageDto, PackageRequest> service) : ControllerBase
{
    [HttpGet]
    public Task<List<PackageDto>> List(CancellationToken ct) => service.ListAsync(ct);

    [HttpPost, Authorize(Policy = Permissions.SettingsLab)]
    public Task<PackageDto> Create(PackageRequest request, CancellationToken ct) => service.CreateAsync(request, ct);

    [HttpPut("{id:guid}"), Authorize(Policy = Permissions.SettingsLab)]
    public Task<PackageDto> Update(Guid id, PackageRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}"), Authorize(Policy = Permissions.SettingsLab)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/referrers")]
public class ReferrersController(ICatalogService<ReferrerDto, ReferrerRequest> service) : ControllerBase
{
    [HttpGet]
    public Task<List<ReferrerDto>> List(CancellationToken ct) => service.ListAsync(ct);

    [HttpPost, Authorize(Policy = Permissions.SettingsLab)]
    public Task<ReferrerDto> Create(ReferrerRequest request, CancellationToken ct) => service.CreateAsync(request, ct);

    [HttpPut("{id:guid}"), Authorize(Policy = Permissions.SettingsLab)]
    public Task<ReferrerDto> Update(Guid id, ReferrerRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}"), Authorize(Policy = Permissions.SettingsLab)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/branches")]
public class BranchesController(ICatalogService<BranchDto, BranchRequest> service) : ControllerBase
{
    [HttpGet]
    public Task<List<BranchDto>> List(CancellationToken ct) => service.ListAsync(ct);

    [HttpPost, Authorize(Policy = Permissions.SettingsAdmin)]
    public Task<BranchDto> Create(BranchRequest request, CancellationToken ct) => service.CreateAsync(request, ct);

    [HttpPut("{id:guid}"), Authorize(Policy = Permissions.SettingsAdmin)]
    public Task<BranchDto> Update(Guid id, BranchRequest request, CancellationToken ct) => service.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}"), Authorize(Policy = Permissions.SettingsAdmin)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return NoContent();
    }
}
