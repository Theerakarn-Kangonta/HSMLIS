using HsmLis.Application.Common;
using HsmLis.Domain;
using HsmLis.Domain.Entities;
using HsmLis.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HsmLis.Infrastructure.Seeding;

/// <summary>
/// Fills an empty database with the first organization, its administrator (from configuration)
/// and the starting test catalog.
/// </summary>
public class DatabaseSeeder(AppDbContext db, IPasswordHasher hasher, TimeProvider clock, ILogger<DatabaseSeeder> logger)
{
    /// <summary>Creates the organization and its first administrator when the database has none.</summary>
    public async Task BootstrapAsync(string organizationName, string adminUsername, string adminPassword, CancellationToken ct = default)
    {
        if (await db.Organizations.AnyAsync(ct)) return;
        if (PasswordPolicy.Check(adminPassword) is { } problem)
            throw new InvalidOperationException($"Bootstrap:AdminPassword is not strong enough ({problem}).");

        var now = clock.GetUtcNow().UtcDateTime;
        var org = NewOrganization(organizationName, now);
        db.Organizations.Add(org);
        db.Users.Add(NewUser(org, adminUsername.Trim().ToLowerInvariant(), adminPassword, "ผู้ดูแล", "ระบบ", UserRole.SuperAdmin, null, now));
        AddCatalogBasics(org);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Created organization {Name} with administrator {User}", organizationName, adminUsername);
    }

    // ---------- organization and catalog ----------

    private static Organization NewOrganization(string name, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        Code = "LAB01",
        NameTh = name.Trim(),
        TimeZone = "Asia/Bangkok",
        OrderPrefix = "CENTER",
        AutoLogoutMinutes = 20,
        CreatedAt = now,
    };

    private User NewUser(Organization org, string username, string password, string first, string last, UserRole role, Guid? branchId, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = org.Id,
        Username = username,
        PasswordHash = hasher.Hash(password),
        FirstNameTh = first,
        LastNameTh = last,
        Role = role,
        BranchId = branchId,
        IsActive = true,
        CreatedAt = now,
    };

    private static ReferenceRange Range(decimal? low, decimal? high, decimal? critLow = null, decimal? critHigh = null, Sex? sex = null) =>
        new() { Low = low, High = high, CriticalLow = critLow, CriticalHigh = critHigh, Sex = sex };

    private static ReferenceRange Normal(string text) => new() { NormalText = text };

    /// <summary>The departments, specimen types, tests and packages of a disease-control laboratory.</summary>
    private void AddCatalogBasics(Organization org)
    {
        Department Dep(string code, string en, string th, string color) =>
            new() { Id = Guid.NewGuid(), OrganizationId = org.Id, Code = code, NameEn = en, NameTh = th, Color = color, IsActive = true };
        var flow = Dep("001", "Flow Cytometry", "โฟลไซโตเมทรี", "#0ea5e9");
        var molecular = Dep("002", "Molecular", "อณูชีววิทยา", "#8b5cf6");
        var micro = Dep("004", "Microbiology", "จุลชีววิทยา", "#f59e0b");
        var immuno = Dep("005", "Immunology", "ภูมิคุ้มกันวิทยา", "#10b981");
        var chem = Dep("006", "Chemistry", "เคมีคลินิก", "#3b82f6");
        var hema = Dep("007", "Hematology", "โลหิตวิทยา", "#ef4444");
        var aids = Dep("A01", "Aids", "งานเอดส์", "#ec4899");
        var tb = Dep("A02", "TB", "งานวัณโรค", "#f97316");
        var vbd = Dep("A03", "VBD", "โรคติดต่อนำโดยแมลง", "#65a30d");
        db.Departments.AddRange(flow, molecular, micro, immuno, chem, hema, aids, tb, vbd);

        SpecimenType Spec(string code, string en, string th, string container, string? requirement, string? keep) => new()
        {
            Id = Guid.NewGuid(), OrganizationId = org.Id, Code = code, NameEn = en, NameTh = th, ContainerType = container,
            CollectionRequirements = requirement, Preservation = keep, IsActive = true,
        };
        var edta = Spec("01", "Blood (EDTA)", "เลือด EDTA", "Lavender top", "3 mL", "2-8 °C");
        var serum = Spec("02", "Serum", "ซีรัม", "Red top", "5 mL clotted blood", "2-8 °C");
        var ppt = Spec("03", "Plasma (PPT)", "พลาสมา PPT", "White top PPT", "5 mL", "2-8 °C, ปั่นแยกภายใน 6 ชม.");
        var naf = Spec("05", "Blood (NaF)", "เลือด NaF", "Gray top", "2 mL, งดอาหาร 8 ชม.", "2-8 °C");
        var urine = Spec("06", "Urine", "ปัสสาวะ", "Sterile cup", "Midstream 10 mL", "2-8 °C ภายใน 24 ชม.");
        var sputum = Spec("TB_01", "Sputum", "เสมหะ", "Sputum cup", "> 2 mL, เก็บตอนเช้า", "2-8 °C");
        db.SpecimenTypes.AddRange(edta, serum, ppt, naf, urine, sputum);

        var sort = 0;
        LabTest Test(string code, Department dep, string en, string? th, SpecimenType spec, string? unit, decimal price, ResultType type,
            string[]? options = null, ReferenceRange[]? ranges = null, int decimals = 1, int tat = 24, bool alert = false) => new()
        {
            Id = Guid.NewGuid(), OrganizationId = org.Id, Code = code, DepartmentId = dep.Id, NameEn = en, NameTh = th,
            SpecimenTypeId = spec.Id, Unit = unit, Price = price, ResultType = type, Options = [.. options ?? []],
            ReferenceRanges = [.. ranges ?? []], Decimals = decimals, TatTargetHours = tat, AlertOnPositive = alert,
            IsActive = true, SortOrder = sort++,
        };
        string[] reactive = ["Non Reactive", "Reactive", "Inconclusive"];
        string[] posNeg = ["Negative", "Positive"];
        var tests = new List<LabTest>
        {
            Test("WBC", hema, "White blood cell count", "เม็ดเลือดขาว", edta, "x10^3/uL", 60, ResultType.Numeric, ranges: [Range(4.0m, 10.0m, 2.0m, 30.0m)]),
            Test("HGB", hema, "Hemoglobin", "ฮีโมโกลบิน", edta, "g/dL", 40, ResultType.Numeric, ranges: [Range(13.0m, 17.0m, 7.0m, 20.0m, Sex.Male), Range(12.0m, 15.0m, 7.0m, 20.0m, Sex.Female)]),
            Test("HCT", hema, "Hematocrit", "ฮีมาโทคริต", edta, "%", 40, ResultType.Numeric, ranges: [Range(40m, 50m, 20m, 60m, Sex.Male), Range(36m, 45m, 20m, 60m, Sex.Female)]),
            Test("PLT", hema, "Platelet count", "เกล็ดเลือด", edta, "x10^3/uL", 50, ResultType.Numeric, ranges: [Range(150m, 450m, 50m, 1000m)], decimals: 0),
            Test("GLU", chem, "Glucose (FBS)", "น้ำตาลในเลือด", naf, "mg/dL", 40, ResultType.Numeric, ranges: [Range(70m, 100m, 40m, 450m)], decimals: 0, tat: 4),
            Test("BUN", chem, "Blood urea nitrogen", null, serum, "mg/dL", 50, ResultType.Numeric, ranges: [Range(7m, 20m)], decimals: 0),
            Test("CREA", chem, "Creatinine", "ครีเอตินิน", serum, "mg/dL", 50, ResultType.Numeric, ranges: [Range(0.7m, 1.3m, null, 10m, Sex.Male), Range(0.6m, 1.1m, null, 10m, Sex.Female)], decimals: 2),
            Test("CHOL", chem, "Cholesterol", "คอเลสเตอรอล", serum, "mg/dL", 60, ResultType.Numeric, ranges: [Range(null, 200m)], decimals: 0),
            Test("TG", chem, "Triglyceride", "ไตรกลีเซอไรด์", serum, "mg/dL", 60, ResultType.Numeric, ranges: [Range(null, 150m)], decimals: 0),
            Test("AST", chem, "AST (SGOT)", null, serum, "U/L", 60, ResultType.Numeric, ranges: [Range(0m, 40m)], decimals: 0),
            Test("ALT", chem, "ALT (SGPT)", null, serum, "U/L", 60, ResultType.Numeric, ranges: [Range(0m, 41m)], decimals: 0),
            Test("K", chem, "Potassium", "โพแทสเซียม", serum, "mmol/L", 60, ResultType.Numeric, ranges: [Range(3.5m, 5.1m, 2.8m, 6.2m)], tat: 4),
            Test("HBSAG", immuno, "HBsAg", null, serum, null, 120, ResultType.PosNeg, posNeg, [Normal("Negative")]),
            Test("AHCV", immuno, "Anti-HCV", null, serum, null, 200, ResultType.PosNeg, posNeg, [Normal("Negative")], alert: true),
            Test("VDRL", immuno, "VDRL", null, serum, null, 80, ResultType.Choice, reactive, [Normal("Non Reactive")], alert: true),
            Test("AHIV", aids, "Anti-HIV", "ตรวจหาภูมิคุ้มกันต่อเชื้อเอชไอวี", serum, null, 150, ResultType.Choice, reactive, [Normal("Non Reactive")], alert: true),
            Test("CD4", flow, "CD4 count", null, edta, "cells/uL", 400, ResultType.Numeric, ranges: [Range(500m, 1500m, 200m, null)], decimals: 0, tat: 72),
            Test("HIVVL", molecular, "HIV viral load", null, ppt, "copies/mL", 1500, ResultType.NumericText, ["Not detected", "<20"], [Range(null, 20m)], decimals: 0, tat: 168),
            Test("AFB", tb, "AFB smear", "ย้อมเชื้อวัณโรค", sputum, null, 60, ResultType.Choice, ["Negative", "1-9 AFB", "1+", "2+", "3+"], [Normal("Negative")], alert: true),
            Test("XPERT", tb, "Xpert MTB/RIF", null, sputum, null, 1200, ResultType.Choice,
                ["MTB not detected", "MTB detected, RIF resistance not detected", "MTB detected, RIF resistance detected", "Invalid"], [Normal("MTB not detected")], tat: 48, alert: true),
            Test("TBCUL", micro, "TB culture", "เพาะเชื้อวัณโรค", sputum, null, 600, ResultType.Choice, ["No growth", "MTB complex growth", "NTM growth", "Contaminated"], [Normal("No growth")], tat: 24 * 56),
            Test("UCUL", micro, "Urine culture", "เพาะเชื้อปัสสาวะ", urine, null, 250, ResultType.Text, ranges: [Normal("No growth")], tat: 72),
            Test("NS1", vbd, "Dengue NS1 antigen", null, serum, null, 350, ResultType.PosNeg, posNeg, [Normal("Negative")], tat: 4, alert: true),
            Test("DIGM", vbd, "Dengue IgM", null, serum, null, 300, ResultType.PosNeg, posNeg, [Normal("Negative")], alert: true),
            Test("MAL", vbd, "Malaria thick/thin film", "ตรวจหาเชื้อมาลาเรีย", edta, null, 100, ResultType.Choice,
                ["Not found", "P. falciparum", "P. vivax", "Mixed infection"], [Normal("Not found")], tat: 4, alert: true),
        };
        db.LabTests.AddRange(tests);

        var byCode = tests.ToDictionary(t => t.Code);
        TestPackage Package(string code, string th, string en, string[] codes, DiscountType type, decimal discount) => new()
        {
            Id = Guid.NewGuid(), OrganizationId = org.Id, Code = code, NameTh = th, NameEn = en,
            TestIds = codes.Select(c => byCode[c].Id).ToList(), DiscountType = type, DiscountValue = discount, IsActive = true,
        };
        var packages = new List<TestPackage>
        {
            Package("CBC", "ความสมบูรณ์ของเม็ดเลือด", "Complete blood count", ["WBC", "HGB", "HCT", "PLT"], DiscountType.Amount, 40),
            Package("HEPATITIS", "ชุดตรวจคัดกรองโรคตับอักเสบ", "Hepatitis screening", ["HBSAG", "AHCV"], DiscountType.Percent, 20),
            Package("STI001", "ชุดตรวจคัดกรองโรคติดต่อทางเพศสัมพันธ์", "STI screening", ["AHIV", "VDRL", "HBSAG"], DiscountType.Amount, 50),
            Package("TB_NEW", "วัณโรครายใหม่", "TB new case", ["AFB", "XPERT", "TBCUL"], DiscountType.Percent, 10),
            Package("CHECKUP", "ตรวจสุขภาพประจำปี", "Annual check-up", ["WBC", "HGB", "HCT", "PLT", "GLU", "CHOL", "TG", "CREA", "AST", "ALT"], DiscountType.Percent, 15),
            Package("DENGUE", "ชุดตรวจไข้เลือดออก", "Dengue panel", ["NS1", "DIGM", "HCT", "PLT", "WBC"], DiscountType.Amount, 100),
        };
        db.TestPackages.AddRange(packages);
    }
}
