using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Application.Repositories;
using HsmLis.Domain;
using HsmLis.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace HsmLis.Application.Services;

/// <summary>A new session. The token goes into the session cookie, never into a response body.</summary>
public record Session(string Token, DateTime ExpiresAt);

public record SignedIn(MeResponse Me, Session Session);

public interface IAuthService
{
    Task<SignedIn> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<MeResponse> GetMeAsync(CancellationToken ct = default);
    Task LogoutAsync(CancellationToken ct = default);
    /// <summary>Changing the password ends every other session; the returned one replaces the caller's.</summary>
    Task<Session> ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct = default);
    Task<MeResponse> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken ct = default);
}

public class AuthService(
    IUserRepository users,
    IOrganizationRepository organizations,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher,
    ITokenService tokens,
    IOrgContextProvider context,
    IAuditTrail audit,
    TimeProvider clock,
    ILogger<AuthService> logger) : IAuthService
{
    internal const int MaxFailedLogins = 5;
    internal static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private static string? _decoyHash;

    public async Task<SignedIn> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        // One message for every failure so the response does not reveal which usernames exist.
        var invalid = new UnauthorizedException("invalid_credentials", "Username or password is incorrect.");

        var user = await users.GetByUsernameAnyOrgAsync(NormalizeUsername(request.Username), ct);
        if (user is null)
        {
            // The same hashing work as for a real account, so timing does not reveal usernames.
            passwordHasher.Verify(_decoyHash ??= passwordHasher.Hash(Guid.NewGuid().ToString()), request.Password);
            throw invalid;
        }

        var now = clock.GetUtcNow().UtcDateTime;
        if (user.LockedUntil > now)
            throw new TooManyAttemptsException("account_locked", "Too many failed sign-in attempts. Try again in a few minutes.");

        if (!passwordHasher.Verify(user.PasswordHash, request.Password))
        {
            await users.RecordFailedLoginAnyOrgAsync(user.Id, MaxFailedLogins, now + LockoutDuration, ct);
            logger.LogWarning("Failed sign-in for user {UserId}", user.Id);
            throw invalid;
        }
        if (!user.IsActive)
            throw new UnauthorizedException("account_disabled", "This account has been suspended.");

        await users.ClearFailedLoginsAnyOrgAsync(user.Id, ct);
        var org = await organizations.GetAsync(user.OrganizationId, ct)
            ?? throw new UnauthorizedException("organization_missing", "The organization for this account no longer exists.");

        audit.Write(org.Id, user.Id, user.FullName, now, "login", "auth", user.Id.ToString());
        await unitOfWork.SaveChangesAsync(ct);

        var (token, expires) = tokens.CreateAccessToken(user);
        return new SignedIn(Me(user, org), new Session(token, expires));
    }

    public async Task<MeResponse> GetMeAsync(CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        return Me(ctx.User, ctx.Org);
    }

    public async Task LogoutAsync(CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        audit.Write(ctx, "logout", "auth", ctx.User.Id.ToString());
        await unitOfWork.SaveChangesAsync(ct);
    }

    public async Task<Session> ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var user = ctx.User;
        if (!passwordHasher.Verify(user.PasswordHash, request.CurrentPassword))
            throw new BusinessRuleException("wrong_password", "The current password is not correct.");
        if (PasswordPolicy.Check(request.NewPassword) is { } problem)
            throw new BusinessRuleException(problem, "The new password is not strong enough.");

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);
        audit.Write(ctx, "password.change", "user", user.Id.ToString());
        await unitOfWork.SaveChangesAsync(ct);
        var (token, expires) = tokens.CreateAccessToken(user);
        return new Session(token, expires);
    }

    public async Task<MeResponse> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var user = ctx.User;
        user.FirstNameTh = request.FirstNameTh.Trim();
        user.LastNameTh = request.LastNameTh.Trim();
        user.FirstNameEn = Text.Clean(request.FirstNameEn);
        user.LastNameEn = Text.Clean(request.LastNameEn);
        user.Email = Text.Clean(request.Email)?.ToLowerInvariant();
        user.Phone = Text.Clean(request.Phone);
        audit.Write(ctx, "profile.update", "user", user.Id.ToString());
        await unitOfWork.SaveChangesAsync(ct);
        return Me(user, ctx.Org);
    }

    private static MeResponse Me(User user, Organization org) =>
        new(user.ToDto(), org.ToDto(), Permissions.For(user.Role).Order(StringComparer.Ordinal).ToList());

    public static string NormalizeUsername(string username) => username.Trim().ToLowerInvariant();
}

public interface IUserService
{
    Task<List<UserDto>> ListAsync(CancellationToken ct = default);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default);
    Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default);
}

public class UserService(
    IUserRepository users,
    ICatalogRepository<Branch> branches,
    ICatalogRepository<Department> departments,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher,
    IOrgContextProvider context,
    IAuditTrail audit) : IUserService
{
    public async Task<List<UserDto>> ListAsync(CancellationToken ct = default) =>
        (await users.ListAsync(ct)).Select(u => u.ToDto()).ToList();

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        EnsureMayAssign(ctx.User.Role, request.Role);
        var username = AuthService.NormalizeUsername(request.Username);
        if (await users.UsernameExistsAnyOrgAsync(username, ct))
            throw new ConflictException("username_taken", "This username is already in use.");
        if (PasswordPolicy.Check(request.Password) is { } problem)
            throw new BusinessRuleException(problem, "The password is not strong enough.");
        await EnsureReferencesAsync(request.BranchId, request.DepartmentIds, ct);

        var user = new User
        {
            Id = Guid.NewGuid(),
            OrganizationId = ctx.Org.Id,
            Username = username,
            PasswordHash = passwordHasher.Hash(request.Password),
            CreatedAt = ctx.Now,
            IsActive = true,
        };
        Apply(user, request.FirstNameTh, request.LastNameTh, request.FirstNameEn, request.LastNameEn, request.Position,
            request.Email, request.Phone, request.EmployeeCode, request.BranchId, request.Role, request.DepartmentIds);
        users.Add(user);
        audit.Write(ctx, "user.create", "user", user.Id.ToString(), $"{user.Username} ({user.Role})");
        await unitOfWork.SaveChangesAsync(ct);
        return user.ToDto();
    }

    public async Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default)
    {
        var ctx = await context.GetAsync(ct);
        var user = await users.GetAsync(id, ct) ?? throw new NotFoundException("user_not_found", "User not found.");
        EnsureMayAssign(ctx.User.Role, user.Role);
        EnsureMayAssign(ctx.User.Role, request.Role);
        if (user.Id == ctx.User.Id && (request.Role != user.Role || !request.IsActive))
            throw new BusinessRuleException("cannot_change_own_access", "You cannot change your own role or suspend yourself.");
        await EnsureReferencesAsync(request.BranchId, request.DepartmentIds, ct);

        if (!string.IsNullOrEmpty(request.NewPassword))
        {
            if (PasswordPolicy.Check(request.NewPassword) is { } problem)
                throw new BusinessRuleException(problem, "The password is not strong enough.");
            user.PasswordHash = passwordHasher.Hash(request.NewPassword);
            user.FailedLoginCount = 0;
            user.LockedUntil = null;
        }
        var before = $"{user.Role}/{(user.IsActive ? "active" : "suspended")}";
        Apply(user, request.FirstNameTh, request.LastNameTh, request.FirstNameEn, request.LastNameEn, request.Position,
            request.Email, request.Phone, request.EmployeeCode, request.BranchId, request.Role, request.DepartmentIds);
        user.IsActive = request.IsActive;
        var after = $"{user.Role}/{(user.IsActive ? "active" : "suspended")}";
        audit.Write(ctx, "user.update", "user", user.Id.ToString(),
            $"{user.Username}: {before} → {after}{(string.IsNullOrEmpty(request.NewPassword) ? "" : ", password reset")}");
        await unitOfWork.SaveChangesAsync(ct);
        return user.ToDto();
    }

    private static void EnsureMayAssign(UserRole actor, UserRole target)
    {
        if (!Permissions.CanManage(actor, target))
            throw new ForbiddenException("role_not_allowed", "You cannot manage users with this role.");
    }

    private async Task EnsureReferencesAsync(Guid? branchId, List<Guid>? departmentIds, CancellationToken ct)
    {
        if (branchId is { } b && await branches.GetAsync(b, ct) is null)
            throw new BusinessRuleException("branch_not_found", "The branch does not exist.");
        var ids = departmentIds?.Distinct().ToList() ?? [];
        if (ids.Count > 0 && (await departments.GetManyAsync(ids, ct)).Count != ids.Count)
            throw new BusinessRuleException("department_not_found", "A chosen department does not exist.");
    }

    private static void Apply(User user, string firstTh, string lastTh, string? firstEn, string? lastEn, string? position,
        string? email, string? phone, string? employeeCode, Guid? branchId, UserRole role, List<Guid>? departmentIds)
    {
        user.FirstNameTh = firstTh.Trim();
        user.LastNameTh = lastTh.Trim();
        user.FirstNameEn = Text.Clean(firstEn);
        user.LastNameEn = Text.Clean(lastEn);
        user.Position = Text.Clean(position);
        user.Email = Text.Clean(email)?.ToLowerInvariant();
        user.Phone = Text.Clean(phone);
        user.EmployeeCode = Text.Clean(employeeCode);
        user.BranchId = branchId;
        user.Role = role;
        user.DepartmentIds = departmentIds?.Distinct().ToList() ?? [];
    }
}
