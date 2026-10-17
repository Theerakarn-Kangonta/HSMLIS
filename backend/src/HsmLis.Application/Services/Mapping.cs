using HsmLis.Application.Dtos;
using HsmLis.Domain;
using HsmLis.Domain.Entities;

namespace HsmLis.Application.Services;

/// <summary>Entity → DTO conversions shared by the services.</summary>
public static class Map
{
    public static UserDto ToDto(this User u) => new(
        u.Id, u.Username, u.FirstNameTh, u.LastNameTh, u.FirstNameEn, u.LastNameEn, u.FullName, u.Position,
        u.Email, u.Phone, u.EmployeeCode, u.BranchId, u.Role, u.DepartmentIds, u.IsActive, u.CreatedAt);

    public static OrganizationDto ToDto(this Organization o) => new(
        o.Id, o.Code, o.NameTh, o.NameEn, o.Email, o.Phone, o.TaxId, o.Address, o.TimeZone, o.OrderPrefix, o.AutoLogoutMinutes);

    public static BranchDto ToDto(this Branch b) => new(b.Id, b.Code, b.NameTh, b.NameEn, b.Address, b.Phone, b.Email, b.TaxId, b.IsActive);

    public static DepartmentDto ToDto(this Department d) => new(d.Id, d.Code, d.NameEn, d.NameTh, d.Color, d.Description, d.IsActive);

    public static SpecimenTypeDto ToDto(this SpecimenType s) =>
        new(s.Id, s.Code, s.NameEn, s.NameTh, s.ContainerType, s.CollectionRequirements, s.Preservation, s.IsActive);

    public static ReferrerDto ToDto(this ReferringOrganization r) => new(r.Id, r.Code, r.Name, r.Type, r.Address, r.Contact, r.Phone, r.IsActive);

    public static ReferenceRangeDto ToDto(this ReferenceRange r) =>
        new(r.Sex, r.AgeMinYears, r.AgeMaxYears, r.Low, r.High, r.CriticalLow, r.CriticalHigh, r.NormalText);

    public static ReferenceRange ToEntity(this ReferenceRangeDto r) => new()
    {
        Sex = r.Sex,
        AgeMinYears = r.AgeMinYears,
        AgeMaxYears = r.AgeMaxYears,
        Low = r.Low,
        High = r.High,
        CriticalLow = r.CriticalLow,
        CriticalHigh = r.CriticalHigh,
        NormalText = Text.Clean(r.NormalText),
    };

    public static LabTestDto ToDto(this LabTest t, IReadOnlyDictionary<Guid, Department> departments, IReadOnlyDictionary<Guid, SpecimenType> specimens)
    {
        var department = departments.GetValueOrDefault(t.DepartmentId);
        var specimen = specimens.GetValueOrDefault(t.SpecimenTypeId);
        return new LabTestDto(
            t.Id, t.Code, t.DepartmentId, department?.NameEn ?? "", department?.Color ?? "#64748b", t.NameEn, t.NameTh,
            t.SpecimenTypeId, specimen?.NameEn ?? "", t.Unit, t.Price, t.ResultType, t.Options, t.Decimals,
            t.TatTargetHours, t.RepeatBlockDays, t.AlertOnPositive, t.ReferenceRanges.Select(r => r.ToDto()).ToList(),
            t.IsActive, t.SortOrder);
    }

    public static PackageDto ToDto(this TestPackage p, IReadOnlyDictionary<Guid, LabTest> tests)
    {
        var listPrice = p.TestIds.Sum(id => tests.GetValueOrDefault(id)?.Price ?? 0);
        return new PackageDto(
            p.Id, p.Code, p.NameTh, p.NameEn, p.Description, p.TestIds, listPrice, p.DiscountType, p.DiscountValue,
            OrderRules.PackagePrice(listPrice, p.DiscountType, p.DiscountValue), p.IsActive);
    }

    public static PatientDto ToDto(this Patient p, DateOnly today) => new(
        p.Id, p.Hn, p.Prefix, p.FirstNameTh, p.LastNameTh, p.FirstNameEn, p.LastNameEn, p.FullNameTh, p.CitizenId, p.Sex,
        p.BirthDate, ResultRules.AgeInYears(p.BirthDate, today), p.BloodGroup, p.Nationality, p.Phone, p.Email, p.LineId,
        p.Address, p.Province, p.PostCode, p.EmergencyName, p.EmergencyPhone, p.EmergencyRelation, p.Allergies,
        p.Conditions, p.Medications, p.CreatedAt);

    public static OrderItemDto ToDto(this OrderItem i, IReadOnlyDictionary<Guid, Department> departments)
    {
        var department = departments.GetValueOrDefault(i.DepartmentId);
        return new OrderItemDto(
            i.Id, i.LabTestId, i.PackageId, i.PackageCode, i.TestCode, i.TestNameEn, i.TestNameTh, i.DepartmentId,
            department?.NameEn ?? "", department?.Color ?? "#64748b", i.SpecimenTypeId, i.ContainerId, i.ResultType, i.Options,
            i.Decimals, i.Unit, i.Price, i.TatTargetHours, i.ResultStatus, i.Value, i.Flag, i.RefLow, i.RefHigh, i.CriticalLow,
            i.CriticalHigh, i.RefText, i.Comment, i.EnteredAt, i.EnteredByName, i.VerifiedAt, i.VerifiedByName, i.ApprovedAt,
            i.ApprovedByName);
    }

    public static ContainerDto ToDto(this SpecimenContainer c, IEnumerable<OrderItem> items) => new(
        c.Id, c.Lsn, c.SpecimenTypeId, c.SpecimenName, c.ContainerType, c.LabelCount, c.Status, c.CollectedAt, c.CollectedByName,
        c.ReceivedAt, c.ReceivedByName, c.Volume, c.Condition, c.Comment, c.RejectedAt, c.RejectedByName, c.RejectReason,
        items.Where(i => i.ContainerId == c.Id).OrderBy(i => i.SortOrder).Select(i => i.TestCode).ToList());

    public static OrderDetailDto ToDetail(this LabOrder o, IReadOnlyDictionary<Guid, Department> departments, DateOnly today, Invoice? invoice)
    {
        var items = o.Items.OrderBy(i => i.SortOrder).ToList();
        return new OrderDetailDto(
            o.Id, o.OrderNo, o.Status, o.Urgent, o.Patient!.ToDto(today), o.Referrer?.ToDto(), o.ReferrerRef, o.Entitlement,
            o.Diagnosis, o.Note, o.BpSystolic, o.BpDiastolic, o.HeartRate, o.TemperatureC, o.WeightKg, o.HeightCm,
            ResultRules.Bmi(o.WeightKg, o.HeightCm), o.Subtotal, o.Discount, o.Total, o.OrderedAt, o.OrderedByName,
            o.CollectedAt, o.ReceivedAt, o.CompletedAt, o.CancelledAt, o.CancelReason, o.Version,
            items.Select(i => i.ToDto(departments)).ToList(),
            o.Containers.OrderBy(c => c.Lsn, StringComparer.Ordinal).Select(c => c.ToDto(items)).ToList(),
            invoice is null ? null : new InvoiceSummaryDto(invoice.Id, invoice.InvoiceNo, invoice.Amount, invoice.Paid, invoice.Status));
    }

    public static InvoiceDto ToDto(this Invoice inv, DateOnly today, Func<DateTime, DateOnly> localDay) => new(
        inv.Id, inv.InvoiceNo, inv.LabOrderId, inv.LabOrder?.OrderNo ?? "", inv.PatientId, inv.Patient?.Hn ?? "",
        inv.Patient?.FullNameTh ?? "", inv.IssuedAt, inv.Amount, inv.Paid, inv.Amount - inv.Paid, inv.Status, inv.Version,
        Math.Max(0, today.DayNumber - localDay(inv.IssuedAt).DayNumber),
        inv.Payments.OrderBy(p => p.PaidAt).Select(p => new PaymentDto(p.Id, p.Amount, p.Method, p.Note, p.PaidAt, p.ReceivedByName)).ToList());

    public static AuditLogDto ToDto(this AuditLog a) => new(a.Id, a.At, a.UserName, a.Action, a.EntityType, a.EntityId, a.Detail);
}
