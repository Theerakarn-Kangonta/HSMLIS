using HsmLis.Domain.Entities;

namespace HsmLis.Domain;

/// <summary>
/// What each role may do. Every API endpoint names one of these; the menu shows only the pages
/// a role has. Kept in code (not editable) so a misconfigured role can never lock everyone out.
/// </summary>
public static class Permissions
{
    public const string Dashboard = "dashboard";
    public const string Patients = "patients";
    public const string Orders = "orders";
    public const string CheckIn = "checkin";
    public const string ResultsEnter = "results.enter";
    public const string ResultsVerify = "results.verify";
    public const string ResultsApprove = "results.approve";
    public const string Reports = "reports";
    public const string Billing = "billing";
    /// <summary>The test catalog: departments, specimens, tests, packages, referring units.</summary>
    public const string SettingsLab = "settings.lab";
    /// <summary>Users, branches, the organization's details and the audit log.</summary>
    public const string SettingsAdmin = "settings.admin";

    public static readonly string[] All =
    [
        Dashboard, Patients, Orders, CheckIn, ResultsEnter, ResultsVerify, ResultsApprove,
        Reports, Billing, SettingsLab, SettingsAdmin,
    ];

    private static readonly Dictionary<UserRole, HashSet<string>> ByRole = new()
    {
        [UserRole.SuperAdmin] = [.. All],
        [UserRole.CompanyAdmin] = [.. All],
        [UserRole.BranchAdmin] = [.. All],
        [UserRole.LabManager] = [Dashboard, Patients, Orders, CheckIn, ResultsEnter, ResultsVerify, ResultsApprove, Reports, SettingsLab],
        [UserRole.LabTechnician] = [Dashboard, Patients, Orders, CheckIn, ResultsEnter, ResultsVerify, ResultsApprove, Reports],
        [UserRole.Doctor] = [Dashboard, Patients, Orders, ResultsApprove, Reports],
        [UserRole.Receptionist] = [Dashboard, Patients, Orders, CheckIn],
        [UserRole.Cashier] = [Dashboard, Patients, Billing],
    };

    public static IReadOnlySet<string> For(UserRole role) => ByRole[role];

    public static bool Has(UserRole role, string permission) => ByRole[role].Contains(permission);

    /// <summary>Medical professionals: they must have a licence number on file.</summary>
    public static bool NeedsLicense(UserRole role) => role is UserRole.LabManager or UserRole.LabTechnician or UserRole.Doctor;

    /// <summary>0 is the most powerful. Nobody may create or edit a user above their own level.</summary>
    public static int Level(UserRole role) => role switch
    {
        UserRole.SuperAdmin => 0,
        UserRole.CompanyAdmin => 1,
        UserRole.BranchAdmin => 2,
        _ => 3,
    };

    /// <summary>Whether <paramref name="actor"/> may give a user the role <paramref name="target"/>, or edit a user who has it.</summary>
    public static bool CanManage(UserRole actor, UserRole target) => Level(target) >= Level(actor);
}
