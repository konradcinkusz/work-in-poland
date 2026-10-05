using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;

namespace WorkInPoland.Api.Services;

/// <summary>View and apply-click counters: an atomic SQL increment on relational providers, a tracked update on InMemory.</summary>
public sealed class JobCounters(ApiDbContext db)
{
    public async Task AddViewAsync(Guid jobId, CancellationToken ct)
    {
        if (db.Database.IsRelational())
        {
            await db.Jobs.Where(j => j.Id == jobId).ExecuteUpdateAsync(s => s.SetProperty(j => j.Views, j => j.Views + 1), ct);
            return;
        }

        var job = await db.Jobs.FindAsync([jobId], ct);
        if (job is not null)
        {
            job.Views++;
            await db.SaveChangesAsync(ct);
        }
    }

    public async Task AddApplyClickAsync(Guid jobId, CancellationToken ct)
    {
        if (db.Database.IsRelational())
        {
            await db.Jobs.Where(j => j.Id == jobId).ExecuteUpdateAsync(s => s.SetProperty(j => j.ApplyClicks, j => j.ApplyClicks + 1), ct);
            return;
        }

        var job = await db.Jobs.FindAsync([jobId], ct);
        if (job is not null)
        {
            job.ApplyClicks++;
            await db.SaveChangesAsync(ct);
        }
    }
}
