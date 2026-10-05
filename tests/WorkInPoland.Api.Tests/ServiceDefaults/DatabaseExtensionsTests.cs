using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WorkInPoland.Api.Data;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Tests.ServiceDefaults;

public class DatabaseExtensionsTests
{
    private static IConfiguration Config(params (string, string?)[] pairs) =>
        new ConfigurationBuilder().AddInMemoryCollection(pairs.ToDictionary(p => p.Item1, p => p.Item2)).Build();

    [Theory]
    [InlineData("SqlServer")]
    [InlineData("sqlserver")]
    [InlineData("MsSql")]
    public void SqlServer_fails_with_a_message_pointing_at_the_deviation_register(string provider)
    {
        var ex = Assert.Throws<NotSupportedException>(() =>
            new ServiceCollection().AddDatabaseContext<ApiDbContext>(Config(("DATABASE_PROVIDER", provider), ("ConnectionStrings:apidb", "Host=x")), "apidb", "t"));
        Assert.Contains("deviation register", ex.Message);
        Assert.Contains("SqlServer", ex.Message);
    }

    [Fact]
    public void Without_a_connection_string_the_context_is_InMemory_and_reported_as_such()
    {
        var services = new ServiceCollection().AddDatabaseContext<ApiDbContext>(Config(), "apidb", "t");
        using var provider = services.BuildServiceProvider();
        using var db = provider.CreateScope().ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal("Microsoft.EntityFrameworkCore.InMemory", db.Database.ProviderName);
        Assert.Contains(provider.GetServices<IntegrationState>(), s => s is { Name: "database", State: "inmemory" });
    }

    [Fact]
    public void An_empty_connection_string_counts_as_absent() =>
        Assert.Contains(new ServiceCollection().AddDatabaseContext<ApiDbContext>(Config(("ConnectionStrings:apidb", "")), "apidb", "t").BuildServiceProvider().GetServices<IntegrationState>(),
            s => s.State == "inmemory");

    [Fact]
    public void With_a_connection_string_the_context_uses_postgresql_with_retry_and_a_60_second_command_timeout()
    {
        var services = new ServiceCollection().AddDatabaseContext<ApiDbContext>(Config(("ConnectionStrings:apidb", "Host=localhost;Database=x;Username=u")), "apidb", "t");
        using var provider = services.BuildServiceProvider();
        using var db = provider.CreateScope().ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal("Npgsql.EntityFrameworkCore.PostgreSQL", db.Database.ProviderName);
        Assert.Equal(60, db.Database.GetCommandTimeout());
        Assert.True(db.Database.CreateExecutionStrategy().RetriesOnFailure);
        Assert.Contains(provider.GetServices<IntegrationState>(), s => s is { Name: "database", State: "postgresql" });
    }

    [Fact]
    public void Each_host_gets_its_own_InMemory_store()
    {
        using var a = new ServiceCollection().AddDatabaseContext<ApiDbContext>(Config(), "apidb", "same").BuildServiceProvider();
        using var b = new ServiceCollection().AddDatabaseContext<ApiDbContext>(Config(), "apidb", "same").BuildServiceProvider();
        using (var scope = a.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            db.Companies.Add(new Domain.Company { Id = Guid.NewGuid(), Slug = "s", Name = "n" });
            db.SaveChanges();
        }

        Assert.Empty(b.CreateScope().ServiceProvider.GetRequiredService<ApiDbContext>().Companies);
        Assert.Single(a.CreateScope().ServiceProvider.GetRequiredService<ApiDbContext>().Companies);
    }

    [Theory]
    [InlineData("Host=db.flycast;Database=x", "db.internal")]
    [InlineData("Host=db.internal;Database=x", "db.internal")]
    [InlineData("Host=localhost;Database=x", "localhost")]
    [InlineData("postgres://user@db.flycast:5433/app", "db.internal")]
    public void Connection_strings_are_normalised_for_fly(string input, string expectedHost)
    {
        var builder = new Npgsql.NpgsqlConnectionStringBuilder(DatabaseExtensions.NormalizeConnectionString(input));
        Assert.Equal(expectedHost, builder.Host);
        Assert.True(builder.Timeout >= 30);
    }

    [Fact]
    public void A_postgres_uri_is_translated_with_credentials_port_and_database()
    {
        var builder = new Npgsql.NpgsqlConnectionStringBuilder(DatabaseExtensions.NormalizeConnectionString("postgres://user:" + Uri.EscapeDataString("a@b") + "@db.example:5433/app"));
        Assert.Equal(("db.example", 5433, "app", "user", "a@b"), (builder.Host, builder.Port, builder.Database, builder.Username, builder.Password));
    }
}
