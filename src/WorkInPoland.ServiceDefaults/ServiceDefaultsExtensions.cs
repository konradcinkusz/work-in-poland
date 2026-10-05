using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace WorkInPoland.ServiceDefaults;

/// <summary>Telemetry, health, discovery, resilience and the migration signal: what every service gets (P2, P2a).</summary>
public static class ServiceDefaultsExtensions
{
    private static readonly string[] ProbePaths = ["/health", "/alive"];

    public static TBuilder AddServiceDefaults<TBuilder>(this TBuilder builder) where TBuilder : IHostApplicationBuilder
    {
        builder.ConfigureOpenTelemetry();
        builder.Services.AddSingleton<IMigrationCompletionSignal, MigrationCompletionSignal>();
        builder.Services.AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy(), ["live"])
            .AddCheck<MigrationHealthCheck>("migrations", tags: ["ready"]);
        builder.Services.AddServiceDiscovery();
        builder.Services.ConfigureHttpClientDefaults(http =>
        {
            http.AddStandardResilienceHandler();
            http.AddServiceDiscovery();
        });
        return builder;
    }

    private static void ConfigureOpenTelemetry(this IHostApplicationBuilder builder)
    {
        var otlp = !string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]);
        builder.Services.AddSingleton(new IntegrationState("telemetry", otlp ? "otlp" : "disabled"));
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        var telemetry = builder.Services.AddOpenTelemetry()
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation())
            .WithTracing(tracing => tracing
                .AddSource(builder.Environment.ApplicationName)
                .AddAspNetCoreInstrumentation(o => o.Filter = ctx => !IsProbe(ctx.Request.Path))
                .AddHttpClientInstrumentation());
        if (otlp)
        {
            telemetry.UseOtlpExporter();
        }
    }

    /// <summary>True for the liveness/readiness probes, which tracing and rate limiting both ignore.</summary>
    public static bool IsProbe(PathString path) => ProbePaths.Any(p => path.StartsWithSegments(p));

    /// <summary><c>/health</c> (readiness + integration report) and <c>/alive</c> (liveness), plus the startup banner.</summary>
    public static WebApplication MapDefaultEndpoints(this WebApplication app)
    {
        app.MapHealthChecks("/health", new HealthCheckOptions { ResponseWriter = WriteReportAsync }).DisableRateLimiting();
        app.MapHealthChecks("/alive", new HealthCheckOptions { Predicate = r => r.Tags.Contains("live") }).DisableRateLimiting();
        app.Lifetime.ApplicationStarted.Register(() =>
        {
            var states = app.Services.GetServices<IntegrationState>().Select(s => $"  {s.Name,-16} {s.State}");
            app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup")
                .LogInformation("{Application} integrations:{NewLine}{States}", app.Environment.ApplicationName, Environment.NewLine, string.Join(Environment.NewLine, states));
        });
        return app;
    }

    private static Task WriteReportAsync(HttpContext context, HealthReport report)
    {
        var integrations = new Dictionary<string, string>();
        foreach (var state in context.RequestServices.GetServices<IntegrationState>())
        {
            integrations[state.Name] = state.State;
        }

        context.Response.ContentType = "application/json";
        var body = new
        {
            status = report.Status.ToString().ToLowerInvariant(),
            integrations,
            checks = report.Entries.ToDictionary(e => e.Key, e => e.Value.Status.ToString().ToLowerInvariant()),
        };
        return context.Response.WriteAsync(JsonSerializer.Serialize(body, JsonSerializerOptions.Web));
    }
}

internal sealed class MigrationHealthCheck(IMigrationCompletionSignal signal) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        Task.FromResult(signal.IsCompleted ? HealthCheckResult.Healthy("schema is ready") : HealthCheckResult.Unhealthy("schema is not ready yet"));
}
