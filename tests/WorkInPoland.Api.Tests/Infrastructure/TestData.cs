using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Domain;
using WorkInPoland.Api.Services;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Infrastructure;

public static class TestData
{
    public static readonly DateTime Now = new(2026, 10, 5, 12, 0, 0, DateTimeKind.Utc);

    public static SalaryOfferDto B2b(decimal min = 18000, decimal max = 24000, string currency = "PLN", string period = "month") =>
        new("b2b", min, max, currency, period, "net");

    public static SalaryOfferDto Uop(decimal min = 14000, decimal max = 18000) => new("uop", min, max, "PLN", "month", "gross");

    public static string LongDescription => "Opis stanowiska pracy w języku polskim, który ma więcej niż pięćdziesiąt znaków.";

    public static CompanyInput CompanyInput(string name = "Acme sp. z o.o.", string? nip = null) =>
        new(name, "https://acme.example", "Opis firmy", "Warszawa", null, nip);

    public static JobInput JobInput(Guid companyId, string title = "Senior Backend Engineer", bool publish = true, string workMode = "hybrid",
        string? city = "Warszawa", string? scope = null, IReadOnlyList<SalaryOfferDto>? salaries = null, IReadOnlyList<string>? skills = null, string category = "backend", string seniority = "senior") =>
        new(companyId, title, LongDescription, category, seniority, workMode, scope, city, salaries ?? [B2b()], skills ?? ["c#", "postgresql"], "https://acme.example/jobs/1", publish);

    public static Company Company(string name = "Acme sp. z o.o.", string owner = "owner-1", bool verified = false) => new()
    {
        Id = Guid.NewGuid(),
        Slug = Slugs.Slugify(name) + "-" + Guid.NewGuid().ToString("N")[..4],
        Name = name,
        Website = "https://acme.example",
        OwnerUserId = owner,
        IsVerified = verified,
        CreatedAt = Now,
    };

    /// <summary>A published listing inserted directly (the services have their own tests); expiry is 30 days after <see cref="Now"/>.</summary>
    public static JobListing Job(Company company, string title = "Backend Developer", string category = "backend", string seniority = "mid",
        string workMode = "hybrid", string? scope = null, string? city = "Warszawa", string[]? skills = null, SalaryOfferDto[]? salaries = null,
        string status = JobStatuses.Published, DateTime? publishedAt = null, DateTime? expiresAt = null, DateTime? promotedUntil = null)
    {
        var job = new JobListing
        {
            Id = Guid.NewGuid(),
            Slug = Slugs.Slugify(title) + "-" + Guid.NewGuid().ToString("N")[..6],
            Company = company,
            CompanyId = company.Id,
            Status = status,
            CreatedAt = Now,
            UpdatedAt = Now,
            PublishedAt = publishedAt ?? Now,
            ExpiresAt = expiresAt ?? Now.AddDays(30),
            PromotedUntil = promotedUntil,
        };
        Mapper.Apply(job, new JobInput(company.Id, title, LongDescription, category, seniority, workMode, scope, city,
            salaries ?? [B2b()], skills ?? ["c#"], "https://acme.example/apply"));
        return job;
    }

    public static async Task<(Company Company, List<JobListing> Jobs)> SeedAsync(ApiDbContext db, Company company, params JobListing[] jobs)
    {
        db.Companies.Add(company);
        db.Jobs.AddRange(jobs);
        await db.SaveChangesAsync();
        return (company, jobs.ToList());
    }

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(JsonSerializerOptions.Web))!;

    public static Task<HttpResponseMessage> PutJsonAsync<T>(this HttpClient client, string url, T body) => client.PutAsJsonAsync(url, body, JsonSerializerOptions.Web);

    public static Task<HttpResponseMessage> PostJsonAsync<T>(this HttpClient client, string url, T body) => client.PostAsJsonAsync(url, body, JsonSerializerOptions.Web);
}

public static class HttpExtensions
{
    public static T? GetFromJsonSafe<T>(this HttpClient client, string url)
    {
        try
        {
            return client.GetFromJsonAsync<T>(url, System.Text.Json.JsonSerializerOptions.Web).GetAwaiter().GetResult();
        }
        catch (HttpRequestException)
        {
            return default;
        }
    }
}
