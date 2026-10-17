using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Application.Repositories;
using HsmLis.Domain;
using HsmLis.Domain.Entities;

namespace HsmLis.Application.Services;

public interface IPatientService
{
    Task<PagedResult<PatientDto>> PageAsync(string? search, PageRequest page, CancellationToken ct = default);
    Task<List<PatientDto>> RecentAsync(CancellationToken ct = default);
    Task<PatientDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<List<PatientDto>> SimilarAsync(string? citizenId, string firstName, string lastName, Guid? exceptId, CancellationToken ct = default);
    Task<PatientDto> CreateAsync(PatientRequest request, CancellationToken ct = default);
    Task<PatientDto> UpdateAsync(Guid id, PatientRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<List<OrderSummaryDto>> OrdersAsync(Guid id, CancellationToken ct = default);
}

public class PatientService(
    IPatientRepository patients,
    ILabOrderRepository orders,
    ISequenceRepository sequences,
    IUnitOfWork unitOfWork,
    IOrgContextProvider context,
    IAuditTrail audit) : IPatientService
{
    public async Task<PagedResult<PatientDto>> PageAsync(string? search, PageRequest page, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var (items, total) = await patients.PageAsync(search, page, ct);
        return new PagedResult<PatientDto>(items.Select(p => p.ToDto(ctx.Today)).ToList(), total, page.Page, page.PageSize);
    }

    public async Task<List<PatientDto>> RecentAsync(CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        return (await patients.RecentAsync(8, ct)).Select(p => p.ToDto(ctx.Today)).ToList();
    }

    public async Task<PatientDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        return (await Find(id, ct)).ToDto(ctx.Today);
    }

    public async Task<List<PatientDto>> SimilarAsync(string? citizenId, string firstName, string lastName, Guid? exceptId, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        return (await patients.FindSimilarAsync(Text.Clean(citizenId), firstName.Trim(), lastName.Trim(), exceptId, ct))
            .Select(p => p.ToDto(ctx.Today))
            .ToList();
    }

    public async Task<PatientDto> CreateAsync(PatientRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        await EnsureCitizenIdFreeAsync(request.CitizenId, null, ct);
        Validate(request, ctx.Today);

        return await unitOfWork.InTransactionAsync(async () =>
        {
            var seq = await sequences.NextAsync(ctx.Org.Id, Numbering.HnKey(ctx.Today), ct);
            var patient = new Patient
            {
                Id = Guid.NewGuid(),
                OrganizationId = ctx.Org.Id,
                Hn = Numbering.Hn(ctx.Today, seq),
                CreatedAt = ctx.Now,
            };
            Apply(patient, request, ctx.Now);
            patients.Add(patient);
            audit.Write(ctx, "patient.create", "patient", patient.Id.ToString(), patient.Hn);
            await unitOfWork.SaveChangesAsync(ct);
            return patient.ToDto(ctx.Today);
        }, ct);
    }

    public async Task<PatientDto> UpdateAsync(Guid id, PatientRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var patient = await Find(id, ct);
        await EnsureCitizenIdFreeAsync(request.CitizenId, id, ct);
        Validate(request, ctx.Today);
        Apply(patient, request, ctx.Now);
        audit.Write(ctx, "patient.update", "patient", patient.Id.ToString(), patient.Hn);
        await unitOfWork.SaveChangesAsync(ct);
        return patient.ToDto(ctx.Today);
    }

    /// <summary>Hides the patient; the records that point at them stay intact.</summary>
    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var patient = await Find(id, ct);
        if (await patients.HasOpenOrdersAsync(id, ct))
            throw new ConflictException("patient_has_open_orders", "The patient still has orders in progress.");
        patient.DeletedAt = ctx.Now;
        audit.Write(ctx, "patient.delete", "patient", patient.Id.ToString(), patient.Hn);
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<List<OrderSummaryDto>> OrdersAsync(Guid id, CancellationToken ct = default)
    {
        await Find(id, ct);
        return await orders.ForPatientAsync(id, ct);
    }

    private async Task<Patient> Find(Guid id, CancellationToken ct) =>
        await patients.GetAsync(id, ct) ?? throw new NotFoundException("patient_not_found", "Patient not found.");

    private async Task EnsureCitizenIdFreeAsync(string? citizenId, Guid? exceptId, CancellationToken ct)
    {
        if (Text.Clean(citizenId) is { } id && await patients.CitizenIdExistsAsync(id, exceptId, ct))
            throw new ConflictException("citizen_id_taken", "Another patient already has this citizen ID.");
    }

    private static void Validate(PatientRequest r, DateOnly today)
    {
        if (r.BirthDate > today)
            throw new BusinessRuleException("birth_date_future", "The date of birth is in the future.");
        if (Text.Clean(r.CitizenId) is { } id && !ThaiCitizenId.IsValid(id))
            throw new BusinessRuleException("citizen_id_invalid", "The citizen ID's check digit is wrong.");
    }

    private static void Apply(Patient p, PatientRequest r, DateTime now)
    {
        p.Prefix = Text.Clean(r.Prefix);
        p.FirstNameTh = r.FirstNameTh.Trim();
        p.LastNameTh = r.LastNameTh.Trim();
        p.FirstNameEn = Text.Clean(r.FirstNameEn);
        p.LastNameEn = Text.Clean(r.LastNameEn);
        p.CitizenId = Text.Clean(r.CitizenId);
        p.Sex = r.Sex;
        p.BirthDate = r.BirthDate;
        p.BloodGroup = Text.Clean(r.BloodGroup);
        p.Nationality = Text.Clean(r.Nationality);
        p.Phone = Text.Clean(r.Phone);
        p.Email = Text.Clean(r.Email)?.ToLowerInvariant();
        p.LineId = Text.Clean(r.LineId);
        p.Address = Text.Clean(r.Address);
        p.Province = Text.Clean(r.Province);
        p.PostCode = Text.Clean(r.PostCode);
        p.EmergencyName = Text.Clean(r.EmergencyName);
        p.EmergencyPhone = Text.Clean(r.EmergencyPhone);
        p.EmergencyRelation = Text.Clean(r.EmergencyRelation);
        p.Allergies = Text.Clean(r.Allergies);
        p.Conditions = Text.Clean(r.Conditions);
        p.Medications = Text.Clean(r.Medications);
        p.UpdatedAt = now;
    }
}
