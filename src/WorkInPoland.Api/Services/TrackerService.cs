using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Domain;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

/// <summary>The candidate's private notes on jobs. No CV, nothing leaves the platform.</summary>
public sealed class TrackerService(ApiDbContext db, TimeProvider clock)
{
    private static readonly string[] AppliedOrLater = [ApplicationStatuses.Applied, ApplicationStatuses.Interviewing, ApplicationStatuses.Offer];

    public async Task<ItemList<TrackedJobDto>> ListAsync(string userId, string? status, CancellationToken ct)
    {
        var wanted = status?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(wanted) && !Vocabulary.ApplicationStatuses.Contains(wanted))
        {
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["status"] = [$"Must be one of: {string.Join(", ", Vocabulary.ApplicationStatuses)}."] });
        }

        var query = db.TrackedJobs.AsNoTracking().Where(t => t.UserId == userId);
        if (!string.IsNullOrEmpty(wanted))
        {
            query = query.Where(t => t.Status == wanted);
        }

        var rows = await query.OrderByDescending(t => t.UpdatedAt)
            .Include(t => t.Job).ThenInclude(j => j.Company)
            .Include(t => t.Job).ThenInclude(j => j.Salaries)
            .Include(t => t.Job).ThenInclude(j => j.Skills)
            .AsSplitQuery().ToListAsync(ct);
        var now = clock.GetUtcNow().UtcDateTime;
        return new ItemList<TrackedJobDto>(rows.Select(t => ToDto(t, now)).ToList());
    }

    public async Task<TrackedJobDto> UpsertAsync(string userId, Guid jobId, TrackJobRequest request, CancellationToken ct)
    {
        Validators.EnsureAnnotations(request);
        var status = request.Status.Trim().ToLowerInvariant();
        if (!Vocabulary.ApplicationStatuses.Contains(status))
        {
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["status"] = [$"Must be one of: {string.Join(", ", Vocabulary.ApplicationStatuses)}."] });
        }

        var job = await db.Jobs.AsNoTracking().Where(j => j.Id == jobId && j.PublishedAt != null)
            .Include(j => j.Company).Include(j => j.Salaries).Include(j => j.Skills).AsSplitQuery().FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Job not found.");
        var now = clock.GetUtcNow().UtcDateTime;
        var tracked = await db.TrackedJobs.FirstOrDefaultAsync(t => t.UserId == userId && t.JobId == jobId, ct);
        if (tracked is null)
        {
            tracked = new TrackedJob { UserId = userId, JobId = jobId, CreatedAt = now };
            db.TrackedJobs.Add(tracked);
        }

        tracked.Status = status;
        tracked.Notes = request.Notes?.Trim() ?? tracked.Notes;
        tracked.UpdatedAt = now;
        if (tracked.AppliedAt is null && AppliedOrLater.Contains(status))
        {
            tracked.AppliedAt = now;
        }

        await db.SaveChangesAsync(ct);
        return new TrackedJobDto(Mapper.ToSummary(job, now), tracked.Status, tracked.Notes, tracked.AppliedAt, tracked.UpdatedAt);
    }

    public async Task DeleteAsync(string userId, Guid jobId, CancellationToken ct)
    {
        var tracked = await db.TrackedJobs.FirstOrDefaultAsync(t => t.UserId == userId && t.JobId == jobId, ct);
        if (tracked is not null)
        {
            db.TrackedJobs.Remove(tracked);
            await db.SaveChangesAsync(ct);
        }
    }

    private static TrackedJobDto ToDto(TrackedJob t, DateTime now) => new(Mapper.ToSummary(t.Job, now), t.Status, t.Notes, t.AppliedAt, t.UpdatedAt);
}
