using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using ModelContextProtocol.Server;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Contracts;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Mcp;

/// <summary>
/// The MCP adapter (ADR 0002): <c>/mcp</c> anonymous with the public tools, <c>/mcp/account</c> behind the
/// <c>Mcp</c> bearer scheme with public plus account tools. Stateless Streamable HTTP, so any machine can answer.
/// </summary>
public static class McpExtensions
{
    public const string PublicRoute = "/mcp";
    public const string AccountRoute = "/mcp/account";
    private const string MetadataPath = "/.well-known/oauth-protected-resource";

    private const string Instructions =
        "Work in Poland is a Polish job board. Use search_jobs to find open listings (every listing has a salary range), "
        + "get_job_details for the description and the employer's apply link, get_salary_benchmarks for market pay. "
        + "Applying happens on the employer's own site. On the account endpoint you can also track jobs and, as an employer, post and manage listings.";

    public static IServiceCollection AddMcpAdapter(this IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetSection("Mcp").Get<McpOptions>() ?? new McpOptions();
        services.Configure<McpOptions>(configuration.GetSection("Mcp"));
        services.AddSingleton(new IntegrationState("mcp", "enabled"));
        var account = !string.IsNullOrWhiteSpace(options.ResourceUri)
            ? options.AccountEnabled ? "enabled" : "misconfigured (Mcp:AuthorizationServer and an absolute Mcp:ResourceUri are required)"
            : "disabled";
        services.AddSingleton(new IntegrationState("mcpAccount", account));

        var publicTools = ToolMethods(typeof(PublicTools));
        var accountTools = publicTools.Concat(ToolMethods(typeof(AccountTools))).ToList();
        services.AddMcpServer(o =>
            {
                o.ServerInfo = new ModelContextProtocol.Protocol.Implementation { Name = "work-in-poland", Version = "1.0.0" };
                o.ServerInstructions = Instructions;
            })
            .WithHttpTransport(http =>
            {
                http.Stateless = true;
                http.ConfigureSessionOptions = (context, server, _) =>
                {
                    var methods = context.Request.Path.StartsWithSegments(AccountRoute) ? accountTools : publicTools;
                    server.ToolCollection = new McpServerPrimitiveCollection<McpServerTool>();
                    foreach (var method in methods)
                    {
                        server.ToolCollection.Add(McpServerTool.Create(method, request => ActivatorUtilities.CreateInstance(request.Services!, method.DeclaringType!)));
                    }

                    return Task.CompletedTask;
                };
            });

        if (options.AccountEnabled)
        {
            var authority = options.AuthorizationServer!.Trim().TrimEnd('/');
            var resource = options.ResourceUri!.Trim();
            var metadataUrl = $"{new Uri(resource).GetLeftPart(UriPartial.Authority)}{MetadataPath}{AccountRoute}";
            services.AddAuthentication().AddJwtBearerScheme(
                AuthSchemes.Mcp,
                $"{authority}/.well-known/oauth-authorization-server",
                authority,
                resource,
                configuration.GetValue("Jwt:RequireHttpsMetadata", true),
                jwt => jwt.Events = new JwtBearerEvents
                {
                    OnChallenge = context =>
                    {
                        context.HandleResponse();
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        var error = context.AuthenticateFailure is null ? string.Empty : ", error=\"invalid_token\"";
                        context.Response.Headers.WWWAuthenticate = $"Bearer resource_metadata=\"{metadataUrl}\"{error}";
                        return Task.CompletedTask;
                    },
                });
        }

        return services;
    }

    public static WebApplication MapMcpEndpoints(this WebApplication app)
    {
        app.MapMcp(PublicRoute).RequireRateLimiting(RateLimitPolicies.Public);
        var options = app.Services.GetRequiredService<IOptions<McpOptions>>().Value;
        if (!options.AccountEnabled)
        {
            return app;
        }

        app.MapMcp(AccountRoute)
            .RequireAuthorization(new AuthorizeAttribute { AuthenticationSchemes = AuthSchemes.Mcp })
            .RequireRateLimiting(RateLimitPolicies.Api);

        var document = new
        {
            resource = options.ResourceUri!.Trim(),
            authorization_servers = new[] { options.AuthorizationServer!.Trim().TrimEnd('/') },
            scopes_supported = Scopes.All,
            bearer_methods_supported = new[] { "header" },
        };
        app.MapGet(MetadataPath + AccountRoute, () => Results.Json(document, JsonSerializerOptions.Default)).RequireRateLimiting(RateLimitPolicies.Public);
        app.MapGet(MetadataPath, () => Results.Json(document, JsonSerializerOptions.Default)).RequireRateLimiting(RateLimitPolicies.Public);
        return app;
    }

    private static List<MethodInfo> ToolMethods(Type type) =>
        type.GetMethods(BindingFlags.Public | BindingFlags.Instance).Where(m => m.GetCustomAttribute<McpServerToolAttribute>() is not null).ToList();
}
