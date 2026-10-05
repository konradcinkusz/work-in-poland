using System.Text.Json;
using ModelContextProtocol;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Mcp;

/// <summary>Anti-corruption at the edge: tool arguments become the same request records REST binds, results are the REST JSON.</summary>
internal static class McpSupport
{
    public static async Task<string> RunAsync<T>(Func<Task<T>> operation)
    {
        try
        {
            return JsonSerializer.Serialize(await operation(), JsonSerializerOptions.Web);
        }
        catch (DomainException ex)
        {
            throw new McpException(ex.Message, ex);
        }
    }

    public static string Caller(RequestContext<CallToolRequestParams> context, string scope)
    {
        var user = context.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            throw new McpException("You are not signed in. Connect the account endpoint (/mcp/account) and sign in to use this tool.");
        }

        if (!user.Scopes().Contains(scope))
        {
            throw new McpException($"This tool needs the '{scope}' scope, which this connection was not granted. Reconnect and approve that scope.");
        }

        return user.UserId();
    }

    public static JobInput ToJobInput(
        Guid companyId, string title, string? description, string category, string seniority, string workMode, string? remoteScope,
        string? city, SalaryOfferDto[]? salaries, string[]? skills, string? applyUrl, bool publish) =>
        new(companyId, title, description, category, seniority, workMode, remoteScope, city, salaries, skills, applyUrl, publish);
}
