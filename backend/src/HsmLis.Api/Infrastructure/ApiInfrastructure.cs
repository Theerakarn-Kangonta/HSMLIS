using System.Security.Claims;
using HsmLis.Application.Common;
using HsmLis.Application.Services;
using HsmLis.Domain;
using HsmLis.Domain.Entities;
using HsmLis.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HsmLis.Api.Infrastructure;

public static class Policies
{
    public const string AuthRateLimit = "auth";
    /// <summary>Any of the three result permissions: who may open the result worklist.</summary>
    public const string ResultsAny = "results.any";

    /// <summary>One policy per permission, named after it, plus <see cref="ResultsAny"/>.</summary>
    public static AuthorizationBuilder AddPermissionPolicies(this AuthorizationBuilder builder)
    {
        foreach (var permission in Permissions.All)
            builder.AddPolicy(permission, p => p.RequireAssertion(ctx => RoleOf(ctx.User) is { } role && Permissions.Has(role, permission)));
        builder.AddPolicy(ResultsAny, p => p.RequireAssertion(ctx => RoleOf(ctx.User) is { } role
            && (Permissions.Has(role, Permissions.ResultsEnter) || Permissions.Has(role, Permissions.ResultsVerify) || Permissions.Has(role, Permissions.ResultsApprove))));
        return builder;
    }

    private static UserRole? RoleOf(ClaimsPrincipal user) =>
        Enum.TryParse<UserRole>(user.FindFirstValue(AppClaims.Role), out var role) ? role : null;
}

/// <summary>
/// The session lives in an HttpOnly cookie, which page script cannot read, so an injected
/// script cannot steal it. Because browsers attach cookies by themselves, every changing
/// request must also pass the cross-site check in Program.cs.
/// </summary>
public class SessionCookie(IConfiguration configuration)
{
    public const string Name = "hsmlis_session";
    /// <summary>Browsers cannot add this header to a cross-site request without the CORS policy allowing that site.</summary>
    public const string RequestHeader = "X-Requested-With";
    public const string RequestHeaderValue = "HSMLIS";

    private readonly bool _secure = configuration.GetValue("Auth:CookieSecure", true);
    private readonly SameSiteMode _sameSite = configuration.GetValue("Auth:CookieSameSite", SameSiteMode.Lax);

    /// <summary>Browsers drop a SameSite=None cookie that is not also Secure.</summary>
    public bool IsValid => _secure || _sameSite != SameSiteMode.None;

    public void Set(HttpResponse response, Session session) =>
        response.Cookies.Append(Name, session.Token, Options(new DateTimeOffset(session.ExpiresAt, TimeSpan.Zero)));

    public void Clear(HttpResponse response) => response.Cookies.Delete(Name, Options(null));

    private CookieOptions Options(DateTimeOffset? expires) => new()
    {
        HttpOnly = true,
        Secure = _secure,
        SameSite = _sameSite,
        Path = "/api",
        Expires = expires,
        IsEssential = true,
    };
}

/// <summary>Reads the caller from the validated access token of the current request.</summary>
public class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid UserId => ReadGuid(AppClaims.Subject);

    public Guid OrganizationId => ReadGuid(AppClaims.OrganizationId);

    public UserRole Role =>
        Enum.TryParse<UserRole>(Principal?.FindFirstValue(AppClaims.Role), out var role) ? role : UserRole.Cashier;

    private Guid ReadGuid(string claim) =>
        Guid.TryParse(Principal?.FindFirstValue(claim), out var value) ? value : Guid.Empty;
}

/// <summary>Turns application errors into RFC 7807 responses carrying a stable "code".</summary>
public class AppExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext http, Exception exception, CancellationToken ct)
    {
        var (status, code, message) = exception switch
        {
            NotFoundException e => (StatusCodes.Status404NotFound, e.Code, e.Message),
            ConflictException e => (StatusCodes.Status409Conflict, e.Code, e.Message),
            ForbiddenException e => (StatusCodes.Status403Forbidden, e.Code, e.Message),
            UnauthorizedException e => (StatusCodes.Status401Unauthorized, e.Code, e.Message),
            TooManyAttemptsException e => (StatusCodes.Status429TooManyRequests, e.Code, e.Message),
            AppException e => (StatusCodes.Status422UnprocessableEntity, e.Code, e.Message),
            // Two people saved the same record at once; the second must reload.
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "concurrency_conflict", "Someone else changed this record. Reload it and try again."),
            _ => (0, "", ""),
        };
        if (status == 0) return false;

        http.Response.StatusCode = status;
        var problem = new ProblemDetails { Status = status, Title = message };
        problem.Extensions["code"] = code;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails = problem,
            Exception = exception,
        });
    }
}
