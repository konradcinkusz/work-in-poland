using System.Net;
using System.Text.Json;
using WorkInPoland.Api.Tests.Infrastructure;

namespace WorkInPoland.Api.Tests.ServiceDefaults;

public class RateLimitingTests
{
    private static Dictionary<string, string?> Limits(int publicPermits = 3, int apiPermits = 100) => new()
    {
        ["RateLimiting:PublicPermitsPerMinute"] = publicPermits.ToString(),
        ["RateLimiting:ApiPermitsPerMinute"] = apiPermits.ToString(),
    };

    private static async Task<HttpStatusCode> Get(HttpClient client, string url = "/api/v1/stats") => (await client.GetAsync(url)).StatusCode;

    [Fact]
    public async Task The_public_policy_rejects_with_the_uniform_429_body_and_a_retry_after_header()
    {
        using var factory = new ApiFactory(settings: Limits());
        var client = factory.CreateClient();
        for (var i = 0; i < 3; i++)
        {
            Assert.Equal(HttpStatusCode.OK, await Get(client));
        }

        var rejected = await client.GetAsync("/api/v1/stats");
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        var retryAfter = int.Parse(rejected.Headers.GetValues("Retry-After").Single());
        Assert.InRange(retryAfter, 1, 60);
        using var body = JsonDocument.Parse(await rejected.Content.ReadAsStringAsync());
        Assert.Equal("rate_limited", body.RootElement.GetProperty("error").GetString());
        Assert.Equal(retryAfter, body.RootElement.GetProperty("retryAfter").GetInt32());
    }

    [Fact]
    public async Task The_forwarded_client_ip_header_is_ignored_unless_configuration_says_a_proxy_is_in_front()
    {
        using var factory = new ApiFactory(settings: Limits());
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++)
        {
            statuses.Add(await Get(factory.CreateClientFor(clientIp: $"203.0.113.{i + 1}")));
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[3]);
    }

    [Fact]
    public async Task A_trusted_forwarded_header_gives_each_client_its_own_bucket()
    {
        var settings = Limits();
        settings["Network:TrustProxyClientIpHeader"] = "true";
        settings["Network:ClientIpHeader"] = "Fly-Client-IP";
        using var factory = new ApiFactory(settings: settings);
        var noisy = factory.CreateClientFor(clientIp: "203.0.113.10");
        for (var i = 0; i < 3; i++)
        {
            await Get(noisy);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, await Get(noisy));
        Assert.Equal(HttpStatusCode.OK, await Get(factory.CreateClientFor(clientIp: "203.0.113.11")));
    }

    [Fact]
    public async Task A_trusted_header_that_is_not_an_ip_address_falls_back_to_the_socket_address()
    {
        var settings = Limits();
        settings["Network:TrustProxyClientIpHeader"] = "true";
        settings["Network:ClientIpHeader"] = "Fly-Client-IP";
        using var factory = new ApiFactory(settings: settings);
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++)
        {
            statuses.Add(await Get(factory.CreateClientFor(clientIp: $"garbage-{i}")));
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[3]);
    }

    [Fact]
    public async Task Authenticated_callers_are_partitioned_by_subject_not_by_address()
    {
        using var factory = new ApiFactory(settings: Limits(apiPermits: 2));
        var alice = factory.CreateClientFor(TestTokens.Web("alice"));
        var bob = factory.CreateClientFor(TestTokens.Web("bob"));
        Assert.Equal(HttpStatusCode.OK, await Get(alice, "/api/v1/me"));
        Assert.Equal(HttpStatusCode.OK, await Get(alice, "/api/v1/me"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await Get(alice, "/api/v1/me"));
        Assert.Equal(HttpStatusCode.OK, await Get(bob, "/api/v1/me"));
    }

    [Fact]
    public async Task Health_probes_are_never_rate_limited()
    {
        using var factory = new ApiFactory(settings: new() { ["RateLimiting:GlobalPermitsPerMinute"] = "1", ["RateLimiting:PublicPermitsPerMinute"] = "1" });
        await factory.WaitReadyAsync();
        var client = factory.CreateClient();
        await Get(client);
        Assert.Equal(HttpStatusCode.TooManyRequests, await Get(client));
        for (var i = 0; i < 10; i++)
        {
            Assert.Equal(HttpStatusCode.OK, await Get(client, "/health"));
            Assert.Equal(HttpStatusCode.OK, await Get(client, "/alive"));
        }
    }

    [Fact]
    public async Task The_global_fallback_covers_endpoints_without_a_named_policy()
    {
        using var factory = new ApiFactory(settings: new() { ["RateLimiting:GlobalPermitsPerMinute"] = "2" });
        var client = factory.CreateClient();
        await Get(client, "/nothing-here");
        await Get(client, "/nothing-here");
        var rejected = await client.GetAsync("/nothing-here");
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
        Assert.Contains("rate_limited", await rejected.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Rejections_are_immediate_not_queued()
    {
        using var factory = new ApiFactory(settings: Limits(publicPermits: 1));
        var client = factory.CreateClient();
        await Get(client);
        var watch = System.Diagnostics.Stopwatch.StartNew();
        Assert.Equal(HttpStatusCode.TooManyRequests, await Get(client));
        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(2));
    }
}
