using System.Net;
using System.Text.Json;
using ModelContextProtocol.Client;
using ModelContextProtocol.Protocol;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Mcp;

/// <summary>The MCP adapter exercised through a real MCP client against the in-process server.</summary>
public class McpTests : IDisposable
{
    private static readonly string[] PublicToolNames = ["get_company", "get_job_details", "get_salary_benchmarks", "list_filter_values", "search_companies", "search_jobs"];

    private static readonly string[] AccountToolNames =
    [
        "close_job", "create_company", "get_my_job", "list_my_companies", "list_my_jobs", "list_tracked_jobs",
        "post_job", "publish_job", "renew_job", "track_job", "untrack_job", "update_job",
    ];

    private readonly ApiFactory _factory = new(mcpAccount: true, settings: new() { ["Seed:Demo"] = "true" });

    public McpTests()
    {
        _factory.WaitReadyAsync().GetAwaiter().GetResult();
        for (var i = 0; i < 100 && !_factory.CreateClient().GetFromJsonSafe<StatsDto>("/api/v1/stats")!.PublishedJobs.Equals(16); i++)
        {
            Thread.Sleep(50);
        }
    }

    public void Dispose() => _factory.Dispose();

    private async Task<McpClient> Connect(string route, string? token = null)
    {
        var http = _factory.CreateClient();
        if (token is not null)
        {
            http.DefaultRequestHeaders.Authorization = new("Bearer", token);
        }

        var transport = new HttpClientTransport(new HttpClientTransportOptions { Endpoint = new Uri("http://localhost" + route) }, http, ownsHttpClient: true);
        return await McpClient.CreateAsync(transport);
    }

    private static string Text(CallToolResult result) => ((TextContentBlock)result.Content.Single()).Text;

    [Fact]
    public async Task Anonymous_mcp_lists_exactly_the_public_tools()
    {
        await using var client = await Connect("/mcp");
        var tools = await client.ListToolsAsync();
        Assert.Equal(PublicToolNames, tools.Select(t => t.Name).Order());
    }

    [Fact]
    public async Task Account_mcp_lists_public_plus_account_tools_for_a_valid_token()
    {
        await using var client = await Connect("/mcp/account", TestTokens.Mcp("user-1", "jobs:read tracker:write employer:write"));
        var tools = await client.ListToolsAsync();
        Assert.Equal(PublicToolNames.Concat(AccountToolNames).Order(), tools.Select(t => t.Name).Order());
    }

    [Fact]
    public async Task No_account_tool_can_delete_or_export_an_account()
    {
        await using var client = await Connect("/mcp/account", TestTokens.Mcp("user-1", "jobs:read tracker:write employer:write"));
        var names = (await client.ListToolsAsync()).Select(t => t.Name).ToList();
        Assert.DoesNotContain(names, n => n.Contains("delete") || n.Contains("export") || n.Contains("erase"));
    }

    [Fact]
    public async Task Every_tool_has_a_description_and_every_parameter_is_described()
    {
        await using var client = await Connect("/mcp/account", TestTokens.Mcp("user-1", "jobs:read"));
        foreach (var tool in await client.ListToolsAsync())
        {
            Assert.False(string.IsNullOrWhiteSpace(tool.Description), tool.Name);
            Assert.True(tool.Description!.Length > 40, tool.Name);
            foreach (var property in tool.JsonSchema.GetProperty("properties").EnumerateObject())
            {
                Assert.True(property.Value.TryGetProperty("description", out var d) && d.GetString()!.Length > 5, $"{tool.Name}.{property.Name}");
            }
        }
    }

    [Fact]
    public async Task Search_jobs_returns_the_rest_json()
    {
        await using var client = await Connect("/mcp");
        var result = await client.CallToolAsync("search_jobs", new Dictionary<string, object?> { ["q"] = "kotlin", ["limit"] = 5 });
        Assert.NotEqual(true, result.IsError);
        var page = JsonSerializer.Deserialize<PageDto<JobSummaryDto>>(Text(result), JsonSerializerOptions.Web)!;
        Assert.Equal("Mobile Developer (Kotlin)", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task Public_tools_cover_details_companies_benchmarks_and_filters()
    {
        await using var client = await Connect("/mcp");
        var slug = JsonSerializer.Deserialize<PageDto<JobSummaryDto>>(Text(await client.CallToolAsync("search_jobs", new Dictionary<string, object?> { ["limit"] = 1 })), JsonSerializerOptions.Web)!.Items[0].Slug;
        var detail = JsonSerializer.Deserialize<JobDetailDto>(Text(await client.CallToolAsync("get_job_details", new Dictionary<string, object?> { ["slug"] = slug })), JsonSerializerOptions.Web)!;
        Assert.StartsWith("https://", detail.ApplyUrl);

        var companies = JsonSerializer.Deserialize<PageDto<CompanyListItemDto>>(Text(await client.CallToolAsync("search_companies", new Dictionary<string, object?>())), JsonSerializerOptions.Web)!;
        Assert.True(companies.Total >= 6);
        var company = JsonSerializer.Deserialize<CompanyPublicDto>(Text(await client.CallToolAsync("get_company", new Dictionary<string, object?> { ["slug"] = companies.Items[0].Slug })), JsonSerializerOptions.Web)!;
        Assert.NotEmpty(company.OpenJobs);

        var benchmark = JsonSerializer.Deserialize<SalaryBenchmarkDto>(Text(await client.CallToolAsync("get_salary_benchmarks", new Dictionary<string, object?>())), JsonSerializerOptions.Web)!;
        Assert.Equal("net", benchmark.Basis);
        var filters = JsonSerializer.Deserialize<FilterValuesDto>(Text(await client.CallToolAsync("list_filter_values", new Dictionary<string, object?>())), JsonSerializerOptions.Web)!;
        Assert.Contains("Wrocław", filters.Cities);
    }

    [Fact]
    public async Task A_failed_tool_returns_is_error_with_a_sentence_the_model_can_act_on()
    {
        await using var client = await Connect("/mcp");
        var missing = await client.CallToolAsync("get_job_details", new Dictionary<string, object?> { ["slug"] = "nie-ma" });
        Assert.True(missing.IsError);
        Assert.Contains("Job not found", Text(missing));
        var bad = await client.CallToolAsync("get_salary_benchmarks", new Dictionary<string, object?> { ["contractType"] = "slavery" });
        Assert.True(bad.IsError);
        Assert.Contains("contractType", Text(bad));
    }

    [Fact]
    public async Task Account_endpoint_without_a_token_is_401_with_the_resource_metadata_challenge()
    {
        var response = await _factory.CreateClient().PostAsync("/mcp/account", new StringContent("{}", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Bearer resource_metadata=\"https://api.test.example/.well-known/oauth-protected-resource/mcp/account\"", response.Headers.WwwAuthenticate.ToString());
    }

    [Fact]
    public async Task The_challenge_is_built_from_configuration_not_from_the_request_host()
    {
        var client = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "http://evil.example/mcp/account") { Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json") };
        var response = await client.SendAsync(request);
        Assert.DoesNotContain("evil.example", response.Headers.WwwAuthenticate.ToString());
        Assert.Contains("api.test.example", response.Headers.WwwAuthenticate.ToString());
    }

    [Fact]
    public async Task A_token_for_another_audience_is_401_on_the_account_endpoint()
    {
        var response = await _factory.CreateClientFor(TestTokens.Mcp("u", "jobs:read", audience: "https://other.example/mcp")).PostAsync("/mcp/account", new StringContent("{}", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains("invalid_token", response.Headers.WwwAuthenticate.ToString());
    }

    [Fact]
    public async Task A_token_from_another_issuer_is_401_on_the_account_endpoint()
    {
        var response = await _factory.CreateClientFor(TestTokens.Mcp("u", "jobs:read", issuer: "https://evil.example")).PostAsync("/mcp/account", new StringContent("{}", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task A_scope_less_token_cannot_call_a_tracker_tool_and_is_told_which_scope_is_missing()
    {
        await using var client = await Connect("/mcp/account", TestTokens.Mcp("user-1", "offline_access"));
        var job = (await _factory.CreateClient().GetFromJsonAsync<PageDto<JobSummaryDto>>("/api/v1/jobs?limit=1", JsonSerializerOptions.Web))!.Items[0];
        var result = await client.CallToolAsync("track_job", new Dictionary<string, object?> { ["jobId"] = job.Id, ["status"] = "saved" });
        Assert.True(result.IsError);
        Assert.Contains("tracker:write", Text(result));
        var list = await client.CallToolAsync("list_tracked_jobs", new Dictionary<string, object?>());
        Assert.True(list.IsError);
        Assert.Contains("jobs:read", Text(list));
    }

    [Fact]
    public async Task A_scoped_token_can_track_a_job_and_the_row_is_the_same_one_the_rest_api_sees()
    {
        const string user = "user-mcp";
        await using var client = await Connect("/mcp/account", TestTokens.Mcp(user, "jobs:read tracker:write"));
        var job = (await _factory.CreateClient().GetFromJsonAsync<PageDto<JobSummaryDto>>("/api/v1/jobs?limit=1", JsonSerializerOptions.Web))!.Items[0];

        var tracked = await client.CallToolAsync("track_job", new Dictionary<string, object?> { ["jobId"] = job.Id, ["status"] = "applied", ["notes"] = "przez asystenta" });
        Assert.NotEqual(true, tracked.IsError);
        Assert.NotNull(JsonSerializer.Deserialize<TrackedJobDto>(Text(tracked), JsonSerializerOptions.Web)!.AppliedAt);

        var viaRest = await _factory.CreateClientFor(TestTokens.Web(user)).GetFromJsonAsync<ItemList<TrackedJobDto>>("/api/v1/tracker", JsonSerializerOptions.Web);
        Assert.Equal("przez asystenta", Assert.Single(viaRest!.Items).Notes);
        var listed = JsonSerializer.Deserialize<ItemList<TrackedJobDto>>(Text(await client.CallToolAsync("list_tracked_jobs", new Dictionary<string, object?>())), JsonSerializerOptions.Web)!;
        Assert.Single(listed.Items);

        await client.CallToolAsync("untrack_job", new Dictionary<string, object?> { ["jobId"] = job.Id });
        Assert.Empty((await _factory.CreateClientFor(TestTokens.Web(user)).GetFromJsonAsync<ItemList<TrackedJobDto>>("/api/v1/tracker", JsonSerializerOptions.Web))!.Items);
    }

    [Fact]
    public async Task Tracker_tool_validation_errors_come_back_as_tool_errors()
    {
        await using var client = await Connect("/mcp/account", TestTokens.Mcp("user-1", "tracker:write"));
        var job = (await _factory.CreateClient().GetFromJsonAsync<PageDto<JobSummaryDto>>("/api/v1/jobs?limit=1", JsonSerializerOptions.Web))!.Items[0];
        var result = await client.CallToolAsync("track_job", new Dictionary<string, object?> { ["jobId"] = job.Id, ["status"] = "dreaming" });
        Assert.True(result.IsError);
        Assert.Contains("status", Text(result));
    }

    [Fact]
    public async Task An_employer_can_create_a_company_and_post_then_manage_a_job_through_the_tools()
    {
        await using var client = await Connect("/mcp/account", TestTokens.Mcp("employer-1", "employer:write"));
        var company = JsonSerializer.Deserialize<CompanyDetailDto>(Text(await client.CallToolAsync("create_company", new Dictionary<string, object?> { ["name"] = "Mcp Firma sp. z o.o.", ["website"] = "https://mcp-firma.example" })), JsonSerializerOptions.Web)!;
        var salary = new Dictionary<string, object?> { ["contractType"] = "b2b", ["min"] = 18000, ["max"] = 24000, ["currency"] = "PLN", ["period"] = "month", ["basis"] = "net" };
        var args = new Dictionary<string, object?>
        {
            ["companyId"] = company.Id,
            ["title"] = "Inżynier oprogramowania",
            ["description"] = TestData.LongDescription,
            ["category"] = "backend",
            ["seniority"] = "mid",
            ["workMode"] = "remote",
            ["remoteScope"] = "poland",
            ["city"] = null,
            ["salaries"] = new[] { salary },
            ["skills"] = new[] { "c#" },
            ["applyUrl"] = "https://mcp-firma.example/jobs/1",
            ["publish"] = true,
        };
        var posted = JsonSerializer.Deserialize<EmployerJobDto>(Text(await client.CallToolAsync("post_job", args)), JsonSerializerOptions.Web)!;
        Assert.Equal("published", posted.Status);
        Assert.Equal(HttpStatusCode.OK, (await _factory.CreateClient().GetAsync($"/api/v1/jobs/{posted.Slug}")).StatusCode);

        var closed = JsonSerializer.Deserialize<EmployerJobDto>(Text(await client.CallToolAsync("close_job", new Dictionary<string, object?> { ["jobId"] = posted.Id })), JsonSerializerOptions.Web)!;
        Assert.Equal("closed", closed.Status);
        var renewed = JsonSerializer.Deserialize<EmployerJobDto>(Text(await client.CallToolAsync("renew_job", new Dictionary<string, object?> { ["jobId"] = posted.Id })), JsonSerializerOptions.Web)!;
        Assert.Equal("published", renewed.Status);
        var mine = JsonSerializer.Deserialize<PageDto<EmployerJobDto>>(Text(await client.CallToolAsync("list_my_jobs", new Dictionary<string, object?>())), JsonSerializerOptions.Web)!;
        Assert.Single(mine.Items);
    }

    [Fact]
    public async Task Posting_without_a_salary_range_returns_a_tool_error_naming_the_field()
    {
        await using var client = await Connect("/mcp/account", TestTokens.Mcp("employer-2", "employer:write"));
        var company = JsonSerializer.Deserialize<CompanyDetailDto>(Text(await client.CallToolAsync("create_company", new Dictionary<string, object?> { ["name"] = "Bez Widełek sp. z o.o.", ["website"] = "https://bw.example" })), JsonSerializerOptions.Web)!;
        var result = await client.CallToolAsync("post_job", new Dictionary<string, object?>
        {
            ["companyId"] = company.Id,
            ["title"] = "Programista bez widełek",
            ["description"] = TestData.LongDescription,
            ["category"] = "backend",
            ["seniority"] = "mid",
            ["workMode"] = "remote",
            ["remoteScope"] = "poland",
            ["salaries"] = Array.Empty<object>(),
            ["skills"] = new[] { "c#" },
            ["applyUrl"] = "https://bw.example/1",
            ["publish"] = true,
        });
        Assert.True(result.IsError);
        Assert.Contains("salaries", Text(result));
    }

    [Fact]
    public async Task One_employers_job_is_not_found_for_another_employer_through_the_tools()
    {
        await using var owner = await Connect("/mcp/account", TestTokens.Mcp("employer-a", "employer:write"));
        await using var other = await Connect("/mcp/account", TestTokens.Mcp("employer-b", "employer:write"));
        var company = JsonSerializer.Deserialize<CompanyDetailDto>(Text(await owner.CallToolAsync("create_company", new Dictionary<string, object?> { ["name"] = "Firma A sp. z o.o.", ["website"] = "https://a.example" })), JsonSerializerOptions.Web)!;
        var draft = JsonSerializer.Deserialize<EmployerJobDto>(Text(await owner.CallToolAsync("post_job", new Dictionary<string, object?>
        {
            ["companyId"] = company.Id,
            ["title"] = "Szkic oferty",
            ["category"] = "backend",
            ["seniority"] = "mid",
            ["workMode"] = "remote",
            ["remoteScope"] = "eu",
            ["publish"] = false,
        })), JsonSerializerOptions.Web)!;
        var result = await other.CallToolAsync("get_my_job", new Dictionary<string, object?> { ["jobId"] = draft.Id });
        Assert.True(result.IsError);
        Assert.Contains("Job not found", Text(result));
    }

    [Fact]
    public async Task A_tool_called_on_the_public_endpoint_that_only_exists_on_the_account_endpoint_is_an_error()
    {
        await using var client = await Connect("/mcp");
        await Assert.ThrowsAnyAsync<Exception>(async () => await client.CallToolAsync("track_job", new Dictionary<string, object?> { ["jobId"] = Guid.NewGuid(), ["status"] = "saved" }));
    }

    // ---- RFC 9728 ----

    [Theory]
    [InlineData("/.well-known/oauth-protected-resource/mcp/account")]
    [InlineData("/.well-known/oauth-protected-resource")]
    public async Task Protected_resource_metadata_names_the_resource_and_only_the_authorization_server(string path)
    {
        var response = await _factory.CreateClient().GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(TestTokens.McpResource, doc.RootElement.GetProperty("resource").GetString());
        Assert.Equal([TestTokens.AuthorizationServer], doc.RootElement.GetProperty("authorization_servers").EnumerateArray().Select(e => e.GetString()!).ToArray());
        Assert.Equal(Scopes.All, doc.RootElement.GetProperty("scopes_supported").EnumerateArray().Select(e => e.GetString()!).ToArray());
    }

    [Fact]
    public async Task Without_a_resource_uri_the_account_endpoint_and_its_metadata_are_not_mapped_but_public_mcp_still_works()
    {
        using var bare = new ApiFactory();
        var client = bare.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/.well-known/oauth-protected-resource/mcp/account")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/.well-known/oauth-protected-resource")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync("/mcp/account", new StringContent("{}", System.Text.Encoding.UTF8, "application/json"))).StatusCode);
        var transport = new HttpClientTransport(new HttpClientTransportOptions { Endpoint = new Uri("http://localhost/mcp") }, client, ownsHttpClient: false);
        await using var mcp = await McpClient.CreateAsync(transport);
        Assert.Equal(6, (await mcp.ListToolsAsync()).Count);
    }
}
