using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Domain;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

/// <summary>Handles job listing reports and admin review of those reports.</summary>
public sealed class ReportingService(ApiDbContext db, TimeProvider clock, ILogger<ReportingService> logger)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    /// <summary>Create a new report for a job listing (anonymous).</summary>
    public async Task CreateReportAsync(string jobSlug, JobReportRequest request, CancellationToken ct)
    {
        Validators.EnsureAnnotations(request);

        var job = await db.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.Slug == jobSlug, ct)
            ?? throw new NotFoundException("Job not found.");

        var report = new JobReport
        {
            Id = Guid.NewGuid(),
            JobId = job.Id,
            Reason = request.Reason.ToLowerInvariant(),
            Details = request.Details?.Trim(),
            ContactEmail = request.ContactEmail?.Trim().ToLowerInvariant(),
            Status = "open",
            CreatedAt = Now
        };

        db.JobReports.Add(report);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Job {JobId} ({JobSlug}) reported: reason={Reason}", job.Id, jobSlug, report.Reason);
    }

    /// <summary>List all reports, optionally filtered by status.</summary>
    public async Task<PageDto<JobReportListItemDto>> ListReportsAsync(AdminReportQuery query, CancellationToken ct)
    {
        var (page, limit) = Queries.Clamp(query.Page, query.Limit);
        var reports = db.JobReports.AsNoTracking().Include(r => r.Job).AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            reports = reports.Where(r => r.Status == query.Status.ToLowerInvariant());
        }

        var total = await reports.CountAsync(ct);
        var items = await reports
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(r => new JobReportListItemDto(
                r.Id,
                r.JobId,
                r.Job.Title,
                r.Reason,
                r.Details,
                r.Status,
                r.CreatedAt,
                r.ResolvedAt))
            .ToListAsync(ct);

        return new PageDto<JobReportListItemDto>(items, total, page, limit);
    }

    /// <summary>Resolve a report (mark as actioned or dismissed).</summary>
    public async Task ResolveReportAsync(Guid reportId, string actor, AdminResolveReportRequest request, CancellationToken ct)
    {
        Validators.EnsureAnnotations(request);

        var report = await db.JobReports.FirstOrDefaultAsync(r => r.Id == reportId, ct)
            ?? throw new NotFoundException("Report not found.");

        var now = Now;
        report.Status = request.Outcome.ToLowerInvariant();
        report.ResolvedBy = actor;
        report.ResolveNote = request.Note?.Trim();
        report.ResolvedAt = now;

        // If actioned, unpublish the job
        if (request.Outcome.Equals("actioned", StringComparison.OrdinalIgnoreCase))
        {
            var job = await db.Jobs.FirstOrDefaultAsync(j => j.Id == report.JobId, ct);
            if (job != null && Mapper.IsLive(job, now))
            {
                job.Status = JobStatuses.Closed;
                job.UnpublishReason = $"Reported as {report.Reason}";
                job.UpdatedAt = now;
                logger.LogInformation("Job {JobId} auto-unpublished due to report {ReportId}", job.Id, reportId);
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Admin {Actor} resolved report {ReportId}: {Outcome}", actor, reportId, request.Outcome);
    }
}
