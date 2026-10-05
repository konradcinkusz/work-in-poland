using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

/// <summary>Operator actions. Every one is logged with the acting subject.</summary>
public sealed class AdminService(ApiDbContext db, EmployerService employer, TimeProvider clock, ILogger<AdminService> logger)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public Task<PageDto<EmployerJobDto>> ListJobsAsync(AdminJobQuery query, CancellationToken ct)
    {
        var (page, limit) = Queries.Clamp(query.Page, query.Limit);
        var jobs = db.Jobs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLowerInvariant();
            jobs = jobs.Where(j => j.Title.ToLower().Contains(term) || j.Company.Name.ToLower().Contains(term));
        }

        return employer.PageOfJobsAsync(jobs, query.Status, page, limit, ct);
    }

    public async Task<EmployerJobDto> UnpublishJobAsync(string actor, Guid id, UnpublishRequest request, CancellationToken ct)
    {
        Validators.EnsureAnnotations(request);
        var job = await LoadJobAsync(id, ct);
        var now = Now;
        if (!Mapper.IsLive(job, now))
        {
            throw new ConflictException("Only a published listing can be unpublished.");
        }

        job.Status = JobStatuses.Closed;
        job.UnpublishReason = request.Reason.Trim();
        job.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Admin {Actor} unpublished job {JobId}: {Reason}", actor, id, job.UnpublishReason);
        return Mapper.ToEmployerJob(job, now);
    }

    public async Task<EmployerJobDto> PromoteJobAsync(string actor, Guid id, PromoteRequest request, CancellationToken ct)
    {
        Validators.EnsureAnnotations(request);
        var job = await LoadJobAsync(id, ct);
        var now = Now;
        if (!Mapper.IsLive(job, now))
        {
            throw new ConflictException("Only a published listing can be promoted.");
        }

        job.PromotedUntil = now.AddDays(request.Days);
        job.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Admin {Actor} promoted job {JobId} for {Days} days", actor, id, request.Days);
        return Mapper.ToEmployerJob(job, now);
    }

    public async Task<PageDto<CompanyDetailDto>> ListCompaniesAsync(AdminCompanyQuery query, CancellationToken ct)
    {
        var (page, limit) = Queries.Clamp(query.Page, query.Limit);
        var companies = db.Companies.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim().ToLowerInvariant();
            companies = companies.Where(c => c.Name.ToLower().Contains(term));
        }

        if (query.Verified is { } verified)
        {
            companies = companies.Where(c => c.IsVerified == verified);
        }

        var total = await companies.CountAsync(ct);
        var items = await companies.OrderBy(c => c.Name).ThenBy(c => c.Id).Skip((page - 1) * limit).Take(limit).ToListAsync(ct);
        return new PageDto<CompanyDetailDto>(items.Select(Mapper.ToDetail).ToList(), total, page, limit);
    }

    public async Task<CompanyDetailDto> SetVerifiedAsync(string actor, Guid id, bool verified, CancellationToken ct)
    {
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Company not found.");
        company.IsVerified = verified;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Admin {Actor} set company {CompanyId} verified={Verified}", actor, id, verified);
        return Mapper.ToDetail(company);
    }

    private async Task<Domain.JobListing> LoadJobAsync(Guid id, CancellationToken ct) =>
        await db.Jobs.Where(j => j.Id == id).Include(j => j.Company).Include(j => j.Salaries).Include(j => j.Skills).AsSplitQuery().FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Job not found.");
}
