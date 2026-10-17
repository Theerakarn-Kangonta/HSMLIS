using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Application.Repositories;
using HsmLis.Domain.Entities;

namespace HsmLis.Application.Services;

/// <summary>List, create, update and delete for a settings list whose rows are identified by a code.</summary>
public interface ICatalogService<TDto, TRequest>
{
    Task<List<TDto>> ListAsync(CancellationToken ct = default);
    Task<TDto> CreateAsync(TRequest request, CancellationToken ct = default);
    Task<TDto> UpdateAsync(Guid id, TRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// The shared rules of every settings list: codes are unique within the organization, a row
/// still referred to cannot be deleted, and every change is written to the audit log.
/// </summary>
public abstract class CatalogService<T, TDto, TRequest>(
    ICatalogRepository<T> repository,
    IUnitOfWork unitOfWork,
    IOrgContextProvider context,
    IAuditTrail audit) : ICatalogService<TDto, TRequest>
    where T : class, IOrgOwned, ICoded, new()
{
    /// <summary>Used in error codes and the audit log, e.g. "department".</summary>
    protected abstract string Kind { get; }
    protected abstract string CodeOf(TRequest request);
    protected abstract void Apply(T entity, TRequest request);
    protected abstract Task<List<TDto>> ToDtosAsync(IReadOnlyList<T> entities, CancellationToken ct);
    protected virtual Task ValidateAsync(TRequest request, CancellationToken ct) => Task.CompletedTask;
    protected virtual Task<bool> InUseAsync(Guid id, CancellationToken ct) => Task.FromResult(false);

    public async Task<List<TDto>> ListAsync(CancellationToken ct = default) =>
        await ToDtosAsync(await repository.ListAsync(ct), ct);

    public async Task<TDto> CreateAsync(TRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var code = CodeOf(request).Trim();
        if (await repository.CodeExistsAsync(code, null, ct))
            throw new ConflictException($"{Kind}_code_taken", "This code is already in use.");
        await ValidateAsync(request, ct);

        var entity = new T { Id = Guid.NewGuid(), OrganizationId = ctx.Org.Id };
        Apply(entity, request);
        entity.Code = code;
        repository.Add(entity);
        audit.Write(ctx, $"{Kind}.create", Kind, entity.Id.ToString(), code);
        await unitOfWork.SaveChangesAsync(ct);
        return (await ToDtosAsync([entity], ct))[0];
    }

    public async Task<TDto> UpdateAsync(Guid id, TRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var entity = await repository.GetAsync(id, ct) ?? throw new NotFoundException($"{Kind}_not_found", "Not found.");
        var code = CodeOf(request).Trim();
        if (await repository.CodeExistsAsync(code, id, ct))
            throw new ConflictException($"{Kind}_code_taken", "This code is already in use.");
        await ValidateAsync(request, ct);

        Apply(entity, request);
        entity.Code = code;
        audit.Write(ctx, $"{Kind}.update", Kind, entity.Id.ToString(), code);
        await unitOfWork.SaveChangesAsync(ct);
        return (await ToDtosAsync([entity], ct))[0];
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var entity = await repository.GetAsync(id, ct) ?? throw new NotFoundException($"{Kind}_not_found", "Not found.");
        if (await InUseAsync(id, ct))
            throw new ConflictException($"{Kind}_in_use", "This is still in use. Switch it off instead of deleting it.");
        repository.Remove(entity);
        audit.Write(ctx, $"{Kind}.delete", Kind, entity.Id.ToString(), entity.Code);
        await unitOfWork.SaveChangesAsync(ct);
    }
}

public class DepartmentService(ICatalogRepository<Department> repository, ICatalogUsage usage, IUnitOfWork unitOfWork, IOrgContextProvider context, IAuditTrail audit)
    : CatalogService<Department, DepartmentDto, DepartmentRequest>(repository, unitOfWork, context, audit)
{
    protected override string Kind => "department";
    protected override string CodeOf(DepartmentRequest r) => r.Code;

    protected override void Apply(Department e, DepartmentRequest r)
    {
        e.NameEn = r.NameEn.Trim();
        e.NameTh = Text.Clean(r.NameTh);
        e.Color = r.Color.ToLowerInvariant();
        e.Description = Text.Clean(r.Description);
        e.IsActive = r.IsActive;
    }

    protected override Task<List<DepartmentDto>> ToDtosAsync(IReadOnlyList<Department> list, CancellationToken ct) =>
        Task.FromResult(list.OrderBy(d => d.Code, StringComparer.Ordinal).Select(d => d.ToDto()).ToList());

    protected override Task<bool> InUseAsync(Guid id, CancellationToken ct) => usage.DepartmentInUseAsync(id, ct);
}

public class SpecimenTypeService(ICatalogRepository<SpecimenType> repository, ICatalogUsage usage, IUnitOfWork unitOfWork, IOrgContextProvider context, IAuditTrail audit)
    : CatalogService<SpecimenType, SpecimenTypeDto, SpecimenTypeRequest>(repository, unitOfWork, context, audit)
{
    protected override string Kind => "specimen";
    protected override string CodeOf(SpecimenTypeRequest r) => r.Code;

    protected override void Apply(SpecimenType e, SpecimenTypeRequest r)
    {
        e.NameEn = r.NameEn.Trim();
        e.NameTh = Text.Clean(r.NameTh);
        e.ContainerType = Text.Clean(r.ContainerType);
        e.CollectionRequirements = Text.Clean(r.CollectionRequirements);
        e.Preservation = Text.Clean(r.Preservation);
        e.IsActive = r.IsActive;
    }

    protected override Task<List<SpecimenTypeDto>> ToDtosAsync(IReadOnlyList<SpecimenType> list, CancellationToken ct) =>
        Task.FromResult(list.OrderBy(s => s.Code, StringComparer.Ordinal).Select(s => s.ToDto()).ToList());

    protected override Task<bool> InUseAsync(Guid id, CancellationToken ct) => usage.SpecimenTypeInUseAsync(id, ct);
}

public class LabTestService(
    ICatalogRepository<LabTest> repository,
    ICatalogRepository<Department> departments,
    ICatalogRepository<SpecimenType> specimens,
    ICatalogUsage usage,
    IUnitOfWork unitOfWork,
    IOrgContextProvider context,
    IAuditTrail audit)
    : CatalogService<LabTest, LabTestDto, LabTestRequest>(repository, unitOfWork, context, audit)
{
    protected override string Kind => "test";
    protected override string CodeOf(LabTestRequest r) => r.Code;

    protected override async Task ValidateAsync(LabTestRequest r, CancellationToken ct)
    {
        if (await departments.GetAsync(r.DepartmentId, ct) is null)
            throw new BusinessRuleException("department_not_found", "The department does not exist.");
        if (await specimens.GetAsync(r.SpecimenTypeId, ct) is null)
            throw new BusinessRuleException("specimen_not_found", "The specimen type does not exist.");
        foreach (var range in r.ReferenceRanges ?? [])
        {
            if (range.Low > range.High || range.CriticalLow > range.CriticalHigh)
                throw new BusinessRuleException("range_invalid", "A reference range has its low limit above its high limit.");
            if (range.AgeMinYears > range.AgeMaxYears)
                throw new BusinessRuleException("range_invalid", "A reference range has its age band the wrong way round.");
        }
        if (r.ResultType is ResultType.Choice or ResultType.MultiChoice && CleanOptions(r.Options).Count == 0)
            throw new BusinessRuleException("options_required", "A choice result needs at least one option.");
    }

    protected override void Apply(LabTest e, LabTestRequest r)
    {
        e.DepartmentId = r.DepartmentId;
        e.NameEn = r.NameEn.Trim();
        e.NameTh = Text.Clean(r.NameTh);
        e.SpecimenTypeId = r.SpecimenTypeId;
        e.Unit = Text.Clean(r.Unit);
        e.Price = r.Price;
        e.ResultType = r.ResultType;
        var options = CleanOptions(r.Options);
        e.Options = options.Count == 0 && r.ResultType == ResultType.PosNeg ? ["Negative", "Positive"] : options;
        e.Decimals = r.Decimals;
        e.TatTargetHours = r.TatTargetHours;
        e.RepeatBlockDays = r.RepeatBlockDays;
        e.AlertOnPositive = r.AlertOnPositive;
        e.ReferenceRanges = (r.ReferenceRanges ?? []).Select(x => x.ToEntity()).ToList();
        e.IsActive = r.IsActive;
        e.SortOrder = r.SortOrder;
    }

    private static List<string> CleanOptions(List<string>? options) =>
        (options ?? []).Select(o => o.Trim()).Where(o => o.Length is > 0 and <= 80).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

    protected override async Task<List<LabTestDto>> ToDtosAsync(IReadOnlyList<LabTest> list, CancellationToken ct)
    {
        var deps = (await departments.ListAsync(ct)).ToDictionary(d => d.Id);
        var specs = (await specimens.ListAsync(ct)).ToDictionary(s => s.Id);
        return list
            .OrderBy(t => deps.GetValueOrDefault(t.DepartmentId)?.Code, StringComparer.Ordinal)
            .ThenBy(t => t.SortOrder)
            .ThenBy(t => t.Code, StringComparer.Ordinal)
            .Select(t => t.ToDto(deps, specs))
            .ToList();
    }

    protected override Task<bool> InUseAsync(Guid id, CancellationToken ct) => usage.LabTestInUseAsync(id, ct);
}

public class PackageService(
    ICatalogRepository<TestPackage> repository,
    ICatalogRepository<LabTest> tests,
    ICatalogUsage usage,
    IUnitOfWork unitOfWork,
    IOrgContextProvider context,
    IAuditTrail audit)
    : CatalogService<TestPackage, PackageDto, PackageRequest>(repository, unitOfWork, context, audit)
{
    protected override string Kind => "package";
    protected override string CodeOf(PackageRequest r) => r.Code;

    protected override async Task ValidateAsync(PackageRequest r, CancellationToken ct)
    {
        var ids = r.TestIds.Distinct().ToList();
        if ((await tests.GetManyAsync(ids, ct)).Count != ids.Count)
            throw new BusinessRuleException("test_not_found", "A chosen test does not exist.");
        if (r.DiscountType == DiscountType.Percent && r.DiscountValue > 100)
            throw new BusinessRuleException("discount_invalid", "A percentage discount cannot be above 100.");
    }

    protected override void Apply(TestPackage e, PackageRequest r)
    {
        e.NameTh = r.NameTh.Trim();
        e.NameEn = Text.Clean(r.NameEn);
        e.Description = Text.Clean(r.Description);
        e.TestIds = r.TestIds.Distinct().ToList();
        e.DiscountType = r.DiscountType;
        e.DiscountValue = r.DiscountValue;
        e.IsActive = r.IsActive;
    }

    protected override async Task<List<PackageDto>> ToDtosAsync(IReadOnlyList<TestPackage> list, CancellationToken ct)
    {
        var byId = (await tests.ListAsync(ct)).ToDictionary(t => t.Id);
        return list.OrderBy(p => p.Code, StringComparer.Ordinal).Select(p => p.ToDto(byId)).ToList();
    }

    protected override Task<bool> InUseAsync(Guid id, CancellationToken ct) => usage.PackageInUseAsync(id, ct);
}

public class ReferrerService(ICatalogRepository<ReferringOrganization> repository, ICatalogUsage usage, IUnitOfWork unitOfWork, IOrgContextProvider context, IAuditTrail audit)
    : CatalogService<ReferringOrganization, ReferrerDto, ReferrerRequest>(repository, unitOfWork, context, audit)
{
    protected override string Kind => "referrer";
    protected override string CodeOf(ReferrerRequest r) => r.Code;

    protected override void Apply(ReferringOrganization e, ReferrerRequest r)
    {
        e.Name = r.Name.Trim();
        e.Type = r.Type;
        e.Address = Text.Clean(r.Address);
        e.Contact = Text.Clean(r.Contact);
        e.Phone = Text.Clean(r.Phone);
        e.IsActive = r.IsActive;
    }

    protected override Task<List<ReferrerDto>> ToDtosAsync(IReadOnlyList<ReferringOrganization> list, CancellationToken ct) =>
        Task.FromResult(list.OrderBy(r => r.Name, StringComparer.CurrentCulture).Select(r => r.ToDto()).ToList());

    protected override Task<bool> InUseAsync(Guid id, CancellationToken ct) => usage.ReferrerInUseAsync(id, ct);
}

public class BranchService(ICatalogRepository<Branch> repository, ICatalogUsage usage, IUnitOfWork unitOfWork, IOrgContextProvider context, IAuditTrail audit)
    : CatalogService<Branch, BranchDto, BranchRequest>(repository, unitOfWork, context, audit)
{
    protected override string Kind => "branch";
    protected override string CodeOf(BranchRequest r) => r.Code;

    protected override void Apply(Branch e, BranchRequest r)
    {
        e.NameTh = r.NameTh.Trim();
        e.NameEn = Text.Clean(r.NameEn);
        e.Address = Text.Clean(r.Address);
        e.Phone = Text.Clean(r.Phone);
        e.Email = Text.Clean(r.Email)?.ToLowerInvariant();
        e.TaxId = Text.Clean(r.TaxId);
        e.IsActive = r.IsActive;
    }

    protected override Task<List<BranchDto>> ToDtosAsync(IReadOnlyList<Branch> list, CancellationToken ct) =>
        Task.FromResult(list.OrderBy(b => b.Code, StringComparer.Ordinal).Select(b => b.ToDto()).ToList());

    protected override Task<bool> InUseAsync(Guid id, CancellationToken ct) => usage.BranchInUseAsync(id, ct);
}

public interface IOrganizationService
{
    Task<OrganizationDto> UpdateAsync(OrganizationRequest request, CancellationToken ct = default);
}

public class OrganizationService(IUnitOfWork unitOfWork, IOrgContextProvider context, IAuditTrail audit) : IOrganizationService
{
    public async Task<OrganizationDto> UpdateAsync(OrganizationRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var org = ctx.Org;
        if (Domain.LabClock.Zone(request.TimeZone) == TimeZoneInfo.Utc && request.TimeZone != "UTC" && request.TimeZone != "Etc/UTC")
            throw new BusinessRuleException("time_zone_invalid", "Unknown time zone.");
        org.Code = request.Code.Trim();
        org.NameTh = request.NameTh.Trim();
        org.NameEn = Text.Clean(request.NameEn);
        org.Email = Text.Clean(request.Email)?.ToLowerInvariant();
        org.Phone = Text.Clean(request.Phone);
        org.TaxId = Text.Clean(request.TaxId);
        org.Address = Text.Clean(request.Address);
        org.TimeZone = request.TimeZone;
        org.OrderPrefix = request.OrderPrefix;
        org.AutoLogoutMinutes = request.AutoLogoutMinutes;
        audit.Write(ctx, "organization.update", "organization", org.Id.ToString());
        await unitOfWork.SaveChangesAsync(ct);
        return org.ToDto();
    }
}
