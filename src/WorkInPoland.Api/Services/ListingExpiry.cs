using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;
using WorkInPoland.Contracts;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Services;

/// <summary>Marks published listings past their expiry as expired. Reads never depend on this: they check the date themselves.</summary>
public sealed class ListingExpirySweep(ApiDbContext db, TimeProvider clock)
{
    public async Task<int> SweepAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var overdue = db.Jobs.Where(j => j.Status == JobStatuses.Published && j.ExpiresAt != null && j.ExpiresAt <= now);
        if (db.Database.IsRelational())
        {
            return await overdue.ExecuteUpdateAsync(s => s.SetProperty(j => j.Status, JobStatuses.Expired).SetProperty(j => j.UpdatedAt, now), ct);
        }

        var jobs = await overdue.ToListAsync(ct);
        foreach (var job in jobs)
        {
            job.Status = JobStatuses.Expired;
            job.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
        return jobs.Count;
    }
}

public sealed class ListingExpiryService(
    IServiceProvider services,
    IMigrationCompletionSignal signal,
    TimeProvider clock,
    ILogger<ListingExpiryService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await signal.WaitAsync(stoppingToken);
            using var timer = new PeriodicTimer(TimeSpan.FromHours(1), clock);
            do
            {
                try
                {
                    using var scope = services.CreateScope();
                    var expired = await scope.ServiceProvider.GetRequiredService<ListingExpirySweep>().SweepAsync(stoppingToken);
                    if (expired > 0)
                    {
                        logger.LogInformation("Marked {Count} listing(s) as expired.", expired);
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "Listing expiry sweep failed; it will run again in an hour.");
                }
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException)
        {
            // shutting down
        }
    }
}
