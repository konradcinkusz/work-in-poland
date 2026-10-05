using System.Net;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Endpoints;

public class AdminEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _admin;
    private Guid _jobId;
    private Guid _companyId;

    public AdminEndpointsTests()
    {
        _admin = _factory.CreateClientFor(TestTokens.Web("root", ["Admin"]));
        _factory.WithDbAsync(async db =>
        {
            var company = TestData.Company();
            var job = TestData.Job(company, "Moderated");
            _companyId = company.Id;
            _jobId = job.Id;
            await TestData.SeedAsync(db, company, job);
        }).GetAwaiter().GetResult();
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Unpublish_with_a_reason_hides_the_job_publicly_and_a_missing_reason_is_400()
    {
        var bad = await _admin.PostJsonAsync($"/api/v1/admin/jobs/{_jobId}/unpublish", new { reason = "" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Contains("\"reason\"", await bad.Content.ReadAsStringAsync());

        var ok = await _admin.PostJsonAsync($"/api/v1/admin/jobs/{_jobId}/unpublish", new { reason = "Podejrzenie oszustwa" });
        Assert.Equal("closed", (await ok.ReadAsync<EmployerJobDto>()).Status);
        Assert.Equal(0, (await (await _factory.CreateClient().GetAsync("/api/v1/stats")).ReadAsync<StatsDto>()).PublishedJobs);
        Assert.Equal(HttpStatusCode.Conflict, (await _admin.PostJsonAsync($"/api/v1/admin/jobs/{_jobId}/unpublish", new { reason = "again" })).StatusCode);
    }

    [Theory]
    [InlineData(0, HttpStatusCode.BadRequest)]
    [InlineData(91, HttpStatusCode.BadRequest)]
    [InlineData(30, HttpStatusCode.OK)]
    public async Task Promote_validates_the_day_count(int days, HttpStatusCode expected)
    {
        var response = await _admin.PostJsonAsync($"/api/v1/admin/jobs/{_jobId}/promote", new { days });
        Assert.Equal(expected, response.StatusCode);
        if (expected == HttpStatusCode.OK)
        {
            Assert.True((await response.ReadAsync<EmployerJobDto>()).IsPromoted);
        }
    }

    [Fact]
    public async Task Verify_and_unverify_company()
    {
        var verified = await (await _admin.PostAsync($"/api/v1/admin/companies/{_companyId}/verify", null)).ReadAsync<CompanyDetailDto>();
        Assert.True(verified.IsVerified);
        Assert.True((await (await _factory.CreateClient().GetAsync("/api/v1/companies?verifiedOnly=true")).ReadAsync<PageDto<CompanyListItemDto>>()).Items.Count == 1);
        var back = await (await _admin.PostAsync($"/api/v1/admin/companies/{_companyId}/unverify", null)).ReadAsync<CompanyDetailDto>();
        Assert.False(back.IsVerified);
        Assert.Equal(HttpStatusCode.NotFound, (await _admin.PostAsync($"/api/v1/admin/companies/{Guid.NewGuid()}/verify", null)).StatusCode);
    }

    [Fact]
    public async Task Admin_lists_see_every_company()
    {
        var jobs = await (await _admin.GetAsync("/api/v1/admin/jobs?q=moder")).ReadAsync<PageDto<EmployerJobDto>>();
        Assert.Equal("Moderated", Assert.Single(jobs.Items).Title);
        var companies = await (await _admin.GetAsync("/api/v1/admin/companies?verified=false")).ReadAsync<PageDto<CompanyDetailDto>>();
        Assert.Single(companies.Items);
    }

    [Fact]
    public async Task A_regular_user_cannot_use_any_admin_action()
    {
        var user = _factory.CreateClientFor(TestTokens.Web("user-1"));
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PostJsonAsync($"/api/v1/admin/jobs/{_jobId}/unpublish", new { reason = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PostAsync($"/api/v1/admin/companies/{_companyId}/verify", null)).StatusCode);
        Assert.Equal(1, (await (await _factory.CreateClient().GetAsync("/api/v1/stats")).ReadAsync<StatsDto>()).PublishedJobs);
    }
}
