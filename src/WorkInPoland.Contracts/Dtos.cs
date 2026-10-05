using System.ComponentModel.DataAnnotations;

namespace WorkInPoland.Contracts;

// Shapes of API.md sections 2-6. Enumerations travel as lowercase strings (Vocabulary).

public sealed record SalaryOfferDto(string ContractType, decimal Min, decimal Max, string Currency, string Period, string Basis);

public sealed record CompanyRefDto(Guid Id, string Slug, string Name, string? LogoUrl, bool IsVerified);

public record JobSummaryDto(
    Guid Id,
    string Slug,
    string Title,
    CompanyRefDto Company,
    string Category,
    string Seniority,
    string WorkMode,
    string? RemoteScope,
    string? City,
    IReadOnlyList<SalaryOfferDto> Salaries,
    IReadOnlyList<string> Skills,
    bool IsPromoted,
    DateTime? PublishedAt,
    DateTime? ExpiresAt);

public record JobDetailDto(
    Guid Id,
    string Slug,
    string Title,
    CompanyRefDto Company,
    string Category,
    string Seniority,
    string WorkMode,
    string? RemoteScope,
    string? City,
    IReadOnlyList<SalaryOfferDto> Salaries,
    IReadOnlyList<string> Skills,
    bool IsPromoted,
    DateTime? PublishedAt,
    DateTime? ExpiresAt,
    string Description,
    string ApplyUrl)
    : JobSummaryDto(Id, Slug, Title, Company, Category, Seniority, WorkMode, RemoteScope, City, Salaries, Skills, IsPromoted, PublishedAt, ExpiresAt);

public sealed record EmployerJobDto(
    Guid Id,
    string Slug,
    string Title,
    CompanyRefDto Company,
    string Category,
    string Seniority,
    string WorkMode,
    string? RemoteScope,
    string? City,
    IReadOnlyList<SalaryOfferDto> Salaries,
    IReadOnlyList<string> Skills,
    bool IsPromoted,
    DateTime? PublishedAt,
    DateTime? ExpiresAt,
    string Description,
    string ApplyUrl,
    string Status,
    int Views,
    int ApplyClicks,
    DateTime CreatedAt,
    DateTime UpdatedAt)
    : JobDetailDto(Id, Slug, Title, Company, Category, Seniority, WorkMode, RemoteScope, City, Salaries, Skills, IsPromoted, PublishedAt, ExpiresAt, Description, ApplyUrl);

public sealed record PageDto<T>(IReadOnlyList<T> Items, int Total, int Page, int Limit);

public sealed record ItemList<T>(IReadOnlyList<T> Items);

// ---- Public ----

public sealed record JobSearchQuery(
    string? Q = null,
    string? Category = null,
    string? Seniority = null,
    string? WorkMode = null,
    string? RemoteScope = null,
    string? ContractType = null,
    string? City = null,
    string? Skills = null,
    decimal? SalaryMin = null,
    string? Currency = null,
    bool? VerifiedOnly = null,
    string? Sort = null,
    int? Page = null,
    int? Limit = null);

public sealed record CompanyListItemDto(Guid Id, string Slug, string Name, string? LogoUrl, bool IsVerified, int OpenJobs);

public sealed record CompanyQuery(string? Q = null, bool? VerifiedOnly = null, int? Page = null, int? Limit = null);

public sealed record CompanyPublicDto(
    Guid Id,
    string Slug,
    string Name,
    string? LogoUrl,
    bool IsVerified,
    string? Website,
    string? Description,
    string? City,
    IReadOnlyList<JobSummaryDto> OpenJobs);

public sealed record BenchmarkQuery(
    string? Title = null,
    string? Category = null,
    string? Seniority = null,
    string? ContractType = null,
    string? Currency = null,
    string? City = null);

public sealed record SalaryBenchmarkDto(
    int SampleSize,
    int MinimumSample,
    string Currency,
    string ContractType,
    string Basis,
    string Period,
    decimal? Min,
    decimal? P25,
    decimal? Median,
    decimal? P75,
    decimal? Max);

public sealed record FilterValuesDto(
    IReadOnlyList<string> Categories,
    IReadOnlyList<string> Seniorities,
    IReadOnlyList<string> WorkModes,
    IReadOnlyList<string> RemoteScopes,
    IReadOnlyList<string> ContractTypes,
    IReadOnlyList<string> SalaryBases,
    IReadOnlyList<string> SalaryPeriods,
    IReadOnlyList<string> Currencies,
    IReadOnlyList<string> JobStatuses,
    IReadOnlyList<string> ApplicationStatuses,
    IReadOnlyList<string> Cities);

public sealed record StatsDto(int PublishedJobs, int Companies);

public sealed record ApplyClickDto(string ApplyUrl);

// ---- Candidate ----

public sealed record TrackedJobDto(JobSummaryDto Job, string Status, string Notes, DateTime? AppliedAt, DateTime UpdatedAt);

public sealed record TrackJobRequest(
    [property: Required] string Status,
    [property: StringLength(2000)] string? Notes = null);

public sealed record AccountExportDto(
    string UserId,
    DateTime ExportedAt,
    IReadOnlyList<TrackedJobDto> Tracker,
    IReadOnlyList<CompanyDetailDto> Companies,
    IReadOnlyList<EmployerJobDto> Jobs);

/// <summary>Must carry <see cref="Expected"/> exactly; anything else is a 400.</summary>
public sealed record DeleteDataRequest(string? Confirm)
{
    public const string Expected = "delete-my-data";
}

public sealed record MeDto(string UserId, string? Email, IReadOnlyList<string> Roles);

// ---- Employer ----

public sealed record CompanyInput(
    string Name,
    string Website,
    string? Description = null,
    string? City = null,
    string? LogoUrl = null,
    string? Nip = null);

public sealed record CompanyDetailDto(
    Guid Id,
    string Slug,
    string Name,
    string? LogoUrl,
    bool IsVerified,
    string Website,
    string? Description,
    string? City,
    string? Nip,
    DateTime CreatedAt);

/// <summary>Job payload. <c>Publish</c> is only read when creating a job.</summary>
public sealed record JobInput(
    Guid CompanyId,
    string Title,
    string? Description,
    string Category,
    string Seniority,
    string WorkMode,
    string? RemoteScope,
    string? City,
    IReadOnlyList<SalaryOfferDto>? Salaries,
    IReadOnlyList<string>? Skills,
    string? ApplyUrl,
    bool Publish = false);

public sealed record EmployerJobQuery(Guid? CompanyId = null, string? Status = null, int? Page = null, int? Limit = null);

// ---- Admin ----

public sealed record AdminJobQuery(string? Status = null, string? Q = null, int? Page = null, int? Limit = null);

public sealed record AdminCompanyQuery(string? Q = null, bool? Verified = null, int? Page = null, int? Limit = null);

public sealed record UnpublishRequest([property: Required, StringLength(500, MinimumLength = 1)] string Reason);

public sealed record PromoteRequest([property: Range(1, 90)] int Days);

// ---- Job Reporting ----

/// <summary>Request to report a job listing (anonymous).</summary>
public sealed record JobReportRequest(
    [property: Required, RegularExpression(@"^(illegal|discrimination|scam|misleading|other)$")] string Reason,
    [property: StringLength(1000)] string? Details = null,
    [property: EmailAddress] string? ContactEmail = null);

/// <summary>Item in the admin list of job reports.</summary>
public sealed record JobReportListItemDto(
    Guid Id,
    Guid JobId,
    string JobTitle,
    string Reason,
    string? Details,
    string Status,
    DateTime CreatedAt,
    DateTime? ResolvedAt);

public sealed record AdminReportQuery(string? Status = null, int? Page = null, int? Limit = null);

/// <summary>Request from admin to resolve a report (mark as actioned or dismissed).</summary>
public sealed record AdminResolveReportRequest(
    [property: Required, RegularExpression(@"^(actioned|dismissed)$")] string Outcome,
    [property: StringLength(1000)] string? Note = null);
