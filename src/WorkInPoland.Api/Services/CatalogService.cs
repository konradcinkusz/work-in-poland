using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

/// <summary>Anonymous reads: job search and detail, companies, filter vocabularies and stats.</summary>
public sealed class CatalogService(ApiDbContext db, JobCounters counters, TimeProvider clock)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public async Task<PageDto<JobSummaryDto>> SearchJobsAsync(JobSearchQuery query, CancellationToken ct)
    {
        var now = Now;
        var (page, limit) = Queries.Clamp(query.Page, query.Limit);
        var jobs = db.Jobs.AsNoTracking().Where(Queries.Live(now));

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLowerInvariant();
            jobs = jobs.Where(j => j.Title.ToLower().Contains(term) || j.Company.Name.ToLower().Contains(term) || j.Skills.Any(s => s.Name.Contains(term)));
        }

        var categories = Queries.List(query.Category);
        if (categories.Count > 0)
        {
            jobs = jobs.Where(j => categories.Contains(j.Category));
        }

        var seniorities = Queries.List(query.Seniority);
        if (seniorities.Count > 0)
        {
            jobs = jobs.Where(j => seniorities.Contains(j.Seniority));
        }

        var workModes = Queries.List(query.WorkMode);
        if (workModes.Count > 0)
        {
            jobs = jobs.Where(j => workModes.Contains(j.WorkMode));
        }

        var scopes = Queries.List(query.RemoteScope);
        if (scopes.Count > 0)
        {
            jobs = jobs.Where(j => j.RemoteScope != null && scopes.Contains(j.RemoteScope));
        }

        var contracts = Queries.List(query.ContractType);
        if (contracts.Count > 0)
        {
            jobs = jobs.Where(j => j.Salaries.Any(s => contracts.Contains(s.ContractType)));
        }

        if (!string.IsNullOrWhiteSpace(query.City))
        {
            var city = query.City.Trim().ToLowerInvariant();
            jobs = jobs.Where(j => j.City != null && j.City.ToLower() == city);
        }

        foreach (var skill in Queries.List(query.Skills).Take(15))
        {
            jobs = jobs.Where(j => j.Skills.Any(s => s.Name == skill));
        }

        var currency = string.IsNullOrWhiteSpace(query.Currency) ? "PLN" : query.Currency.Trim().ToUpperInvariant();
        if (query.SalaryMin is { } minimum)
        {
            jobs = jobs.Where(j => j.Salaries.Any(s => s.Currency == currency && s.MonthlyMax >= minimum));
        }
        else if (!string.IsNullOrWhiteSpace(query.Currency))
        {
            jobs = jobs.Where(j => j.Salaries.Any(s => s.Currency == currency));
        }

        if (query.VerifiedOnly == true)
        {
            jobs = jobs.Where(j => j.Company.IsVerified);
        }

        var total = await jobs.CountAsync(ct);
        var ordered = query.Sort?.Trim().ToLowerInvariant() switch
        {
            "newest" => jobs.OrderByDescending(j => j.PublishedAt).ThenBy(j => j.Id),
            "salary" => jobs.OrderByDescending(j => j.Salaries.Where(s => s.Currency == currency).Max(s => (decimal?)s.MonthlyMax) ?? 0m).ThenBy(j => j.Id),
            _ => jobs.OrderByDescending(j => j.PromotedUntil != null && j.PromotedUntil > now).ThenByDescending(j => j.PublishedAt).ThenBy(j => j.Id),
        };

        var items = await ordered.Skip((page - 1) * limit).Take(limit)
            .Include(j => j.Company).Include(j => j.Salaries).Include(j => j.Skills)
            .AsSplitQuery().ToListAsync(ct);
        return new PageDto<JobSummaryDto>(items.Select(j => Mapper.ToSummary(j, now)).ToList(), total, page, limit);
    }

    public async Task<JobDetailDto> GetJobAsync(string slug, CancellationToken ct)
    {
        var now = Now;
        var job = await LiveBySlug(slug, now, ct);
        await counters.AddViewAsync(job.Id, ct);
        return Mapper.ToDetail(job, now);
    }

    public async Task<ApplyClickDto> RegisterApplyClickAsync(string slug, CancellationToken ct)
    {
        var job = await LiveBySlug(slug, Now, ct);
        await counters.AddApplyClickAsync(job.Id, ct);
        return new ApplyClickDto(job.ApplyUrl);
    }

    public async Task<PageDto<CompanyListItemDto>> SearchCompaniesAsync(CompanyQuery query, CancellationToken ct)
    {
        var now = Now;
        var (page, limit) = Queries.Clamp(query.Page, query.Limit);
        var live = Queries.Live(now);
        var companies = db.Companies.AsNoTracking().Where(c => c.Jobs.AsQueryable().Any(live));
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLowerInvariant();
            companies = companies.Where(c => c.Name.ToLower().Contains(term));
        }

        if (query.VerifiedOnly == true)
        {
            companies = companies.Where(c => c.IsVerified);
        }

        var total = await companies.CountAsync(ct);
        var items = await companies.OrderBy(c => c.Name).ThenBy(c => c.Id).Skip((page - 1) * limit).Take(limit)
            .Select(c => new CompanyListItemDto(c.Id, c.Slug, c.Name, c.LogoUrl, c.IsVerified, c.Jobs.AsQueryable().Count(live)))
            .ToListAsync(ct);
        return new PageDto<CompanyListItemDto>(items, total, page, limit);
    }

    public async Task<CompanyPublicDto> GetCompanyAsync(string slug, CancellationToken ct)
    {
        var now = Now;
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Slug == slug && c.Jobs.Any(j => j.PublishedAt != null), ct)
            ?? throw new NotFoundException("Company not found.");
        var open = await db.Jobs.AsNoTracking().Where(Queries.Live(now)).Where(j => j.CompanyId == company.Id)
            .OrderByDescending(j => j.PublishedAt).Include(j => j.Company).Include(j => j.Salaries).Include(j => j.Skills)
            .AsSplitQuery().ToListAsync(ct);
        return new CompanyPublicDto(company.Id, company.Slug, company.Name, company.LogoUrl, company.IsVerified, company.Website,
            company.Description, company.City, open.Select(j => Mapper.ToSummary(j, now)).ToList());
    }

    public async Task<FilterValuesDto> GetFilterValuesAsync(CancellationToken ct)
    {
        var cities = await db.Jobs.AsNoTracking().Where(Queries.Live(Now)).Where(j => j.City != null)
            .Select(j => j.City!).Distinct().OrderBy(c => c).ToListAsync(ct);
        return new FilterValuesDto(Vocabulary.Categories, Vocabulary.Seniorities, Vocabulary.WorkModes, Vocabulary.RemoteScopes,
            Vocabulary.ContractTypes, Vocabulary.SalaryBases, Vocabulary.SalaryPeriods, Vocabulary.Currencies,
            Vocabulary.JobStatuses, Vocabulary.ApplicationStatuses, cities);
    }

    public async Task<StatsDto> GetStatsAsync(CancellationToken ct)
    {
        var live = Queries.Live(Now);
        var jobs = await db.Jobs.AsNoTracking().Where(live).CountAsync(ct);
        var companies = await db.Companies.AsNoTracking().CountAsync(c => c.Jobs.AsQueryable().Any(live), ct);
        return new StatsDto(jobs, companies);
    }

    private async Task<Domain.JobListing> LiveBySlug(string slug, DateTime now, CancellationToken ct) =>
        await db.Jobs.AsNoTracking().Where(Queries.Live(now)).Where(j => j.Slug == slug)
            .Include(j => j.Company).Include(j => j.Salaries).Include(j => j.Skills).AsSplitQuery().FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Job not found.");
}
