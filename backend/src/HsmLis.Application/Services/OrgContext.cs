using HsmLis.Application.Common;
using HsmLis.Application.Repositories;
using HsmLis.Domain;
using HsmLis.Domain.Entities;

namespace HsmLis.Application.Services;

/// <summary>The current organization, the signed-in user and the time, resolved once per request.</summary>
public record OrgContext(Organization Org, User User, DateTime Now)
{
    public DateOnly Today => LabClock.Today(Now, Org.TimeZone);

    public DateTime StartUtc(DateOnly day) => LabClock.StartOfDayUtc(day, Org.TimeZone);

    /// <summary>[start of <paramref name="from"/>, start of the day after <paramref name="to"/>) in UTC; open where a day is missing.</summary>
    public (DateTime? From, DateTime? To) Bounds(DateOnly? from, DateOnly? to) =>
        (from is { } f ? StartUtc(f) : null, to is { } t ? StartUtc(t.AddDays(1)) : null);

    public DateOnly LocalDay(DateTime utc) => DateOnly.FromDateTime(LabClock.ToLocal(utc, Org.TimeZone));

    public string UserName => User.FullName;
}

public interface IOrgContextProvider
{
    Task<OrgContext> GetAsync(CancellationToken ct = default);
}

public class OrgContextProvider(ICurrentUser currentUser, IOrganizationRepository organizations, IUserRepository users, TimeProvider clock)
    : IOrgContextProvider
{
    private OrgContext? _cached;

    public async Task<OrgContext> GetAsync(CancellationToken ct = default)
    {
        if (_cached is not null) return _cached;
        var org = await organizations.GetAsync(currentUser.OrganizationId, ct)
            ?? throw new UnauthorizedException("organization_missing", "The organization for this account no longer exists.");
        var user = await users.GetAsync(currentUser.UserId, ct)
            ?? throw new UnauthorizedException("user_missing", "This account no longer exists.");
        return _cached = new OrgContext(org, user, clock.GetUtcNow().UtcDateTime);
    }
}

/// <summary>Adds entries to the audit log. They are saved with the rest of the request's changes.</summary>
public interface IAuditTrail
{
    void Write(OrgContext context, string action, string entityType, string? entityId, string? detail = null);
    void Write(Guid organizationId, Guid? userId, string userName, DateTime at, string action, string entityType, string? entityId, string? detail = null);
}

public class AuditTrail(IAuditRepository audit) : IAuditTrail
{
    public void Write(OrgContext context, string action, string entityType, string? entityId, string? detail = null) =>
        Write(context.Org.Id, context.User.Id, context.UserName, context.Now, action, entityType, entityId, detail);

    public void Write(Guid organizationId, Guid? userId, string userName, DateTime at, string action, string entityType, string? entityId, string? detail = null) =>
        audit.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            At = at,
            UserId = userId,
            UserName = userName,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Detail = detail is { Length: > 1000 } ? detail[..1000] : detail,
        });
}

internal static class Text
{
    /// <summary>Trimmed, or null when empty.</summary>
    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
