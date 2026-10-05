using Microsoft.Extensions.DependencyInjection.Extensions;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Services;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Infrastructure;

/// <summary>The service's own wiring, one call per capability from Program.cs (P9).</summary>
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApiDatabase(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDatabaseContext<ApiDbContext>(configuration, "apidb", "ApiInMemory");
        services.AddHostedService<MigrationBackgroundService>();
        return services;
    }

    public static IServiceCollection AddApiServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<JobsOptions>().Bind(configuration.GetSection("Jobs"))
            .Validate(o => o.ListingLifetimeDays > 0 && o.MaxPublishedPerCompany > 0, "Jobs:* values must be positive.");
        services.TryAddSingleton(TimeProvider.System);
        services.AddScoped<JobCounters>();
        services.AddScoped<CatalogService>();
        services.AddScoped<SalaryBenchmarkService>();
        services.AddScoped<TrackerService>();
        services.AddScoped<EmployerService>();
        services.AddScoped<AdminService>();
        services.AddScoped<AccountDataService>();
        services.AddScoped<ReportingService>();
        services.AddScoped<ListingExpirySweep>();
        services.AddHostedService<ListingExpiryService>();
        return services;
    }

    public static IServiceCollection AddDemoSeeding(this IServiceCollection services, IConfiguration configuration)
    {
        var enabled = configuration.GetValue<bool>("Seed:Demo");
        services.AddSingleton(new IntegrationState("demoSeed", enabled ? "enabled" : "disabled"));
        if (enabled)
        {
            services.AddScoped<DemoSeeder>();
            services.AddHostedService<DemoSeedService>();
        }

        return services;
    }
}
