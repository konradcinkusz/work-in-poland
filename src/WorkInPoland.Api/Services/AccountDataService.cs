using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

/// <summary>RODO access/portability and erasure of what this service holds about one user (API.md section 4).</summary>
public sealed class AccountDataService(ApiDbContext db, TrackerService tracker, TimeProvider clock)
{
    public async Task<AccountExportDto> ExportAsync(string userId, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var companies = await db.Companies.AsNoTracking().Where(c => c.OwnerUserId == userId).OrderBy(c => c.Name).ToListAsync(ct);
        var jobs = await db.Jobs.AsNoTracking().Where(j => j.Company.OwnerUserId == userId).OrderBy(j => j.CreatedAt)
            .Include(j => j.Company).Include(j => j.Salaries).Include(j => j.Skills).AsSplitQuery().ToListAsync(ct);
        return new AccountExportDto(
            userId,
            now,
            (await tracker.ListAsync(userId, null, ct)).Items,
            companies.Select(Mapper.ToDetail).ToList(),
            jobs.Select(j => Mapper.ToEmployerJob(j, now)).ToList());
    }

    public async Task DeleteAsync(string userId, DeleteDataRequest request, CancellationToken ct)
    {
        if (request.Confirm != DeleteDataRequest.Expected)
        {
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["confirm"] = [$"Send \"{DeleteDataRequest.Expected}\" to confirm."] });
        }

        // Explicit removal so InMemory (which does not cascade to untracked rows) and PostgreSQL behave alike.
        var companies = await db.Companies.Where(c => c.OwnerUserId == userId).Select(c => c.Id).ToListAsync(ct);
        var jobIds = await db.Jobs.Where(j => companies.Contains(j.CompanyId)).Select(j => j.Id).ToListAsync(ct);
        db.TrackedJobs.RemoveRange(await db.TrackedJobs.Where(t => t.UserId == userId || jobIds.Contains(t.JobId)).ToListAsync(ct));
        db.JobSkills.RemoveRange(await db.JobSkills.Where(s => jobIds.Contains(s.JobId)).ToListAsync(ct));
        db.Salaries.RemoveRange(await db.Salaries.Where(s => jobIds.Contains(s.JobId)).ToListAsync(ct));
        db.Jobs.RemoveRange(await db.Jobs.Where(j => jobIds.Contains(j.Id)).ToListAsync(ct));
        db.Companies.RemoveRange(await db.Companies.Where(c => companies.Contains(c.Id)).ToListAsync(ct));
        await db.SaveChangesAsync(ct);
    }
}
