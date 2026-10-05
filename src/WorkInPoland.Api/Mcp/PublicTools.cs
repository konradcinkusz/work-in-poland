using System.ComponentModel;
using ModelContextProtocol.Server;
using WorkInPoland.Api.Services;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Mcp;

/// <summary>Read-only tools served on /mcp (anonymous) and also on /mcp/account.</summary>
[McpServerToolType]
public sealed class PublicTools(CatalogService catalog, SalaryBenchmarkService benchmarks)
{
    [McpServerTool(Name = "search_jobs", ReadOnly = true, Title = "Search jobs in Poland")]
    [Description("Searches currently open job listings in Poland. Every listing states a salary range (mandatory on this platform). Returns JSON: { items: [job summaries], total, page, limit }. Each item has id, slug, title, company, category, seniority, workMode, remoteScope, city, salaries (one per contract type: b2b, uop, zlecenie, dzielo, with min, max, currency, period, basis), skills, isPromoted. Call get_job_details with the slug for the full description and apply link. Filters combine with AND; comma-separated values inside one filter mean OR.")]
    public Task<string> SearchJobs(
        [Description("Free text, case-insensitive, matched against job title, company name and skills.")] string? q = null,
        [Description("Comma-separated categories: backend, frontend, fullstack, mobile, devops, data, ai-ml, qa, security, design, product, project-management, support, other.")] string? category = null,
        [Description("Comma-separated seniority levels: intern, junior, mid, senior, lead.")] string? seniority = null,
        [Description("Comma-separated work modes: remote, hybrid, onsite.")] string? workMode = null,
        [Description("Comma-separated remote scopes (only for remote jobs): poland, eu, worldwide.")] string? remoteScope = null,
        [Description("Comma-separated contract types: uop (employment contract), b2b (contractor invoice), zlecenie (mandate contract), dzielo (specific-task contract).")] string? contractType = null,
        [Description("City name, e.g. Warszawa, Kraków, Wrocław, Gdańsk, Poznań. Case-insensitive exact match.")] string? city = null,
        [Description("Comma-separated skills; a job must list ALL of them, e.g. 'c#,postgresql'.")] string? skills = null,
        [Description("Minimum monthly salary (upper end of the range must reach it). Hourly rates are converted at 168 hours per month and daily rates at 21 days.")] decimal? salaryMin = null,
        [Description("Currency for salaryMin: PLN (default), EUR, USD, GBP, CHF.")] string? currency = null,
        [Description("true to return only jobs of companies verified by the platform.")] bool? verifiedOnly = null,
        [Description("Sort order: relevance (default, promoted first then newest), newest, salary (highest first).")] string? sort = null,
        [Description("Page number, starting at 1.")] int? page = null,
        [Description("Page size 1-100, default 20.")] int? limit = null,
        CancellationToken ct = default) =>
        McpSupport.RunAsync(() => catalog.SearchJobsAsync(
            new JobSearchQuery(q, category, seniority, workMode, remoteScope, contractType, city, skills, salaryMin, currency, verifiedOnly, sort, page, limit), ct));

    [McpServerTool(Name = "get_job_details", ReadOnly = true, Title = "Get one job")]
    [Description("Returns the full listing for one open job: everything search_jobs returns plus description (markdown) and applyUrl. Applying happens on the employer's own site at applyUrl; this platform never takes a CV. Fails if the job is closed, expired or unknown.")]
    public Task<string> GetJobDetails([Description("The job's slug, taken from search_jobs results (field 'slug').")] string slug, CancellationToken ct = default) =>
        McpSupport.RunAsync(() => catalog.GetJobAsync(slug, ct));

    [McpServerTool(Name = "search_companies", ReadOnly = true, Title = "Search hiring companies")]
    [Description("Lists companies that currently have at least one open job. Returns JSON: { items: [{ id, slug, name, logoUrl, isVerified, openJobs }], total, page, limit }.")]
    public Task<string> SearchCompanies(
        [Description("Case-insensitive part of the company name.")] string? q = null,
        [Description("true to return only verified companies.")] bool? verifiedOnly = null,
        [Description("Page number, starting at 1.")] int? page = null,
        [Description("Page size 1-100, default 20.")] int? limit = null,
        CancellationToken ct = default) =>
        McpSupport.RunAsync(() => catalog.SearchCompaniesAsync(new CompanyQuery(q, verifiedOnly, page, limit), ct));

    [McpServerTool(Name = "get_company", ReadOnly = true, Title = "Get one company")]
    [Description("Returns a company profile (name, website, description, city, isVerified) and its currently open jobs as job summaries.")]
    public Task<string> GetCompany([Description("The company's slug, from search_companies or a job's company.slug.")] string slug, CancellationToken ct = default) =>
        McpSupport.RunAsync(() => catalog.GetCompanyAsync(slug, ct));

    [McpServerTool(Name = "get_salary_benchmarks", ReadOnly = true, Title = "Salary benchmarks")]
    [Description("Salary statistics (min, p25, median, p75, max of monthly midpoints) over currently open listings. Only offers with the comparable basis are used: uop is gross, every other contract is net, so gross and net never mix. If fewer than 3 offers match, only sampleSize is returned and every statistic is null: widen the filters.")]
    public Task<string> GetSalaryBenchmarks(
        [Description("Case-insensitive part of the job title, e.g. 'developer'.")] string? title = null,
        [Description("Category, e.g. backend, data, devops.")] string? category = null,
        [Description("Seniority: intern, junior, mid, senior, lead.")] string? seniority = null,
        [Description("Contract type: b2b (default), uop, zlecenie, dzielo.")] string? contractType = null,
        [Description("Currency: PLN (default), EUR, USD, GBP, CHF.")] string? currency = null,
        [Description("City, case-insensitive exact match.")] string? city = null,
        CancellationToken ct = default) =>
        McpSupport.RunAsync(() => benchmarks.GetAsync(new BenchmarkQuery(title, category, seniority, contractType, currency, city), ct));

    [McpServerTool(Name = "list_filter_values", ReadOnly = true, Title = "List filter values")]
    [Description("Lists every accepted value for the search filters (categories, seniorities, workModes, remoteScopes, contractTypes, currencies, ...) and the cities that currently have an open job. Call this first when unsure which value to pass.")]
    public Task<string> ListFilterValues(CancellationToken ct = default) =>
        McpSupport.RunAsync(() => catalog.GetFilterValuesAsync(ct));
}
