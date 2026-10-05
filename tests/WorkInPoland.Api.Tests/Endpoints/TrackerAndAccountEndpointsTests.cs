using System.Net;
using System.Text.Json;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Endpoints;

public class TrackerAndAccountEndpointsTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _alice;
    private readonly HttpClient _bob;
    private Guid _jobId;

    public TrackerAndAccountEndpointsTests()
    {
        _alice = _factory.CreateClientFor(TestTokens.Web("alice"));
        _bob = _factory.CreateClientFor(TestTokens.Web("bob"));
        _factory.WithDbAsync(async db =>
        {
            var company = TestData.Company(owner: "bob");
            var job = TestData.Job(company, "Tracked");
            _jobId = job.Id;
            await TestData.SeedAsync(db, company, job);
        }).GetAwaiter().GetResult();
    }

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Tracker_upsert_list_and_delete_over_http()
    {
        var put = await _alice.PutJsonAsync($"/api/v1/tracker/{_jobId}", new TrackJobRequest("applied", "wysłane CV"));
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var tracked = await put.ReadAsync<TrackedJobDto>();
        Assert.NotNull(tracked.AppliedAt);

        var list = await (await _alice.GetAsync("/api/v1/tracker?status=applied")).ReadAsync<ItemList<TrackedJobDto>>();
        Assert.Equal("Tracked", Assert.Single(list.Items).Job.Title);
        Assert.Empty((await (await _bob.GetAsync("/api/v1/tracker")).ReadAsync<ItemList<TrackedJobDto>>()).Items);

        Assert.Equal(HttpStatusCode.NoContent, (await _alice.DeleteAsync($"/api/v1/tracker/{_jobId}")).StatusCode);
        Assert.Empty((await (await _alice.GetAsync("/api/v1/tracker")).ReadAsync<ItemList<TrackedJobDto>>()).Items);
    }

    [Fact]
    public async Task Tracker_validation_failures_are_400_problems()
    {
        var badStatus = await _alice.PutJsonAsync($"/api/v1/tracker/{_jobId}", new TrackJobRequest("dreaming"));
        Assert.Equal(HttpStatusCode.BadRequest, badStatus.StatusCode);
        Assert.Contains("\"status\"", await badStatus.Content.ReadAsStringAsync());
        var longNotes = await _alice.PutJsonAsync($"/api/v1/tracker/{_jobId}", new TrackJobRequest("saved", new string('n', 2001)));
        Assert.Equal(HttpStatusCode.BadRequest, longNotes.StatusCode);
        Assert.Contains("\"notes\"", await longNotes.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await _alice.PutJsonAsync($"/api/v1/tracker/{Guid.NewGuid()}", new TrackJobRequest("saved"))).StatusCode);
    }

    [Fact]
    public async Task Export_contains_only_the_callers_rows_and_is_an_attachment()
    {
        await _alice.PutJsonAsync($"/api/v1/tracker/{_jobId}", new TrackJobRequest("saved", "alice-secret-note"));
        await _bob.PutJsonAsync($"/api/v1/tracker/{_jobId}", new TrackJobRequest("saved", "bob-secret-note"));

        var response = await _alice.GetAsync("/api/v1/me/export");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("attachment", response.Content.Headers.ContentDisposition?.ToString());
        Assert.Contains("work-in-poland-export.json", response.Content.Headers.ContentDisposition?.ToString());
        var export = await response.ReadAsync<AccountExportDto>();
        Assert.Equal("alice", export.UserId);
        Assert.Equal("alice-secret-note", Assert.Single(export.Tracker).Notes);
        Assert.Empty(export.Companies);
        Assert.Empty(export.Jobs);

        var bobExport = await (await _bob.GetAsync("/api/v1/me/export")).ReadAsync<AccountExportDto>();
        Assert.Single(bobExport.Companies);
        Assert.Single(bobExport.Jobs);
        Assert.DoesNotContain("alice-secret-note", JsonSerializer.Serialize(bobExport));
    }

    [Fact]
    public async Task Delete_data_removes_the_callers_data_only_and_unpublishes_their_jobs_at_once()
    {
        await _alice.PutJsonAsync($"/api/v1/tracker/{_jobId}", new TrackJobRequest("saved"));
        var anonymous = _factory.CreateClient();
        Assert.Equal(1, (await (await anonymous.GetAsync("/api/v1/stats")).ReadAsync<StatsDto>()).PublishedJobs);

        var aliceDelete = await _alice.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/v1/me/data") { Content = JsonContent.Create(new { confirm = "delete-my-data" }) });
        Assert.Equal(HttpStatusCode.NoContent, aliceDelete.StatusCode);
        Assert.Equal(1, (await (await anonymous.GetAsync("/api/v1/stats")).ReadAsync<StatsDto>()).PublishedJobs);
        Assert.Empty((await (await _alice.GetAsync("/api/v1/tracker")).ReadAsync<ItemList<TrackedJobDto>>()).Items);

        var bobDelete = await _bob.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/v1/me/data") { Content = JsonContent.Create(new { confirm = "delete-my-data" }) });
        Assert.Equal(HttpStatusCode.NoContent, bobDelete.StatusCode);
        Assert.Equal(0, (await (await anonymous.GetAsync("/api/v1/stats")).ReadAsync<StatsDto>()).PublishedJobs);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync("/api/v1/jobs/" + "tracked")).StatusCode);
    }

    [Theory]
    [InlineData("{\"confirm\":\"yes\"}")]
    [InlineData("{\"confirm\":\"\"}")]
    [InlineData("{}")]
    public async Task Delete_data_with_a_wrong_confirmation_is_400_and_deletes_nothing(string body)
    {
        var response = await _bob.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/v1/me/data") { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("confirm", await response.Content.ReadAsStringAsync());
        Assert.Single((await (await _bob.GetAsync("/api/v1/me/export")).ReadAsync<AccountExportDto>()).Jobs);
    }

    [Fact]
    public async Task Delete_data_without_a_token_is_401()
    {
        var response = await _factory.CreateClient().SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/v1/me/data") { Content = JsonContent.Create(new { confirm = "delete-my-data" }) });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
