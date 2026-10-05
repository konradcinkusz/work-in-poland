using System.Net;
using System.Text.Json;
using WorkInPoland.Api.Tests.Infrastructure;

namespace WorkInPoland.Api.Tests.ServiceDefaults;

public class HealthTests
{
    private static async Task<(HttpStatusCode Status, JsonElement Body)> Health(ApiFactory factory)
    {
        await factory.WaitReadyAsync();
        var response = await factory.CreateClient().GetAsync("/health");
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (response.StatusCode, doc.RootElement.Clone());
    }

    [Fact]
    public async Task Health_lists_every_optional_integration_for_a_zero_config_start()
    {
        using var factory = new ApiFactory();
        var (status, body) = await Health(factory);
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("healthy", body.GetProperty("status").GetString());
        var integrations = body.GetProperty("integrations");
        Assert.Equal("inmemory", integrations.GetProperty("database").GetString());
        Assert.Equal("not-configured", integrations.GetProperty("auth").GetString());
        Assert.Equal("disabled", integrations.GetProperty("mcpAccount").GetString());
        Assert.Equal("enabled", integrations.GetProperty("mcp").GetString());
        Assert.Equal("disabled", integrations.GetProperty("telemetry").GetString());
        Assert.Equal("same-origin", integrations.GetProperty("cors").GetString());
        Assert.Equal("disabled", integrations.GetProperty("demoSeed").GetString());
        Assert.StartsWith("ignored", integrations.GetProperty("clientIpHeader").GetString());
        Assert.Equal("healthy", body.GetProperty("checks").GetProperty("migrations").GetString());
    }

    [Fact]
    public async Task Health_reflects_configuration_that_is_present()
    {
        using var factory = new ApiFactory(mcpAccount: true, settings: new()
        {
            ["Jwt:Authority"] = "https://auth.test.example",
            ["Seed:Demo"] = "true",
            ["Cors:AllowedOrigins:0"] = "https://web.test.example",
            ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://localhost:4317",
            ["Network:TrustProxyClientIpHeader"] = "true",
            ["Network:ClientIpHeader"] = "Fly-Client-IP",
        });
        var (_, body) = await Health(factory);
        var integrations = body.GetProperty("integrations");
        Assert.Equal("configured", integrations.GetProperty("auth").GetString());
        Assert.Equal("enabled", integrations.GetProperty("mcpAccount").GetString());
        Assert.Equal("enabled", integrations.GetProperty("demoSeed").GetString());
        Assert.Equal("1 origin(s)", integrations.GetProperty("cors").GetString());
        Assert.Equal("otlp", integrations.GetProperty("telemetry").GetString());
        Assert.Equal("trusted (Fly-Client-IP)", integrations.GetProperty("clientIpHeader").GetString());
    }

    [Fact]
    public async Task Insecure_metadata_is_visible_in_the_auth_state()
    {
        using var factory = new ApiFactory(settings: new() { ["Jwt:Authority"] = "http://authservice:8080", ["Jwt:RequireHttpsMetadata"] = "false" });
        var (_, body) = await Health(factory);
        Assert.Equal("configured (metadata over http - insecure)", body.GetProperty("integrations").GetProperty("auth").GetString());
    }

    [Fact]
    public async Task Mcp_account_with_a_resource_uri_but_no_authorization_server_is_reported_misconfigured_and_not_mapped()
    {
        using var factory = new ApiFactory(settings: new() { ["Mcp:ResourceUri"] = TestTokens.McpResource });
        var (_, body) = await Health(factory);
        Assert.StartsWith("misconfigured", body.GetProperty("integrations").GetProperty("mcpAccount").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await factory.CreateClient().PostAsync("/mcp/account", new StringContent("{}"))).StatusCode);
    }

    [Fact]
    public async Task Alive_answers_200_with_only_liveness_checks()
    {
        using var factory = new ApiFactory();
        var response = await factory.CreateClient().GetAsync("/alive");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
