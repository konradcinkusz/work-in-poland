using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace WorkInPoland.ServiceDefaults;

/// <summary>Provider selection (P4): PostgreSQL when a connection string exists, otherwise InMemory.</summary>
public static class DatabaseExtensions
{
    public static IServiceCollection AddDatabaseContext<TContext>(
        this IServiceCollection services, IConfiguration configuration, string connectionName, string inMemoryName)
        where TContext : DbContext
    {
        var provider = (configuration["DATABASE_PROVIDER"] ?? configuration["DatabaseProvider"])?.Trim();
        if (string.Equals(provider, "SqlServer", StringComparison.OrdinalIgnoreCase) || string.Equals(provider, "MsSql", StringComparison.OrdinalIgnoreCase))
        {
            throw new NotSupportedException(
                "DATABASE_PROVIDER=SqlServer is not supported: only PostgreSQL and InMemory are implemented. "
                + "This is a recorded deviation, see the deviation register in docs/architecture/00-ARCHITECTURE.md.");
        }

        var connectionString = configuration.GetConnectionString(connectionName);
        var inMemory = string.IsNullOrWhiteSpace(connectionString) || string.Equals(provider, "InMemory", StringComparison.OrdinalIgnoreCase);
        services.AddSingleton(new IntegrationState("database", inMemory ? "inmemory" : "postgresql"));

        if (inMemory)
        {
            // One root per registration: scopes inside a host share data, two hosts never do.
            var root = new InMemoryDatabaseRoot();
            services.AddDbContext<TContext>(o => o
                .UseInMemoryDatabase(inMemoryName, root)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
            return services;
        }

        var normalized = NormalizeConnectionString(connectionString!);
        services.AddDbContext<TContext>(o => o.UseNpgsql(normalized, npgsql =>
        {
            npgsql.EnableRetryOnFailure(maxRetryCount: 10, maxRetryDelay: TimeSpan.FromSeconds(30), errorCodesToAdd: null);
            npgsql.CommandTimeout(60);
        }));
        return services;
    }

    /// <summary>Accepts key/value or <c>postgres://</c> URI form; rewrites Fly's <c>.flycast</c> host to <c>.internal</c>.</summary>
    public static string NormalizeConnectionString(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder();
        if (connectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) || connectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            var uri = new Uri(connectionString);
            var credentials = uri.UserInfo.Split(':', 2);
            builder.Host = uri.Host;
            builder.Port = uri.IsDefaultPort ? 5432 : uri.Port;
            builder.Database = uri.AbsolutePath.Trim('/');
            builder.Username = Uri.UnescapeDataString(credentials[0]);
            builder.Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : null;
        }
        else
        {
            builder.ConnectionString = connectionString;
        }

        const string flycast = ".flycast";
        if (builder.Host is { } host && host.EndsWith(flycast, StringComparison.OrdinalIgnoreCase))
        {
            builder.Host = host[..^flycast.Length] + ".internal";
        }

        builder.Timeout = Math.Max(builder.Timeout, 30);
        return builder.ConnectionString;
    }
}
