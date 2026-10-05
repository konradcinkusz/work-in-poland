using System.Linq.Expressions;
using WorkInPoland.Api.Domain;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

public static class Queries
{
    public const int MaxPageSize = 100;
    public const int DefaultPageSize = 20;

    /// <summary>Published and not past expiry: the only jobs the public may see.</summary>
    public static Expression<Func<JobListing, bool>> Live(DateTime now) =>
        j => j.Status == JobStatuses.Published && j.ExpiresAt != null && j.ExpiresAt > now;

    public static (int Page, int Limit) Clamp(int? page, int? limit) =>
        (Math.Max(1, page ?? 1), Math.Clamp(limit ?? DefaultPageSize, 1, MaxPageSize));

    /// <summary>Splits a comma-separated parameter into at most 20 trimmed, lower-cased, distinct values.</summary>
    public static List<string> List(string? value) =>
        (value ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(v => v.ToLowerInvariant()).Distinct().Take(20).ToList();
}
