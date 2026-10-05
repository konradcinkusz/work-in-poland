using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;
using WorkInPoland.Api.Data;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Tests.Infrastructure;

/// <summary>
/// The real host over an InMemory database (a fresh store per factory). The test RSA key is injected through
/// <c>PostConfigure&lt;JwtBearerOptions&gt;</c>, so production code carries no test seam.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly Dictionary<string, string?> _settings;

    public ApiFactory(bool mcpAccount = false, Dictionary<string, string?>? settings = null, bool fakeClock = false)
    {
        _settings = settings ?? [];
        if (mcpAccount)
        {
            _settings["Mcp:ResourceUri"] = TestTokens.McpResource;
            _settings["Mcp:AuthorizationServer"] = TestTokens.AuthorizationServer + "/";
        }

        if (fakeClock)
        {
            Clock = new FakeTimeProvider(new DateTimeOffset(2026, 10, 5, 12, 0, 0, TimeSpan.Zero));
        }
    }

    public FakeTimeProvider? Clock { get; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        // UseSetting, not ConfigureAppConfiguration: Program.cs reads configuration while it builds the host.
        foreach (var (key, value) in _settings)
        {
            builder.UseSetting(key, value);
        }

        builder.ConfigureServices(services =>
        {
            if (Clock is not null)
            {
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(Clock);
            }

            services.PostConfigure<JwtBearerOptions>(JwtAuthenticationExtensions.BearerScheme, UseTestKey);
            services.PostConfigure<JwtBearerOptions>("Mcp", UseTestKey);
        });
    }

    private static void UseTestKey(JwtBearerOptions options)
    {
        options.ConfigurationManager = null;
        options.Configuration = null;
        options.TokenValidationParameters.IssuerSigningKey = TestTokens.Key;
    }

    public HttpClient CreateClientFor(string? token = null, string? clientIp = null)
    {
        var client = CreateClient();
        if (token is not null)
        {
            client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        }

        if (clientIp is not null)
        {
            client.DefaultRequestHeaders.Add("Fly-Client-IP", clientIp);
        }

        return client;
    }

    /// <summary>Runs <paramref name="action"/> against the host's database in its own scope.</summary>
    public async Task WithDbAsync(Func<ApiDbContext, Task> action)
    {
        using var scope = Services.CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<ApiDbContext>());
    }

    /// <summary>Waits for the migration service to finish so health and sweeps are deterministic.</summary>
    public async Task WaitReadyAsync()
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        _ = Server;
        await Services.GetRequiredService<IMigrationCompletionSignal>().WaitAsync(timeout.Token);
    }
}
