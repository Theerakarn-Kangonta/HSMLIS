using HsmLis.Domain.Entities;

namespace HsmLis.Application.Common;

/// <summary>Base for errors the API reports to the caller with a specific HTTP status.</summary>
public abstract class AppException(string code, string message) : Exception(message)
{
    /// <summary>Stable machine-readable code the frontend translates.</summary>
    public string Code { get; } = code;
}

public class NotFoundException(string code, string message) : AppException(code, message);

public class ConflictException(string code, string message) : AppException(code, message);

public class ForbiddenException(string code, string message) : AppException(code, message);

public class UnauthorizedException(string code, string message) : AppException(code, message);

public class TooManyAttemptsException(string code, string message) : AppException(code, message);

public class BusinessRuleException(string code, string message) : AppException(code, message);

/// <summary>The signed-in user for the current request, read from the access token.</summary>
public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    Guid UserId { get; }
    /// <summary>Guid.Empty for anonymous requests, which matches no organization and so returns no data.</summary>
    Guid OrganizationId { get; }
    UserRole Role { get; }
}

public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken ct = default);

    /// <summary>Runs <paramref name="work"/> in one database transaction; rolls back if it throws.</summary>
    Task<T> InTransactionAsync<T>(Func<Task<T>> work, CancellationToken ct = default);
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string hash, string password);
}

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) CreateAccessToken(User user);
}

/// <summary>Signs QZ Tray requests, so QZ Tray on the lab PCs prints labels without asking.</summary>
public interface IQzSigner
{
    /// <summary>The PEM certificate QZ Tray checks the signatures against.</summary>
    string Certificate();
    /// <summary>Base64 SHA-512 RSA signature of <paramref name="data"/>.</summary>
    string Sign(string data);
}

/// <summary>
/// What a save changed, sent to the organization's open browsers so their screens reload that data.
/// It names areas and order ids only, never the data itself: each browser fetches what it may see through the API.
/// </summary>
/// <param name="OrderIds">The orders that changed, or null when there were too many to list.</param>
public record ChangeNotice(IReadOnlyList<string> Topics, IReadOnlyList<Guid>? OrderIds);

/// <summary>The areas a <see cref="ChangeNotice"/> can name. The frontend maps each to the lists it shows.</summary>
public static class ChangeTopics
{
    public const string Patients = "patients";
    public const string Orders = "orders";
    public const string Billing = "billing";
    public const string Catalog = "catalog";
    public const string Users = "users";
    public const string Organization = "organization";
    public const string Audit = "audit";
}

/// <summary>Tells the signed-in users of one organization that something changed.</summary>
public interface IChangeFeed
{
    Task PublishAsync(Guid organizationId, ChangeNotice notice);
}

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

/// <summary>Which page of a list a caller asked for, held to sensible bounds.</summary>
public readonly record struct PageRequest
{
    public const int MaxPageSize = 200;

    public PageRequest(int page, int pageSize)
    {
        Page = Math.Max(1, page);
        PageSize = Math.Clamp(pageSize, 1, MaxPageSize);
    }

    public int Page { get; }
    public int PageSize { get; }
    public int Skip => (Page - 1) * PageSize;
}

/// <summary>A span of days in the laboratory's calendar, both ends included.</summary>
public record DateRange(DateOnly? From, DateOnly? To);
