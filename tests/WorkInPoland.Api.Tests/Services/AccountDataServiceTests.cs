using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

public class AccountDataServiceTests : IDisposable
{
    private readonly ServiceFixture _fx = new();
    private Guid _aliceJob;
    private Guid _bobJob;

    public AccountDataServiceTests()
    {
        var alice = TestData.Company("Alice sp. z o.o.", "alice");
        var bob = TestData.Company("Bob sp. z o.o.", "bob");
        var aj = TestData.Job(alice, "Alice Job");
        var bj = TestData.Job(bob, "Bob Job");
        _aliceJob = aj.Id;
        _bobJob = bj.Id;
        _fx.Db.Companies.AddRange(alice, bob);
        _fx.Db.Jobs.AddRange(aj, bj);
        _fx.Db.SaveChanges();
        var tracker = _fx.Get<TrackerService>();
        tracker.UpsertAsync("alice", bj.Id, new TrackJobRequest("applied", "alice note"), default).Wait();
        tracker.UpsertAsync("bob", bj.Id, new TrackJobRequest("saved", "bob note"), default).Wait();
        tracker.UpsertAsync("bob", aj.Id, new TrackJobRequest("saved"), default).Wait();
    }

    public void Dispose() => _fx.Dispose();

    private AccountDataService Svc => _fx.Get<AccountDataService>();

    [Fact]
    public async Task Export_contains_only_the_callers_rows()
    {
        var export = await Svc.ExportAsync("alice", default);
        Assert.Equal("alice", export.UserId);
        Assert.Equal(["Alice sp. z o.o."], export.Companies.Select(c => c.Name));
        Assert.Equal(["Alice Job"], export.Jobs.Select(j => j.Title));
        Assert.Equal("alice note", Assert.Single(export.Tracker).Notes);
        var json = System.Text.Json.JsonSerializer.Serialize(export);
        Assert.DoesNotContain("bob note", json);
        Assert.DoesNotContain("bob note", json);
    }

    [Fact]
    public async Task Export_for_a_user_without_data_is_empty()
    {
        var export = await Svc.ExportAsync("nobody", default);
        Assert.Empty(export.Tracker);
        Assert.Empty(export.Companies);
        Assert.Empty(export.Jobs);
    }

    [Fact]
    public async Task Delete_removes_everything_of_the_caller_and_nothing_of_anyone_else()
    {
        await Svc.DeleteAsync("alice", new DeleteDataRequest("delete-my-data"), default);
        var db = _fx.FreshDb();
        Assert.Equal(["Bob sp. z o.o."], db.Companies.Select(c => c.Name));
        Assert.Equal(["Bob Job"], db.Jobs.Select(j => j.Title));
        Assert.Single(db.Salaries);
        Assert.Single(db.JobSkills);
        var rows = db.TrackedJobs.ToList();
        Assert.All(rows, r => Assert.Equal("bob", r.UserId));
        Assert.Equal([_bobJob], rows.Select(r => r.JobId));
        Assert.Equal("bob note", rows.Single().Notes);
        Assert.DoesNotContain(db.Jobs, j => j.Id == _aliceJob);
    }

    [Fact]
    public async Task A_deleted_published_listing_disappears_from_public_reads_at_once()
    {
        await Svc.DeleteAsync("alice", new DeleteDataRequest("delete-my-data"), default);
        Assert.DoesNotContain((await _fx.Get<CatalogService>().SearchJobsAsync(new JobSearchQuery(), default)).Items, j => j.Title == "Alice Job");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("yes")]
    [InlineData("DELETE-MY-DATA")]
    public async Task A_wrong_confirmation_deletes_nothing(string? confirm)
    {
        var ex = await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.DeleteAsync("alice", new DeleteDataRequest(confirm), default));
        Assert.Contains("confirm", ex.Errors.Keys);
        Assert.Equal(2, _fx.FreshDb().Companies.Count());
    }
}
