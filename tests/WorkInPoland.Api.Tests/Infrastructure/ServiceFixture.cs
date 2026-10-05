using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;

namespace WorkInPoland.Api.Tests.Infrastructure;

/// <summary>Service-level isolation by constructor: one InMemory database per test instance, a fake clock, the real services.</summary>
public sealed class ServiceFixture : IDisposable
{
    public ServiceFixture(JobsOptions? jobs = null)
    {
        Clock = new FakeTimeProvider(new DateTimeOffset(TestData.Now));
        var services = new ServiceCollection();
        var dbName = Guid.NewGuid().ToString();
        services.AddDbContext<ApiDbContext>(o => o.UseInMemoryDatabase(dbName));
        services.AddSingleton<TimeProvider>(Clock);
        services.AddSingleton(Options.Create(jobs ?? new JobsOptions()));
        services.AddLogging();
        services.AddScoped<JobCounters>();
        services.AddScoped<CatalogService>();
        services.AddScoped<SalaryBenchmarkService>();
        services.AddScoped<TrackerService>();
        services.AddScoped<EmployerService>();
        services.AddScoped<AdminService>();
        services.AddScoped<AccountDataService>();
        services.AddScoped<ListingExpirySweep>();
        services.AddScoped<DemoSeeder>();
        Provider = services.BuildServiceProvider();
        Scope = Provider.CreateScope();
    }

    public FakeTimeProvider Clock { get; }

    public ServiceProvider Provider { get; }

    public IServiceScope Scope { get; }

    public ApiDbContext Db => Scope.ServiceProvider.GetRequiredService<ApiDbContext>();

    public T Get<T>() where T : notnull => Scope.ServiceProvider.GetRequiredService<T>();

    /// <summary>A second scope over the same store, so assertions do not read the tracked entities the service just wrote.</summary>
    public ApiDbContext FreshDb() => Provider.CreateScope().ServiceProvider.GetRequiredService<ApiDbContext>();

    public void Dispose()
    {
        Scope.Dispose();
        Provider.Dispose();
    }
}
