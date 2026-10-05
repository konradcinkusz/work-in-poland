using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Domain;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

/// <summary>Companies and listings of one employer. Someone else's id is always a 404, never a 403.</summary>
public sealed class EmployerService(ApiDbContext db, TimeProvider clock, IOptions<JobsOptions> jobs)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public async Task<IReadOnlyList<CompanyDetailDto>> ListCompaniesAsync(string userId, CancellationToken ct) =>
        (await db.Companies.AsNoTracking().Where(c => c.OwnerUserId == userId).OrderBy(c => c.Name).ToListAsync(ct)).Select(Mapper.ToDetail).ToList();

    public async Task<CompanyDetailDto> CreateCompanyAsync(string userId, CompanyInput input, CancellationToken ct)
    {
        var company = Validators.Normalize(input);
        var errors = new ErrorBag();
        Validators.ValidateCompany(company, errors);
        errors.ThrowIfAny();

        var entity = new Company
        {
            Id = Guid.NewGuid(),
            OwnerUserId = userId,
            CreatedAt = Now,
            Slug = await UniqueCompanySlugAsync(company.Name, ct),
        };
        Copy(entity, company);
        db.Companies.Add(entity);
        await db.SaveChangesAsync(ct);
        return Mapper.ToDetail(entity);
    }

    public async Task<CompanyDetailDto> UpdateCompanyAsync(string userId, Guid id, CompanyInput input, CancellationToken ct)
    {
        var entity = await OwnedCompanyAsync(userId, id, ct);
        var company = Validators.Normalize(input);
        var errors = new ErrorBag();
        Validators.ValidateCompany(company, errors);
        errors.ThrowIfAny();

        if (entity.Name != company.Name || entity.Nip != company.Nip)
        {
            entity.IsVerified = false;
        }

        Copy(entity, company);
        await db.SaveChangesAsync(ct);
        return Mapper.ToDetail(entity);
    }

    public async Task<PageDto<EmployerJobDto>> ListJobsAsync(string userId, EmployerJobQuery query, CancellationToken ct)
    {
        var (page, limit) = Queries.Clamp(query.Page, query.Limit);
        var jobs = db.Jobs.AsNoTracking().Where(j => j.Company.OwnerUserId == userId);
        if (query.CompanyId is { } companyId)
        {
            jobs = jobs.Where(j => j.CompanyId == companyId);
        }

        return await PageOfJobsAsync(jobs, query.Status, page, limit, ct);
    }

    public async Task<EmployerJobDto> GetJobAsync(string userId, Guid id, CancellationToken ct) =>
        Mapper.ToEmployerJob(await OwnedJobAsync(userId, id, asNoTracking: true, ct), Now);

    public async Task<EmployerJobDto> CreateJobAsync(string userId, JobInput input, CancellationToken ct)
    {
        var company = await OwnedCompanyAsync(userId, input.CompanyId, ct);
        var job = Validators.Normalize(input);
        var errors = new ErrorBag();
        Validators.ValidateJob(job, job.Publish, errors);
        errors.ThrowIfAny();

        var now = Now;
        var entity = new JobListing
        {
            Id = Guid.NewGuid(),
            CompanyId = company.Id,
            Company = company,
            Status = JobStatuses.Draft,
            CreatedAt = now,
            UpdatedAt = now,
            Slug = await UniqueJobSlugAsync(job.Title, company.Name, ct),
        };
        Mapper.Apply(entity, job);
        if (job.Publish)
        {
            await PublishCoreAsync(entity, now, ct);
        }

        db.Jobs.Add(entity);
        await db.SaveChangesAsync(ct);
        return Mapper.ToEmployerJob(entity, now);
    }

    public async Task<EmployerJobDto> UpdateJobAsync(string userId, Guid id, JobInput input, CancellationToken ct)
    {
        var entity = await OwnedJobAsync(userId, id, asNoTracking: false, ct);
        var now = Now;
        var status = Mapper.EffectiveStatus(entity, now);
        if (status is JobStatuses.Closed or JobStatuses.Expired)
        {
            throw new ConflictException($"A {status} listing cannot be edited. Renew it first.");
        }

        if (input.CompanyId != entity.CompanyId)
        {
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["companyId"] = ["A listing cannot move to another company."] });
        }

        var job = Validators.Normalize(input);
        var errors = new ErrorBag();
        Validators.ValidateJob(job, publish: status == JobStatuses.Published, errors);
        errors.ThrowIfAny();

        Mapper.Apply(entity, job);
        entity.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        return Mapper.ToEmployerJob(entity, now);
    }

    public async Task<EmployerJobDto> PublishJobAsync(string userId, Guid id, CancellationToken ct)
    {
        var entity = await OwnedJobAsync(userId, id, asNoTracking: false, ct);
        if (entity.Status != JobStatuses.Draft)
        {
            throw new ConflictException("Only a draft can be published. Use renew for a closed or expired listing.");
        }

        var now = Now;
        await PublishCoreAsync(entity, now, ct);
        await db.SaveChangesAsync(ct);
        return Mapper.ToEmployerJob(entity, now);
    }

    public async Task<EmployerJobDto> CloseJobAsync(string userId, Guid id, CancellationToken ct)
    {
        var entity = await OwnedJobAsync(userId, id, asNoTracking: false, ct);
        var now = Now;
        if (!Mapper.IsLive(entity, now))
        {
            throw new ConflictException("Only a published listing can be closed.");
        }

        entity.Status = JobStatuses.Closed;
        entity.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
        return Mapper.ToEmployerJob(entity, now);
    }

    public async Task<EmployerJobDto> RenewJobAsync(string userId, Guid id, CancellationToken ct)
    {
        var entity = await OwnedJobAsync(userId, id, asNoTracking: false, ct);
        if (entity.Status == JobStatuses.Draft)
        {
            throw new ConflictException("A draft has to be published, not renewed.");
        }

        if (entity.UnpublishReason is not null)
        {
            throw new ConflictException("This listing was unpublished by a moderator and cannot be renewed.");
        }

        var now = Now;
        await PublishCoreAsync(entity, now, ct);
        await db.SaveChangesAsync(ct);
        return Mapper.ToEmployerJob(entity, now);
    }

    public async Task DeleteJobAsync(string userId, Guid id, CancellationToken ct)
    {
        var entity = await OwnedJobAsync(userId, id, asNoTracking: false, ct);
        if (entity.Status != JobStatuses.Draft)
        {
            throw new ConflictException("Only drafts can be deleted; close a published listing instead.");
        }

        db.Jobs.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Full section 7 validation, the per-company cap, then the status and dates of a published listing.</summary>
    private async Task PublishCoreAsync(JobListing entity, DateTime now, CancellationToken ct)
    {
        var errors = new ErrorBag();
        Validators.ValidateJob(Mapper.ToInput(entity), publish: true, errors);
        errors.ThrowIfAny();

        var live = Queries.Live(now);
        var others = await db.Jobs.Where(j => j.CompanyId == entity.CompanyId && j.Id != entity.Id).CountAsync(live, ct);
        if (others >= jobs.Value.MaxPublishedPerCompany)
        {
            throw new ConflictException($"A company can have at most {jobs.Value.MaxPublishedPerCompany} published listings. Close one first.");
        }

        entity.Status = JobStatuses.Published;
        entity.PublishedAt = now;
        entity.ExpiresAt = now.AddDays(jobs.Value.ListingLifetimeDays);
        entity.UpdatedAt = now;
    }

    internal async Task<PageDto<EmployerJobDto>> PageOfJobsAsync(IQueryable<JobListing> jobs, string? status, int page, int limit, CancellationToken ct)
    {
        var now = Now;
        var wanted = status?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(wanted))
        {
            if (!Vocabulary.JobStatuses.Contains(wanted))
            {
                throw new ValidationFailedException(new Dictionary<string, string[]> { ["status"] = [$"Must be one of: {string.Join(", ", Vocabulary.JobStatuses)}."] });
            }

            // "expired" includes published rows the sweep has not reached yet; "published" excludes them.
            jobs = wanted switch
            {
                JobStatuses.Published => jobs.Where(Queries.Live(now)),
                JobStatuses.Expired => jobs.Where(j => j.Status == JobStatuses.Expired || (j.Status == JobStatuses.Published && j.ExpiresAt != null && j.ExpiresAt <= now)),
                _ => jobs.Where(j => j.Status == wanted),
            };
        }

        var total = await jobs.CountAsync(ct);
        var items = await jobs.OrderByDescending(j => j.UpdatedAt).ThenBy(j => j.Id).Skip((page - 1) * limit).Take(limit)
            .Include(j => j.Company).Include(j => j.Salaries).Include(j => j.Skills).AsSplitQuery().ToListAsync(ct);
        return new PageDto<EmployerJobDto>(items.Select(j => Mapper.ToEmployerJob(j, now)).ToList(), total, page, limit);
    }

    private static void Copy(Company entity, CompanyInput input)
    {
        entity.Name = input.Name;
        entity.Website = input.Website;
        entity.Description = input.Description;
        entity.City = input.City;
        entity.LogoUrl = input.LogoUrl;
        entity.Nip = input.Nip;
    }

    private async Task<Company> OwnedCompanyAsync(string userId, Guid id, CancellationToken ct) =>
        await db.Companies.FirstOrDefaultAsync(c => c.Id == id && c.OwnerUserId == userId, ct)
        ?? throw new NotFoundException("Company not found.");

    private async Task<JobListing> OwnedJobAsync(string userId, Guid id, bool asNoTracking, CancellationToken ct)
    {
        var query = db.Jobs.Where(j => j.Id == id && j.Company.OwnerUserId == userId)
            .Include(j => j.Company).Include(j => j.Salaries).Include(j => j.Skills).AsSplitQuery();
        return await (asNoTracking ? query.AsNoTracking() : query).FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Job not found.");
    }

    private async Task<string> UniqueCompanySlugAsync(string name, CancellationToken ct)
    {
        var baseSlug = Slugs.Slugify(name, 100);
        if (baseSlug.Length == 0)
        {
            baseSlug = "company";
        }

        var slug = baseSlug;
        for (var n = 2; await db.Companies.AnyAsync(c => c.Slug == slug, ct); n++)
        {
            slug = $"{baseSlug}-{n}";
        }

        return slug;
    }

    private async Task<string> UniqueJobSlugAsync(string title, string companyName, CancellationToken ct)
    {
        string slug;
        do
        {
            slug = Slugs.ForJob(title, companyName);
        }
        while (await db.Jobs.AnyAsync(j => j.Slug == slug, ct));
        return slug;
    }
}
