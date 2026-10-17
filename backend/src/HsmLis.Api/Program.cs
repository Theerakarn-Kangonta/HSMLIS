using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using HsmLis.Api.Infrastructure;
using HsmLis.Application;
using HsmLis.Application.Common;
using HsmLis.Application.Repositories;
using HsmLis.Infrastructure;
using HsmLis.Infrastructure.Persistence;
using HsmLis.Infrastructure.Security;
using HsmLis.Infrastructure.Seeding;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Every request body is a small JSON document; refuse anything large before reading it.
builder.WebHost.ConfigureKestrel(o =>
{
    o.Limits.MaxRequestBodySize = 512 * 1024;
    o.AddServerHeader = false;
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();

var sessionCookie = new SessionCookie(builder.Configuration);
if (!sessionCookie.IsValid)
    throw new InvalidOperationException("Auth:CookieSameSite is None, which browsers accept only with Auth:CookieSecure set to true.");
builder.Services.AddSingleton(sessionCookie);

builder.Services
    .AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<AppExceptionHandler>();

var jwt = builder.Configuration.GetSection(JwtOptions.Section).Get<JwtOptions>() ?? new JwtOptions();
if (jwt.SigningKey.Length < 32)
    throw new InvalidOperationException(
        "Jwt:SigningKey is missing or shorter than 32 characters. Set it with user-secrets or the Jwt__SigningKey environment variable.");
if (!builder.Environment.IsDevelopment() && jwt.SigningKey.StartsWith("development-only", StringComparison.Ordinal))
    throw new InvalidOperationException("Jwt:SigningKey is the public development key. Set a private random key.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = jwt.GetKey(),
            ValidateIssuerSigningKey = true,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            NameClaimType = AppClaims.Subject,
            RoleClaimType = AppClaims.Role,
            ClockSkew = TimeSpan.FromMinutes(1),
        };
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token = context.Request.Cookies[SessionCookie.Name];
                return Task.CompletedTask;
            },
            // A token stays valid for hours, so re-check the account on every request:
            // a suspended user is locked out at once and a role change applies immediately.
            OnTokenValidated = async context =>
            {
                var users = context.HttpContext.RequestServices.GetRequiredService<IUserRepository>();
                var user = Guid.TryParse(context.Principal?.FindFirstValue(AppClaims.Subject), out var id)
                    ? await users.GetAnyOrgAsync(id, context.HttpContext.RequestAborted)
                    : null;
                if (user is null || !user.IsActive)
                {
                    context.Fail("Account is suspended or no longer exists.");
                    return;
                }
                if (context.Principal?.FindFirstValue(AppClaims.PasswordStamp) != JwtTokenService.PasswordStamp(user))
                {
                    context.Fail("The password was changed after this token was issued.");
                    return;
                }

                var identity = new ClaimsIdentity(
                    [
                        new Claim(AppClaims.Subject, user.Id.ToString()),
                        new Claim(AppClaims.OrganizationId, user.OrganizationId.ToString()),
                        new Claim(AppClaims.Role, user.Role.ToString()),
                    ],
                    JwtBearerDefaults.AuthenticationScheme,
                    AppClaims.Subject,
                    AppClaims.Role);
                context.Principal = new ClaimsPrincipal(identity);
            },
        };
    });

builder.Services
    .AddAuthorizationBuilder()
    // Closed by default: an endpoint is reachable without signing in only if it says [AllowAnonymous].
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
    .AddPermissionPolicies();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(allowedOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    // Lets the listed origins, and only those, send the session cookie.
    .AllowCredentials()
    .WithExposedHeaders("Content-Disposition")));

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    // Slows down password guessing on the sign-in endpoint.
    o.AddPolicy(Policies.AuthRateLimit, http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Configuration.GetValue("RateLimit:AuthPerMinute", 10),
            Window = TimeSpan.FromMinutes(1),
        }));

    // A ceiling on everything else, per signed-in user (or per address when anonymous).
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(http => RateLimitPartition.GetFixedWindowLimiter(
        http.User.FindFirstValue(AppClaims.Subject) ?? http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = builder.Configuration.GetValue("RateLimit:RequestsPerMinute", 900),
            Window = TimeSpan.FromMinutes(1),
        }));
});

var app = builder.Build();

if (app.Configuration.GetValue("Database:MigrateOnStartup", false))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    var seeder = scope.ServiceProvider.GetRequiredService<DatabaseSeeder>();
    if (app.Configuration["Bootstrap:AdminUsername"] is { Length: > 0 } adminUsername)
    {
        await seeder.BootstrapAsync(
            app.Configuration["Bootstrap:OrganizationName"] ?? "Laboratory",
            adminUsername,
            app.Configuration["Bootstrap:AdminPassword"] ?? "");
    }
}

app.UseExceptionHandler();
if (!app.Environment.IsDevelopment()) app.UseHsts();

// Behind our Cloudflare Worker every request arrives from one of Cloudflare's addresses.
// The Worker passes on the visitor's address and proves itself with a shared key, so the
// rate limits count per visitor. Without the key the header is ignored.
var proxyKey = Encoding.UTF8.GetBytes(app.Configuration["Proxy:Key"] ?? "");
if (proxyKey.Length is > 0 and < 32)
    throw new InvalidOperationException("Proxy:Key must be at least 32 characters.");
if (proxyKey.Length > 0)
{
    app.Use((http, next) =>
    {
        var given = Encoding.UTF8.GetBytes(http.Request.Headers["X-HSMLIS-Proxy-Key"].ToString());
        if (CryptographicOperations.FixedTimeEquals(given, proxyKey)
            && IPAddress.TryParse(http.Request.Headers["X-HSMLIS-Client-IP"].ToString(), out var address))
            http.Connection.RemoteIpAddress = address;
        return next(http);
    });
}
app.Use(async (http, next) =>
{
    var headers = http.Response.Headers;
    headers.XContentTypeOptions = "nosniff";
    headers.XFrameOptions = "DENY";
    headers["Referrer-Policy"] = "no-referrer";
    headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
    // Responses carry patient data; keep them out of browser and proxy caches.
    headers.CacheControl = "no-store";
    await next();
});
if (app.Environment.IsDevelopment()) app.MapOpenApi().AllowAnonymous();

app.UseCors();
// The browser sends the session cookie on its own, so a request that changes anything must
// prove it came from our web app: a header other sites cannot add, and no foreign Origin.
app.Use(async (http, next) =>
{
    var request = http.Request;
    if (!HttpMethods.IsGet(request.Method) && !HttpMethods.IsHead(request.Method) && !HttpMethods.IsOptions(request.Method))
    {
        var origin = request.Headers.Origin.ToString();
        var knownOrigin = origin.Length == 0
            || allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)
            || (Uri.TryCreate(origin, UriKind.Absolute, out var uri)
                && string.Equals(uri.Authority, request.Host.Value, StringComparison.OrdinalIgnoreCase));
        if (!knownOrigin || request.Headers[SessionCookie.RequestHeader] != SessionCookie.RequestHeaderValue)
        {
            await Results.Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "This request did not come from the HSMLIS web app.",
                extensions: new Dictionary<string, object?> { ["code"] = "cross_site_request" }).ExecuteAsync(http);
            return;
        }
    }
    await next();
});
app.UseAuthentication();
// After authentication, so the general limit can count per signed-in user.
app.UseRateLimiter();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();
app.MapControllers();

app.Run();

public partial class Program;
