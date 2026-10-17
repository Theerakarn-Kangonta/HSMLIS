using HsmLis.Api.Infrastructure;
using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Application.Services;
using HsmLis.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HsmLis.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService auth, SessionCookie cookie) : ControllerBase
{
    /// <summary>Signs in. The session goes into an HttpOnly cookie; the body only says who signed in.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(Policies.AuthRateLimit)]
    public async Task<MeResponse> Login(LoginRequest request, CancellationToken ct)
    {
        var signedIn = await auth.LoginAsync(request, ct);
        cookie.Set(Response, signedIn.Session);
        return signedIn.Me;
    }

    /// <summary>Anonymous so that an expired session can still clear its cookie.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        if (User.Identity?.IsAuthenticated == true) await auth.LogoutAsync(ct);
        cookie.Clear(Response);
        return NoContent();
    }

    [HttpGet("me")]
    public Task<MeResponse> Me(CancellationToken ct) => auth.GetMeAsync(ct);
}

[ApiController]
[Route("api/account")]
public class AccountController(IAuthService auth, SessionCookie cookie) : ControllerBase
{
    [HttpPost("password")]
    [EnableRateLimiting(Policies.AuthRateLimit)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        cookie.Set(Response, await auth.ChangePasswordAsync(request, ct));
        return NoContent();
    }

    [HttpPut("profile")]
    public Task<MeResponse> UpdateProfile(UpdateProfileRequest request, CancellationToken ct) => auth.UpdateProfileAsync(request, ct);
}

[ApiController]
[Route("api/organization")]
public class OrganizationController(IOrganizationService organizations) : ControllerBase
{
    [HttpPut]
    [Authorize(Policy = Permissions.SettingsAdmin)]
    public Task<OrganizationDto> Update(OrganizationRequest request, CancellationToken ct) => organizations.UpdateAsync(request, ct);
}

[ApiController]
[Route("api/users")]
[Authorize(Policy = Permissions.SettingsAdmin)]
public class UsersController(IUserService users) : ControllerBase
{
    [HttpGet]
    public Task<List<UserDto>> List(CancellationToken ct) => users.ListAsync(ct);

    [HttpPost]
    public Task<UserDto> Create(CreateUserRequest request, CancellationToken ct) => users.CreateAsync(request, ct);

    [HttpPut("{id:guid}")]
    public Task<UserDto> Update(Guid id, UpdateUserRequest request, CancellationToken ct) => users.UpdateAsync(id, request, ct);
}

[ApiController]
[Route("api/audit")]
[Authorize(Policy = Permissions.SettingsAdmin)]
public class AuditController(IAuditService audit) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<AuditLogDto>> List(
        [FromQuery] string? search,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default) =>
        audit.PageAsync(new AuditFilter(search, action, entityType, from, to), new PageRequest(page, pageSize), ct);
}

[ApiController]
[Route("api/dashboard")]
[Authorize(Policy = Permissions.Dashboard)]
public class DashboardController(IDashboardService dashboard) : ControllerBase
{
    [HttpGet]
    public Task<DashboardDto> Get(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] Guid? referrerId,
        [FromQuery] Guid? departmentId,
        CancellationToken ct) => dashboard.GetAsync(new DateRange(from, to), referrerId, departmentId, ct);
}
