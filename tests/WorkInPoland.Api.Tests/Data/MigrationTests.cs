using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;
using Npgsql;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Domain;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Data;

/// <summary>Runs only when <c>WIP_TEST_POSTGRES</c> holds a connection string (CI sets it; locally use postgres:17-alpine).</summary>
public sealed class PostgresFactAttribute : FactAttribute
{
    public const string Variable = "WIP_TEST_POSTGRES";

    public PostgresFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(Variable)))
        {
            Skip = $"{Variable} is not set; no PostgreSQL to migrate against.";
        }
    }
}

public class MigrationTests
{
    [Fact]
    public void The_model_has_no_changes_the_migrations_do_not_describe()
    {
        using var db = new ApiDbContext(new DbContextOptionsBuilder<ApiDbContext>().UseNpgsql("Host=localhost;Database=never_connected").Options);
        Assert.False(db.Database.HasPendingModelChanges(), "The model changed after the last migration: add a migration.");
    }

    [Fact]
    public void Migrations_are_provider_specific_files_not_ensure_created()
    {
        using var db = new ApiDbContext(new DbContextOptionsBuilder<ApiDbContext>().UseNpgsql("Host=localhost;Database=never_connected").Options);
        var migrations = db.GetService<IMigrationsAssembly>().Migrations;
        Assert.NotEmpty(migrations);
        Assert.Contains(migrations.Keys, k => k.EndsWith("InitialCreate"));
    }

    private static async Task<(string ConnectionString, Func<Task> Drop)> NewDatabaseAsync()
    {
        var admin = Environment.GetEnvironmentVariable(PostgresFactAttribute.Variable)!;
        var name = "wip_test_" + Guid.NewGuid().ToString("N")[..12];
        await using (var connection = new NpgsqlConnection(admin))
        {
            await connection.OpenAsync();
            await using var create = new NpgsqlCommand($"CREATE DATABASE {name}", connection);
            await create.ExecuteNonQueryAsync();
        }

        var cs = new NpgsqlConnectionStringBuilder(admin) { Database = name }.ConnectionString;
        return (cs, async () =>
        {
            NpgsqlConnection.ClearAllPools();
            await using var connection = new NpgsqlConnection(admin);
            await connection.OpenAsync();
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS {name} WITH (FORCE)", connection);
            await drop.ExecuteNonQueryAsync();
        }
        );
    }

    private static ApiDbContext Open(string cs) => new(new DbContextOptionsBuilder<ApiDbContext>().UseNpgsql(cs).Options);

    [PostgresFact]
    public async Task Migrations_apply_to_an_empty_database_and_a_second_apply_is_a_no_op()
    {
        var (cs, drop) = await NewDatabaseAsync();
        try
        {
            await using (var db = Open(cs))
            {
                await db.Database.MigrateAsync();
                Assert.Empty(await db.Database.GetPendingMigrationsAsync());
                Assert.NotEmpty(await db.Database.GetAppliedMigrationsAsync());
            }

            await using (var db = Open(cs))
            {
                var before = (await db.Database.GetAppliedMigrationsAsync()).ToList();
                await db.Database.MigrateAsync();
                Assert.Equal(before, (await db.Database.GetAppliedMigrationsAsync()).ToList());
                Assert.Equal(0, await db.Companies.CountAsync());
            }

            await using var verify = new NpgsqlConnection(cs);
            await verify.OpenAsync();
            await using var tables = new NpgsqlCommand("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", verify);
            var names = new List<string>();
            await using (var reader = await tables.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    names.Add(reader.GetString(0));
                }
            }

            Assert.Contains("Companies", names);
            Assert.Contains("Jobs", names);
            Assert.Contains("Salaries", names);
            Assert.Contains("JobSkills", names);
            Assert.Contains("TrackedJobs", names);
            Assert.Contains("__EFMigrationsHistory", names);
        }
        finally
        {
            await drop();
        }
    }

    [PostgresFact]
    public async Task The_migration_service_applies_the_schema_after_start_and_completes_the_signal()
    {
        var (cs, drop) = await NewDatabaseAsync();
        try
        {
            using var factory = new ApiFactory(settings: new() { ["ConnectionStrings:apidb"] = cs, ["Seed:Demo"] = "true" });
            await factory.WaitReadyAsync();
            var client = factory.CreateClient();
            Assert.Equal("postgresql", System.Text.Json.JsonDocument.Parse(await client.GetStringAsync("/health")).RootElement.GetProperty("integrations").GetProperty("database").GetString());
            for (var i = 0; i < 100 && (await client.GetFromJsonAsync<StatsDto>("/api/v1/stats", System.Text.Json.JsonSerializerOptions.Web))!.PublishedJobs == 0; i++)
            {
                await Task.Delay(100);
            }

            Assert.True((await client.GetFromJsonAsync<StatsDto>("/api/v1/stats", System.Text.Json.JsonSerializerOptions.Web))!.PublishedJobs >= 14);
        }
        finally
        {
            await drop();
        }
    }

    /// <summary>The same queries as the InMemory suite, translated by Npgsql: this is what proves "no client-side filtering".</summary>
    [PostgresFact]
    public async Task The_catalog_queries_translate_and_behave_on_real_postgresql()
    {
        var (cs, drop) = await NewDatabaseAsync();
        try
        {
            var clock = new FakeTimeProvider(new DateTimeOffset(2026, 10, 5, 12, 0, 0, TimeSpan.Zero));
            var services = new ServiceCollection();
            services.AddDbContext<ApiDbContext>(o => o.UseNpgsql(cs));
            services.AddSingleton<TimeProvider>(clock);
            services.AddSingleton(Options.Create(new JobsOptions()));
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
            await using var provider = services.BuildServiceProvider();
            await using (var scope = provider.CreateAsyncScope())
            {
                await scope.ServiceProvider.GetRequiredService<ApiDbContext>().Database.MigrateAsync();
                await scope.ServiceProvider.GetRequiredService<DemoSeeder>().SeedAsync(default);
                Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<DemoSeeder>().SeedAsync(default));
            }

            await using var run = provider.CreateAsyncScope();
            var catalog = run.ServiceProvider.GetRequiredService<CatalogService>();
            Assert.True((await catalog.SearchJobsAsync(new JobSearchQuery(), default)).Total >= 14);
            Assert.Equal("Mobile Developer (Kotlin)", Assert.Single((await catalog.SearchJobsAsync(new JobSearchQuery(Q: "KOTLIN"), default)).Items).Title);
            Assert.All((await catalog.SearchJobsAsync(new JobSearchQuery(Category: "backend,devops", WorkMode: "remote"), default)).Items, j => Assert.Equal("remote", j.WorkMode));
            Assert.NotEmpty((await catalog.SearchJobsAsync(new JobSearchQuery(City: "kraków", Skills: "c#"), default)).Items);
            Assert.NotEmpty((await catalog.SearchJobsAsync(new JobSearchQuery(SalaryMin: 20000, Sort: "salary"), default)).Items);
            Assert.NotEmpty((await catalog.SearchJobsAsync(new JobSearchQuery(Currency: "EUR", SalaryMin: 4000), default)).Items);
            var promoted = (await catalog.SearchJobsAsync(new JobSearchQuery(), default)).Items[0];
            Assert.True(promoted.IsPromoted);
            Assert.Equal(2, (await catalog.SearchJobsAsync(new JobSearchQuery(VerifiedOnly: true), default)).Total);
            Assert.True((await catalog.SearchCompaniesAsync(new CompanyQuery(), default)).Total >= 6);
            Assert.Contains("Warszawa", (await catalog.GetFilterValuesAsync(default)).Cities);
            Assert.True((await catalog.GetStatsAsync(default)).Companies >= 6);

            var detail = await catalog.GetJobAsync(promoted.Slug, default);
            await catalog.GetJobAsync(promoted.Slug, default);
            await catalog.RegisterApplyClickAsync(promoted.Slug, default);
            var mine = await run.ServiceProvider.GetRequiredService<AdminService>().ListJobsAsync(new AdminJobQuery(Q: "senior"), default);
            var counted = mine.Items.Single(j => j.Id == detail.Id);
            Assert.Equal((2, 1), (counted.Views, counted.ApplyClicks));

            var b2b = await run.ServiceProvider.GetRequiredService<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(), default);
            Assert.True(b2b.SampleSize >= 3 && b2b.Median > 0);

            clock.Advance(TimeSpan.FromDays(31));
            Assert.Equal(0, (await catalog.SearchJobsAsync(new JobSearchQuery(), default)).Total);
            Assert.True(await run.ServiceProvider.GetRequiredService<ListingExpirySweep>().SweepAsync(default) >= 14);

            await run.ServiceProvider.GetRequiredService<AccountDataService>().DeleteAsync("demo-seed", new DeleteDataRequest("delete-my-data"), default);
            await using var verify = Open(cs);
            Assert.Equal(0, await verify.Jobs.CountAsync() + await verify.Salaries.CountAsync() + await verify.JobSkills.CountAsync() + await verify.Companies.CountAsync());
        }
        finally
        {
            await drop();
        }
    }
}
