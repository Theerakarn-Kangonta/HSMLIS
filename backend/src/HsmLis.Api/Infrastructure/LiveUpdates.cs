using System.Security.Claims;
using HsmLis.Application.Common;
using HsmLis.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace HsmLis.Api.Infrastructure;

/// <summary>
/// Live updates: each signed-in browser keeps one SignalR connection here and joins its organization's
/// group. After every save the API sends that group a <see cref="ChangeNotice"/>, and the browser reloads
/// the affected screens through the normal API, so all permission and organization checks still apply.
/// Browsers only listen; the hub has no methods they can call.
/// </summary>
[Authorize]
public class LiveHub : Hub
{
    public const string Path = "/api/live";
    public const string ChangedMethod = "changed";

    public static string Group(Guid organizationId) => $"org:{organizationId}";

    public override async Task OnConnectedAsync()
    {
        if (!Guid.TryParse(Context.User?.FindFirstValue(AppClaims.OrganizationId), out var orgId) || orgId == Guid.Empty)
        {
            Context.Abort();
            return;
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, Group(orgId));
        await base.OnConnectedAsync();
    }
}

public class HubChangeFeed(IHubContext<LiveHub> hub) : IChangeFeed
{
    public Task PublishAsync(Guid organizationId, ChangeNotice notice) =>
        hub.Clients.Group(LiveHub.Group(organizationId)).SendAsync(LiveHub.ChangedMethod, notice);
}
