namespace WorkInPoland.Api.Domain;

public sealed class Company
{
    public Guid Id { get; set; }

    public string Slug { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Website { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? City { get; set; }

    public string? LogoUrl { get; set; }

    public string? Nip { get; set; }

    public string OwnerUserId { get; set; } = string.Empty;

    public bool IsVerified { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<JobListing> Jobs { get; set; } = [];
}

public sealed class JobListing
{
    public Guid Id { get; set; }

    public string Slug { get; set; } = string.Empty;

    public Guid CompanyId { get; set; }

    public Company Company { get; set; } = null!;

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Seniority { get; set; } = string.Empty;

    public string WorkMode { get; set; } = string.Empty;

    public string? RemoteScope { get; set; }

    public string? City { get; set; }

    public string ApplyUrl { get; set; } = string.Empty;

    /// <summary>Stored status; a published job past <see cref="ExpiresAt"/> is expired whatever this says.</summary>
    public string Status { get; set; } = string.Empty;

    public DateTime? PromotedUntil { get; set; }

    public int Views { get; set; }

    public int ApplyClicks { get; set; }

    public string? UnpublishReason { get; set; }

    public DateTime? PublishedAt { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<SalaryOffer> Salaries { get; set; } = [];

    public List<JobSkill> Skills { get; set; } = [];
}

public sealed class JobSkill
{
    public Guid JobId { get; set; }

    public string Name { get; set; } = string.Empty;
}

public sealed class SalaryOffer
{
    public Guid Id { get; set; }

    public Guid JobId { get; set; }

    public JobListing Job { get; set; } = null!;

    public string ContractType { get; set; } = string.Empty;

    public decimal Min { get; set; }

    public decimal Max { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Period { get; set; } = string.Empty;

    public string Basis { get; set; } = string.Empty;

    /// <summary>Normalised to a month at write time so SQL can filter and sort on it.</summary>
    public decimal MonthlyMax { get; set; }

    public decimal MonthlyMidpoint { get; set; }
}

public sealed class TrackedJob
{
    public string UserId { get; set; } = string.Empty;

    public Guid JobId { get; set; }

    public JobListing Job { get; set; } = null!;

    public string Status { get; set; } = string.Empty;

    public string Notes { get; set; } = string.Empty;

    public DateTime? AppliedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}
