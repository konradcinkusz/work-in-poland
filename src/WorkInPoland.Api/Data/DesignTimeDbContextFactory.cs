using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace WorkInPoland.Api.Data;

/// <summary>Used only by <c>dotnet ef</c>: it needs the PostgreSQL provider but must never connect.</summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApiDbContext>
{
    public ApiDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<ApiDbContext>().UseNpgsql("Host=localhost;Database=design_time_only").Options);
}
