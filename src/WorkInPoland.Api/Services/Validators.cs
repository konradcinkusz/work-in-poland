using System.ComponentModel.DataAnnotations;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

/// <summary>The editorial rules of API.md section 7, shared by REST and MCP because both call the services.</summary>
public static class Validators
{
    public const decimal MaxSalary = 10_000_000m;

    public static bool IsHttpsUrl(string? value) =>
        value is { Length: > 0 and <= 500 }
        && Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && string.IsNullOrEmpty(uri.UserInfo);

    public static JobInput Normalize(JobInput input) => input with
    {
        Title = input.Title?.Trim() ?? string.Empty,
        Description = input.Description?.Trim() ?? string.Empty,
        Category = input.Category?.Trim().ToLowerInvariant() ?? string.Empty,
        Seniority = input.Seniority?.Trim().ToLowerInvariant() ?? string.Empty,
        WorkMode = input.WorkMode?.Trim().ToLowerInvariant() ?? string.Empty,
        RemoteScope = Blank(input.RemoteScope)?.ToLowerInvariant(),
        City = Blank(input.City),
        ApplyUrl = input.ApplyUrl?.Trim() ?? string.Empty,
        Skills = (input.Skills ?? []).Select(s => s?.Trim().ToLowerInvariant() ?? string.Empty).Where(s => s.Length > 0).Distinct().ToList(),
        Salaries = (input.Salaries ?? []).Select(s => s with
        {
            ContractType = s.ContractType?.Trim().ToLowerInvariant() ?? string.Empty,
            Currency = s.Currency?.Trim().ToUpperInvariant() ?? string.Empty,
            Period = s.Period?.Trim().ToLowerInvariant() ?? string.Empty,
            Basis = s.Basis?.Trim().ToLowerInvariant() ?? string.Empty,
        }).ToList(),
    };

    /// <summary>A draft is checked for shape only; <paramref name="publish"/> applies every rule.</summary>
    public static void ValidateJob(JobInput job, bool publish, ErrorBag errors)
    {
        if (job.Title.Length == 0 || job.Title.Length > 120 || (publish && job.Title.Length < 5))
        {
            errors.Add("title", publish ? "Title must be 5-120 characters." : "Title is required (at most 120 characters).");
        }

        var description = job.Description ?? string.Empty;
        if (description.Length > 20_000 || (publish && description.Length < 50))
        {
            errors.Add("description", publish ? "Description must be 50-20000 characters." : "Description must be at most 20000 characters.");
        }

        OneOf(errors, "category", job.Category, Vocabulary.Categories);
        OneOf(errors, "seniority", job.Seniority, Vocabulary.Seniorities);
        OneOf(errors, "workMode", job.WorkMode, Vocabulary.WorkModes);
        if (job.RemoteScope is not null)
        {
            OneOf(errors, "remoteScope", job.RemoteScope, Vocabulary.RemoteScopes);
        }

        if (job.WorkMode == "remote")
        {
            if (publish && job.RemoteScope is null)
            {
                errors.Add("remoteScope", "Remote jobs require a remoteScope (poland, eu or worldwide).");
            }
        }
        else
        {
            if (job.RemoteScope is not null)
            {
                errors.Add("remoteScope", "remoteScope is only allowed when workMode is remote.");
            }

            if (publish && job.City is null)
            {
                errors.Add("city", "City is required unless the job is remote.");
            }
        }

        if (job.City is { Length: > 100 })
        {
            errors.Add("city", "City must be at most 100 characters.");
        }

        var applyUrl = job.ApplyUrl ?? string.Empty;
        if (applyUrl.Length > 0 ? !IsHttpsUrl(applyUrl) : publish)
        {
            errors.Add("applyUrl", "applyUrl must be an absolute https URL (at most 500 characters) without credentials.");
        }

        var skills = job.Skills ?? [];
        if (skills.Count > 15 || (publish && skills.Count == 0))
        {
            errors.Add("skills", "Provide 1-15 skills.");
        }

        if (skills.Any(s => s.Length > 40))
        {
            errors.Add("skills", "Each skill must be 1-40 characters.");
        }

        ValidateSalaries(job.Salaries ?? [], publish, errors);
    }

    private static void ValidateSalaries(IReadOnlyList<SalaryOfferDto> salaries, bool publish, ErrorBag errors)
    {
        if (salaries.Count > 4 || (publish && salaries.Count == 0))
        {
            errors.Add("salaries", "A listing needs a salary range: provide 1-4 offers.");
        }

        if (salaries.GroupBy(s => s.ContractType).Any(g => g.Count() > 1))
        {
            errors.Add("salaries", "At most one salary offer per contractType.");
        }

        for (var i = 0; i < salaries.Count; i++)
        {
            var s = salaries[i];
            var key = $"salaries[{i}]";
            OneOf(errors, key + ".contractType", s.ContractType, Vocabulary.ContractTypes);
            OneOf(errors, key + ".currency", s.Currency, Vocabulary.Currencies);
            OneOf(errors, key + ".period", s.Period, Vocabulary.SalaryPeriods);
            OneOf(errors, key + ".basis", s.Basis, Vocabulary.SalaryBases);
            if (s.Min < 0 || (publish && s.Min <= 0))
            {
                errors.Add(key + ".min", "min must be greater than 0.");
            }

            if (s.Max < s.Min)
            {
                errors.Add(key + ".max", "max must be greater than or equal to min.");
            }

            if (s.Max > MaxSalary)
            {
                errors.Add(key + ".max", "max must be at most 10000000.");
            }

            if (decimal.Round(s.Min, 2) != s.Min || decimal.Round(s.Max, 2) != s.Max)
            {
                errors.Add(key, "Amounts may have at most 2 decimals.");
            }
        }
    }

    public static CompanyInput Normalize(CompanyInput input) => input with
    {
        Name = input.Name?.Trim() ?? string.Empty,
        Website = input.Website?.Trim() ?? string.Empty,
        Description = Blank(input.Description),
        City = Blank(input.City),
        LogoUrl = Blank(input.LogoUrl),
        Nip = Blank(input.Nip),
    };

    public static void ValidateCompany(CompanyInput company, ErrorBag errors)
    {
        if (company.Name.Length is < 2 or > 120)
        {
            errors.Add("name", "Name must be 2-120 characters.");
        }

        if (!IsHttpsUrl(company.Website))
        {
            errors.Add("website", "website must be an absolute https URL (at most 500 characters) without credentials.");
        }

        if (company.LogoUrl is not null && !IsHttpsUrl(company.LogoUrl))
        {
            errors.Add("logoUrl", "logoUrl must be an absolute https URL (at most 500 characters) without credentials.");
        }

        if (company.Description is { Length: > 2000 })
        {
            errors.Add("description", "Description must be at most 2000 characters.");
        }

        if (company.City is { Length: > 100 })
        {
            errors.Add("city", "City must be at most 100 characters.");
        }

        if (company.Nip is not null && !Nip.IsValid(company.Nip))
        {
            errors.Add("nip", "nip must be 10 digits with a valid checksum.");
        }
    }

    /// <summary>Validates a DataAnnotations-decorated request record (the MCP edge has no endpoint filter).</summary>
    public static void EnsureAnnotations(object request)
    {
        var results = new List<ValidationResult>();
        if (Validator.TryValidateObject(request, new ValidationContext(request), results, validateAllProperties: true))
        {
            return;
        }

        var errors = new ErrorBag();
        foreach (var result in results)
        {
            foreach (var member in result.MemberNames.DefaultIfEmpty("request"))
            {
                errors.Add(char.ToLowerInvariant(member[0]) + member[1..], result.ErrorMessage ?? "Invalid value.");
            }
        }

        errors.ThrowIfAny();
    }

    private static void OneOf(ErrorBag errors, string field, string? value, string[] allowed)
    {
        if (value is null || !allowed.Contains(value))
        {
            errors.Add(field, $"Must be one of: {string.Join(", ", allowed)}.");
        }
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
