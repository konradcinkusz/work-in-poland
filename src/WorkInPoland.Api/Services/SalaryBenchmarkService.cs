using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

/// <summary>Percentiles over offer midpoints, month-normalised, comparing only the basis a contract type implies.</summary>
public sealed class SalaryBenchmarkService(ApiDbContext db, TimeProvider clock)
{
    public const int MinimumSample = 3;
    private const int MaxSample = 5000;

    public async Task<SalaryBenchmarkDto> GetAsync(BenchmarkQuery query, CancellationToken ct)
    {
        var contractType = string.IsNullOrWhiteSpace(query.ContractType) ? "b2b" : query.ContractType.Trim().ToLowerInvariant();
        var currency = string.IsNullOrWhiteSpace(query.Currency) ? "PLN" : query.Currency.Trim().ToUpperInvariant();
        var errors = new ErrorBag();
        if (!Vocabulary.ContractTypes.Contains(contractType))
        {
            errors.Add("contractType", $"Must be one of: {string.Join(", ", Vocabulary.ContractTypes)}.");
        }

        if (!Vocabulary.Currencies.Contains(currency))
        {
            errors.Add("currency", $"Must be one of: {string.Join(", ", Vocabulary.Currencies)}.");
        }

        errors.ThrowIfAny();

        var basis = SalaryNormalizer.BasisFor(contractType);
        var now = clock.GetUtcNow().UtcDateTime;
        var offers = db.Salaries.AsNoTracking().Where(s => s.Job.Status == JobStatuses.Published && s.Job.ExpiresAt != null && s.Job.ExpiresAt > now
            && s.ContractType == contractType && s.Currency == currency && s.Basis == basis);
        if (!string.IsNullOrWhiteSpace(query.Title))
        {
            var title = query.Title.Trim().ToLowerInvariant();
            offers = offers.Where(s => s.Job.Title.ToLower().Contains(title));
        }

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var category = query.Category.Trim().ToLowerInvariant();
            offers = offers.Where(s => s.Job.Category == category);
        }

        if (!string.IsNullOrWhiteSpace(query.Seniority))
        {
            var seniority = query.Seniority.Trim().ToLowerInvariant();
            offers = offers.Where(s => s.Job.Seniority == seniority);
        }

        if (!string.IsNullOrWhiteSpace(query.City))
        {
            var city = query.City.Trim().ToLowerInvariant();
            offers = offers.Where(s => s.Job.City != null && s.Job.City.ToLower() == city);
        }

        var midpoints = await offers.OrderBy(s => s.MonthlyMidpoint).Select(s => s.MonthlyMidpoint).Take(MaxSample).ToListAsync(ct);
        if (midpoints.Count < MinimumSample)
        {
            return new SalaryBenchmarkDto(midpoints.Count, MinimumSample, currency, contractType, basis, "month", null, null, null, null, null);
        }

        return new SalaryBenchmarkDto(midpoints.Count, MinimumSample, currency, contractType, basis, "month",
            midpoints[0], SalaryNormalizer.Percentile(midpoints, 0.25), SalaryNormalizer.Percentile(midpoints, 0.5),
            SalaryNormalizer.Percentile(midpoints, 0.75), midpoints[^1]);
    }
}
