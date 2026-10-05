using WorkInPoland.Api.Domain;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

/// <summary>Entity to contract mapping and the read-time lifecycle rules (past expiry means not published).</summary>
public static class Mapper
{
    public static string EffectiveStatus(JobListing job, DateTime now) =>
        job.Status == JobStatuses.Published && job.ExpiresAt is { } expires && expires <= now ? JobStatuses.Expired : job.Status;

    public static bool IsLive(JobListing job, DateTime now) => EffectiveStatus(job, now) == JobStatuses.Published;

    public static CompanyRefDto ToRef(Company c) => new(c.Id, c.Slug, c.Name, c.LogoUrl, c.IsVerified);

    public static SalaryOfferDto ToDto(SalaryOffer s) => new(s.ContractType, s.Min, s.Max, s.Currency, s.Period, s.Basis);

    public static JobSummaryDto ToSummary(JobListing j, DateTime now) => new(
        j.Id, j.Slug, j.Title, ToRef(j.Company), j.Category, j.Seniority, j.WorkMode, j.RemoteScope, j.City,
        j.Salaries.OrderBy(s => s.ContractType).Select(ToDto).ToList(),
        j.Skills.Select(s => s.Name).Order().ToList(),
        j.PromotedUntil > now, j.PublishedAt, j.ExpiresAt);

    public static JobDetailDto ToDetail(JobListing j, DateTime now) => new(
        j.Id, j.Slug, j.Title, ToRef(j.Company), j.Category, j.Seniority, j.WorkMode, j.RemoteScope, j.City,
        j.Salaries.OrderBy(s => s.ContractType).Select(ToDto).ToList(),
        j.Skills.Select(s => s.Name).Order().ToList(),
        j.PromotedUntil > now, j.PublishedAt, j.ExpiresAt, j.Description, j.ApplyUrl);

    public static EmployerJobDto ToEmployerJob(JobListing j, DateTime now) => new(
        j.Id, j.Slug, j.Title, ToRef(j.Company), j.Category, j.Seniority, j.WorkMode, j.RemoteScope, j.City,
        j.Salaries.OrderBy(s => s.ContractType).Select(ToDto).ToList(),
        j.Skills.Select(s => s.Name).Order().ToList(),
        j.PromotedUntil > now, j.PublishedAt, j.ExpiresAt, j.Description, j.ApplyUrl,
        EffectiveStatus(j, now), j.Views, j.ApplyClicks, j.CreatedAt, j.UpdatedAt);

    public static CompanyDetailDto ToDetail(Company c) =>
        new(c.Id, c.Slug, c.Name, c.LogoUrl, c.IsVerified, c.Website, c.Description, c.City, c.Nip, c.CreatedAt);

    /// <summary>Copies a normalised input onto an entity, replacing salaries and diffing skills so keys never collide.</summary>
    public static void Apply(JobListing job, JobInput input)
    {
        job.Title = input.Title;
        job.Description = input.Description ?? string.Empty;
        job.Category = input.Category;
        job.Seniority = input.Seniority;
        job.WorkMode = input.WorkMode;
        job.RemoteScope = input.RemoteScope;
        job.City = input.City;
        job.ApplyUrl = input.ApplyUrl ?? string.Empty;

        job.Salaries.Clear();
        foreach (var s in input.Salaries ?? [])
        {
            job.Salaries.Add(new SalaryOffer
            {
                // No Id on purpose: a key set by hand makes EF track an offer added to a loaded job as Modified.
                ContractType = s.ContractType,
                Min = s.Min,
                Max = s.Max,
                Currency = s.Currency,
                Period = s.Period,
                Basis = s.Basis,
                MonthlyMax = SalaryNormalizer.ToMonthly(s.Max, s.Period),
                MonthlyMidpoint = SalaryNormalizer.Midpoint(s),
            });
        }

        var wanted = (input.Skills ?? []).ToHashSet();
        job.Skills.RemoveAll(s => !wanted.Contains(s.Name));
        foreach (var name in wanted.Except(job.Skills.Select(s => s.Name)).ToList())
        {
            job.Skills.Add(new JobSkill { Name = name });
        }
    }

    /// <summary>The input shape of an existing listing, used to re-validate before publish and renew.</summary>
    public static JobInput ToInput(JobListing j) => new(
        j.CompanyId, j.Title, j.Description, j.Category, j.Seniority, j.WorkMode, j.RemoteScope, j.City,
        j.Salaries.Select(ToDto).ToList(), j.Skills.Select(s => s.Name).ToList(), j.ApplyUrl);
}
