using System.Globalization;
using System.Net;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace WorkInPoland.ServiceDefaults;

/// <summary>The one place that decides who a request "is" for metering: authenticated sub, else client IP.</summary>
public interface IClientKeyResolver
{
    string Resolve(HttpContext context);
}

public sealed class ClientKeyResolver(IConfiguration configuration) : IClientKeyResolver
{
    private readonly string? _header = configuration["Network:ClientIpHeader"];
    private readonly bool _trustHeader = configuration.GetValue<bool>("Network:TrustProxyClientIpHeader");

    public string Resolve(HttpContext context)
    {
        var sub = context.User.FindFirstValue("sub");
        if (!string.IsNullOrEmpty(sub))
        {
            return "u:" + sub;
        }

        // Only a deployment fact (config says a proxy is in front) makes the header trustworthy.
        if (_trustHeader && !string.IsNullOrWhiteSpace(_header)
            && context.Request.Headers.TryGetValue(_header, out var forwarded)
            && IPAddress.TryParse(forwarded.ToString().Split(',')[0].Trim(), out var address))
        {
            return "ip:" + address;
        }

        return "ip:" + (context.Connection.RemoteIpAddress?.ToString() ?? "unknown");
    }
}

/// <summary>Policies <c>api</c> and <c>public</c>, a per-client global fallback, a process-wide concurrency bound, a uniform 429.</summary>
public static class RateLimitingExtensions
{
    public const string ApiPolicy = "api";
    public const string PublicPolicy = "public";

    public static IServiceCollection AddStandardRateLimiting(this IServiceCollection services)
    {
        services.AddSingleton<IClientKeyResolver, ClientKeyResolver>();
        services.AddSingleton(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var trusted = config.GetValue<bool>("Network:TrustProxyClientIpHeader") && !string.IsNullOrWhiteSpace(config["Network:ClientIpHeader"]);
            return new IntegrationState("clientIpHeader", trusted ? $"trusted ({config["Network:ClientIpHeader"]})" : "ignored (socket address)");
        });
        services.AddRateLimiter(_ => { });
        services.AddOptions<RateLimiterOptions>().Configure<IClientKeyResolver, IConfiguration>((options, resolver, config) =>
        {
            int Setting(string key, int fallback) => Math.Max(1, config.GetValue(key, fallback));
            var api = Setting("RateLimiting:ApiPermitsPerMinute", 240);
            var anonymous = Setting("RateLimiting:PublicPermitsPerMinute", 120);
            var overall = Setting("RateLimiting:GlobalPermitsPerMinute", 600);
            var concurrent = Setting("RateLimiting:MaxConcurrentRequests", 200);

            FixedWindowRateLimiterOptions Window(int permits) => new()
            {
                PermitLimit = permits,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            };

            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.GlobalLimiter = PartitionedRateLimiter.CreateChained(
                PartitionedRateLimiter.Create<HttpContext, string>(c => ServiceDefaultsExtensions.IsProbe(c.Request.Path)
                    ? RateLimitPartition.GetNoLimiter("probe")
                    : RateLimitPartition.GetConcurrencyLimiter("process", _ => new ConcurrencyLimiterOptions { PermitLimit = concurrent, QueueLimit = 0 })),
                PartitionedRateLimiter.Create<HttpContext, string>(c => ServiceDefaultsExtensions.IsProbe(c.Request.Path)
                    ? RateLimitPartition.GetNoLimiter("probe")
                    : RateLimitPartition.GetFixedWindowLimiter(resolver.Resolve(c), _ => Window(overall))));
            options.AddPolicy(ApiPolicy, c => RateLimitPartition.GetFixedWindowLimiter(resolver.Resolve(c), _ => Window(api)));
            options.AddPolicy(PublicPolicy, c => RateLimitPartition.GetFixedWindowLimiter(resolver.Resolve(c), _ => Window(anonymous)));
            options.OnRejected = async (context, token) =>
            {
                var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var delay) ? Math.Max(1, (int)Math.Ceiling(delay.TotalSeconds)) : 1;
                context.HttpContext.Response.Headers.RetryAfter = retryAfter.ToString(CultureInfo.InvariantCulture);
                await context.HttpContext.Response.WriteAsJsonAsync(new { error = "rate_limited", retryAfter }, token);
            };
        });
        return services;
    }
}
