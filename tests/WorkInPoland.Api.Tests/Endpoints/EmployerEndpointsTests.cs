using System.Net;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Endpoints;

public class EmployerEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _owner;
    private readonly HttpClient _other;

    public EmployerEndpointsTests()
    {
        _owner = _factory.CreateClientFor(TestTokens.Web("owner-1"));
        _other = _factory.CreateClientFor(TestTokens.Web("owner-2"));
    }

    public void Dispose() => _factory.Dispose();

    private async Task<CompanyDetailDto> CreateCompany(HttpClient? client = null)
    {
        var response = await (client ?? _owner).PostJsonAsync("/api/v1/employer/companies", TestData.CompanyInput());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.ReadAsync<CompanyDetailDto>();
    }

    [Fact]
    public async Task Create_company_is_201_with_a_location_and_a_slug()
    {
        var response = await _owner.PostJsonAsync("/api/v1/employer/companies", TestData.CompanyInput());
        var company = await response.ReadAsync<CompanyDetailDto>();
        Assert.Equal($"/api/v1/employer/companies/{company.Id}", response.Headers.Location?.ToString());
        Assert.Equal("acme-sp-z-o-o", company.Slug);
    }

    [Fact]
    public async Task Invalid_company_input_is_a_400_validation_problem_with_field_errors()
    {
        var response = await _owner.PostJsonAsync("/api/v1/employer/companies", TestData.CompanyInput("A", "123") with { Website = "http://x" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"errors\"", body);
        Assert.Contains("\"name\"", body);
        Assert.Contains("\"website\"", body);
        Assert.Contains("\"nip\"", body);
    }

    [Fact]
    public async Task A_second_user_gets_404_on_every_route_touching_the_first_users_company_and_job()
    {
        var company = await CreateCompany();
        var job = await (await _owner.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id, publish: false))).ReadAsync<EmployerJobDto>();

        Assert.Equal(HttpStatusCode.NotFound, (await _other.PutJsonAsync($"/api/v1/employer/companies/{company.Id}", TestData.CompanyInput("X Corp"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _other.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _other.GetAsync($"/api/v1/employer/jobs/{job.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _other.PutJsonAsync($"/api/v1/employer/jobs/{job.Id}", TestData.JobInput(company.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _other.PostAsync($"/api/v1/employer/jobs/{job.Id}/publish", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _other.PostAsync($"/api/v1/employer/jobs/{job.Id}/close", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _other.PostAsync($"/api/v1/employer/jobs/{job.Id}/renew", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _other.DeleteAsync($"/api/v1/employer/jobs/{job.Id}")).StatusCode);
        Assert.Empty((await (await _other.GetAsync("/api/v1/employer/jobs")).ReadAsync<PageDto<EmployerJobDto>>()).Items);
        Assert.Empty(await (await _other.GetAsync("/api/v1/employer/companies")).ReadAsync<List<CompanyDetailDto>>());
        Assert.Equal(HttpStatusCode.OK, (await _owner.GetAsync($"/api/v1/employer/jobs/{job.Id}")).StatusCode);
    }

    [Fact]
    public async Task Full_lifecycle_over_http_including_public_visibility()
    {
        var company = await CreateCompany();
        var anonymous = _factory.CreateClient();

        var draft = await (await _owner.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id, publish: false))).ReadAsync<EmployerJobDto>();
        Assert.Equal("draft", draft.Status);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/v1/jobs/{draft.Slug}")).StatusCode);

        var published = await (await _owner.PostAsync($"/api/v1/employer/jobs/{draft.Id}/publish", null)).ReadAsync<EmployerJobDto>();
        Assert.Equal("published", published.Status);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"/api/v1/jobs/{draft.Slug}")).StatusCode);
        Assert.Equal(1, (await (await _owner.GetAsync($"/api/v1/employer/jobs/{draft.Id}")).ReadAsync<EmployerJobDto>()).Views);

        var edited = await _owner.PutJsonAsync($"/api/v1/employer/jobs/{draft.Id}", TestData.JobInput(company.Id, "Nowy tytuł stanowiska"));
        Assert.Equal("Nowy tytuł stanowiska", (await edited.ReadAsync<EmployerJobDto>()).Title);

        await _owner.PostAsync($"/api/v1/employer/jobs/{draft.Id}/close", null);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/v1/jobs/{draft.Slug}")).StatusCode);
        var conflict = await _owner.PutJsonAsync($"/api/v1/employer/jobs/{draft.Id}", TestData.JobInput(company.Id));
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
        Assert.Equal("application/problem+json", conflict.Content.Headers.ContentType?.MediaType);

        var renewed = await (await _owner.PostAsync($"/api/v1/employer/jobs/{draft.Id}/renew", null)).ReadAsync<EmployerJobDto>();
        Assert.Equal("published", renewed.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await _owner.DeleteAsync($"/api/v1/employer/jobs/{draft.Id}")).StatusCode);
    }

    [Fact]
    public async Task Publishing_without_a_salary_range_is_a_400_and_a_draft_is_accepted()
    {
        var company = await CreateCompany();
        var publish = await _owner.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id, salaries: []));
        Assert.Equal(HttpStatusCode.BadRequest, publish.StatusCode);
        Assert.Contains("salaries", await publish.Content.ReadAsStringAsync());
        var draft = await _owner.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id, publish: false, salaries: []));
        Assert.Equal(HttpStatusCode.Created, draft.StatusCode);
    }

    [Fact]
    public async Task Deleting_a_draft_is_204()
    {
        var company = await CreateCompany();
        var draft = await (await _owner.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id, publish: false))).ReadAsync<EmployerJobDto>();
        Assert.Equal(HttpStatusCode.NoContent, (await _owner.DeleteAsync($"/api/v1/employer/jobs/{draft.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _owner.GetAsync($"/api/v1/employer/jobs/{draft.Id}")).StatusCode);
    }

    [Fact]
    public async Task The_published_cap_is_a_409()
    {
        using var capped = new ApiFactory(settings: new() { ["Jobs:MaxPublishedPerCompany"] = "1" });
        var client = capped.CreateClientFor(TestTokens.Web("owner-1"));
        var company = await (await client.PostJsonAsync("/api/v1/employer/companies", TestData.CompanyInput())).ReadAsync<CompanyDetailDto>();
        Assert.Equal(HttpStatusCode.Created, (await client.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id))).StatusCode);
    }

    [Fact]
    public async Task Lists_are_filtered_and_clamped()
    {
        var company = await CreateCompany();
        await _owner.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id));
        await _owner.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id, publish: false));
        var drafts = await (await _owner.GetAsync($"/api/v1/employer/jobs?companyId={company.Id}&status=draft&limit=500")).ReadAsync<PageDto<EmployerJobDto>>();
        Assert.Equal((1, 100), (drafts.Total, drafts.Limit));
        Assert.Equal(HttpStatusCode.BadRequest, (await _owner.GetAsync("/api/v1/employer/jobs?status=nope")).StatusCode);
    }

    [Fact]
    public async Task Employer_view_exposes_the_nip_but_the_public_view_never_does()
    {
        var created = await _owner.PostJsonAsync("/api/v1/employer/companies", TestData.CompanyInput(nip: "1234563218"));
        Assert.Contains("1234563218", await created.Content.ReadAsStringAsync());
        var company = await created.ReadAsync<CompanyDetailDto>();
        await _owner.PostJsonAsync("/api/v1/employer/jobs", TestData.JobInput(company.Id));
        var publicBody = await (await _factory.CreateClient().GetAsync($"/api/v1/companies/{company.Slug}")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("1234563218", publicBody);
    }
}
