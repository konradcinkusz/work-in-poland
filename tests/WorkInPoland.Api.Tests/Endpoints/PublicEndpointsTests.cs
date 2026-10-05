using System.Net;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Endpoints;

public class PublicEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new(settings: new() { ["Seed:Demo"] = "true" });
    private readonly HttpClient _client;

    public PublicEndpointsTests()
    {
        _client = _factory.CreateClient();
        _factory.WaitReadyAsync().GetAwaiter().GetResult();
        WaitForSeed();
    }

    public void Dispose() => _factory.Dispose();

    private void WaitForSeed()
    {
        for (var i = 0; i < 100; i++)
        {
            if (_client.GetFromJsonSafe<StatsDto>("/api/v1/stats")?.PublishedJobs > 0)
            {
                return;
            }

            Thread.Sleep(50);
        }
    }

    [Fact]
    public async Task Search_returns_a_page_in_the_contract_shape()
    {
        var page = await (await _client.GetAsync("/api/v1/jobs?q=kotlin")).ReadAsync<PageDto<JobSummaryDto>>();
        var job = Assert.Single(page.Items);
        Assert.Equal((1, 1, 20), (page.Total, page.Page, page.Limit));
        Assert.Equal(("mobile", "remote", "eu"), (job.Category, job.WorkMode, job.RemoteScope));
        Assert.Equal("EUR", Assert.Single(job.Salaries).Currency);
    }

    [Fact]
    public async Task Json_is_camel_case_with_lowercase_enumerations()
    {
        var body = await (await _client.GetAsync("/api/v1/jobs?limit=1")).Content.ReadAsStringAsync();
        Assert.Contains("\"workMode\":", body);
        Assert.Contains("\"isPromoted\":", body);
        Assert.DoesNotContain("\"WorkMode\"", body);
    }

    [Fact]
    public async Task Out_of_range_paging_is_clamped_over_http()
    {
        var page = await (await _client.GetAsync("/api/v1/jobs?page=-3&limit=100000")).ReadAsync<PageDto<JobSummaryDto>>();
        Assert.Equal((1, 100), (page.Page, page.Limit));
    }

    [Fact]
    public async Task Filters_arrive_as_comma_separated_query_parameters()
    {
        var page = await (await _client.GetAsync("/api/v1/jobs?category=backend,devops&workMode=remote&salaryMin=20000&sort=salary")).ReadAsync<PageDto<JobSummaryDto>>();
        Assert.NotEmpty(page.Items);
        Assert.All(page.Items, j => Assert.Contains(j.Category, new[] { "backend", "devops" }));
        Assert.All(page.Items, j => Assert.Equal("remote", j.WorkMode));
    }

    [Fact]
    public async Task Detail_by_slug_returns_description_and_apply_url_and_unknown_slugs_are_404_problems()
    {
        var slug = (await (await _client.GetAsync("/api/v1/jobs?limit=1")).ReadAsync<PageDto<JobSummaryDto>>()).Items[0].Slug;
        var detail = await (await _client.GetAsync($"/api/v1/jobs/{slug}")).ReadAsync<JobDetailDto>();
        Assert.StartsWith("## O roli", detail.Description);
        Assert.StartsWith("https://", detail.ApplyUrl);

        var missing = await _client.GetAsync("/api/v1/jobs/nie-ma-takiej-oferty");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal("application/problem+json", missing.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Apply_click_returns_the_employer_url()
    {
        var slug = (await (await _client.GetAsync("/api/v1/jobs?limit=1")).ReadAsync<PageDto<JobSummaryDto>>()).Items[0].Slug;
        var response = await _client.PostAsync($"/api/v1/jobs/{slug}/apply-click", null);
        Assert.StartsWith("https://", (await response.ReadAsync<ApplyClickDto>()).ApplyUrl);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PostAsync("/api/v1/jobs/nope/apply-click", null)).StatusCode);
    }

    [Fact]
    public async Task Companies_list_and_detail()
    {
        var page = await (await _client.GetAsync("/api/v1/companies?verifiedOnly=true")).ReadAsync<PageDto<CompanyListItemDto>>();
        var company = Assert.Single(page.Items);
        Assert.True(company.OpenJobs >= 2);
        var detail = await (await _client.GetAsync($"/api/v1/companies/{company.Slug}")).ReadAsync<CompanyPublicDto>();
        Assert.Equal(company.OpenJobs, detail.OpenJobs.Count);
        Assert.DoesNotContain("nip", await (await _client.GetAsync($"/api/v1/companies/{company.Slug}")).Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/v1/companies/nie-ma")).StatusCode);
    }

    [Fact]
    public async Task Benchmarks_default_to_b2b_pln_and_reject_unknown_values()
    {
        var b = await (await _client.GetAsync("/api/v1/salaries/benchmarks")).ReadAsync<SalaryBenchmarkDto>();
        Assert.Equal(("b2b", "net", "PLN"), (b.ContractType, b.Basis, b.Currency));
        Assert.NotNull(b.Median);
        var small = await (await _client.GetAsync("/api/v1/salaries/benchmarks?title=kotlin")).ReadAsync<SalaryBenchmarkDto>();
        Assert.Equal((0, null), (small.SampleSize, small.Median));
        var bad = await _client.GetAsync("/api/v1/salaries/benchmarks?contractType=slavery");
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Contains("\"errors\"", await bad.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Filters_and_stats()
    {
        var filters = await (await _client.GetAsync("/api/v1/meta/filters")).ReadAsync<FilterValuesDto>();
        Assert.Contains("Warszawa", filters.Cities);
        Assert.Equal(Vocabulary.WorkModes, filters.WorkModes);
        var stats = await (await _client.GetAsync("/api/v1/stats")).ReadAsync<StatsDto>();
        Assert.True(stats.PublishedJobs >= 14 && stats.Companies >= 6);
    }
}
