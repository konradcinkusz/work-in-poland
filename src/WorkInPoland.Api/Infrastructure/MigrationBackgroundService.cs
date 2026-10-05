using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Infrastructure;

/// <summary>
/// Applies EF Core migrations after Kestrel is listening (P4), so health probes answer while schema work
/// is in flight. InMemory has no schema, so it only completes the signal.
/// </summary>
public sealed class MigrationBackgroundService(
    IServiceProvider services,
    IHostApplicationLifetime lifetime,
    IMigrationCompletionSignal signal,
    ILogger<MigrationBackgroundService> logger) : BackgroundService
{
    private const int MaxAttempts = 10;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var registration = lifetime.ApplicationStarted.Register(() => started.TrySetResult());
        try
        {
            await started.Task.WaitAsync(stoppingToken);
            for (var attempt = 1; attempt <= MaxAttempts; attempt++)
            {
                try
                {
                    using var scope = services.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
                    if (db.Database.IsRelational())
                    {
                        logger.LogInformation("Applying EF Core migrations (attempt {Attempt}/{Max})...", attempt, MaxAttempts);
                        await db.Database.MigrateAsync(stoppingToken);
                        logger.LogInformation("Database migrations applied.");
                    }

                    signal.SetCompleted();
                    return;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    if (attempt == MaxAttempts)
                    {
                        logger.LogError(ex, "Database migration failed after {Max} attempts; the service stays not-ready.", MaxAttempts);
                        return;
                    }

                    var delay = TimeSpan.FromSeconds(Math.Min(5 * attempt, 30));
                    logger.LogWarning(ex, "Database migration failed (attempt {Attempt}/{Max}); retrying in {Delay}s.", attempt, MaxAttempts, delay.TotalSeconds);
                    await Task.Delay(delay, stoppingToken);
                }
            }
        }
        catch (OperationCanceledException)
        {
            // shutting down
        }
    }
}
