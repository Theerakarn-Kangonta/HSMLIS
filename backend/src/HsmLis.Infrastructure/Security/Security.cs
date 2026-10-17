using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using HsmLis.Application.Common;
using HsmLis.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace HsmLis.Infrastructure.Security;

public class JwtOptions
{
    public const string Section = "Jwt";

    public string Issuer { get; set; } = "hsmlis";
    public string Audience { get; set; } = "hsmlis";
    /// <summary>Secret used to sign tokens. At least 32 characters; never commit a real one.</summary>
    public string SigningKey { get; set; } = "";
    public int ExpiryHours { get; set; } = 12;

    public SymmetricSecurityKey GetKey() => new(Encoding.UTF8.GetBytes(SigningKey));
}

public static class AppClaims
{
    public const string OrganizationId = "org_id";
    public const string PasswordStamp = "pwd";
    public const string Role = "role";
    public const string Subject = "sub";
}

public class JwtTokenService(IOptions<JwtOptions> options, TimeProvider clock) : ITokenService
{
    public (string Token, DateTime ExpiresAt) CreateAccessToken(User user)
    {
        var o = options.Value;
        var now = clock.GetUtcNow().UtcDateTime;
        var expires = now.AddHours(o.ExpiryHours);
        var token = new JwtSecurityToken(
            o.Issuer,
            o.Audience,
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(AppClaims.OrganizationId, user.OrganizationId.ToString()),
                new Claim(AppClaims.Role, user.Role.ToString()),
                new Claim(AppClaims.PasswordStamp, PasswordStamp(user)),
            ],
            now,
            expires,
            new SigningCredentials(o.GetKey(), SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    /// <summary>
    /// A fingerprint of the user's current password hash. It goes into every token and is
    /// compared on each request, so changing a password signs out every existing session.
    /// </summary>
    public static string PasswordStamp(User user) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(user.PasswordHash)), 0, 8);
}

public class PasswordHasher : IPasswordHasher
{
    private readonly PasswordHasher<User> _inner = new();
    private static readonly User Unused = new();

    public string Hash(string password) => _inner.HashPassword(Unused, password);

    public bool Verify(string hash, string password) =>
        _inner.VerifyHashedPassword(Unused, hash, password) != PasswordVerificationResult.Failed;
}
