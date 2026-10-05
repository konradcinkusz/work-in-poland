using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

public class TrackerServiceTests : IDisposable
{
    private readonly ServiceFixture _fx = new();
    private readonly Domain.JobListing _job;
    private readonly Domain.JobListing _draft;

    public TrackerServiceTests()
    {
        var company = TestData.Company();
        _job = TestData.Job(company, "Tracked Job");
        _draft = TestData.Job(company, "Never Published", status: JobStatuses.Draft);
        _draft.PublishedAt = null;
        _fx.Db.Companies.Add(company);
        _fx.Db.Jobs.AddRange(_job, _draft);
        _fx.Db.SaveChanges();
    }

    public void Dispose() => _fx.Dispose();

    private TrackerService Svc => _fx.Get<TrackerService>();

    [Fact]
    public async Task Saving_creates_a_row_without_applied_at()
    {
        var tracked = await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("saved", "ciekawe"), default);
        Assert.Equal(("saved", "ciekawe"), (tracked.Status, tracked.Notes));
        Assert.Null(tracked.AppliedAt);
        Assert.Equal(_job.Id, tracked.Job.Id);
    }

    [Theory]
    [InlineData("applied")]
    [InlineData("interviewing")]
    [InlineData("offer")]
    public async Task Applied_at_is_set_the_first_time_the_status_reaches_applied_or_later(string status)
    {
        var tracked = await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest(status), default);
        Assert.Equal(TestData.Now, tracked.AppliedAt);
    }

    [Fact]
    public async Task Applied_at_is_set_on_a_later_transition_and_never_moves_afterwards()
    {
        await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("saved"), default);
        _fx.Clock.Advance(TimeSpan.FromDays(1));
        var applied = await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("applied"), default);
        _fx.Clock.Advance(TimeSpan.FromDays(2));
        var interviewing = await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("interviewing"), default);
        var rejected = await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("rejected"), default);
        Assert.Equal(TestData.Now.AddDays(1), applied.AppliedAt);
        Assert.Equal(applied.AppliedAt, interviewing.AppliedAt);
        Assert.Equal(applied.AppliedAt, rejected.AppliedAt);
        Assert.Equal(TestData.Now.AddDays(3), rejected.UpdatedAt);
    }

    [Fact]
    public async Task Upsert_updates_in_place_and_omitting_notes_keeps_them()
    {
        await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("saved", "pierwsza notatka"), default);
        await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("archived"), default);
        var row = Assert.Single(_fx.FreshDb().TrackedJobs);
        Assert.Equal(("archived", "pierwsza notatka"), (row.Status, row.Notes));
    }

    [Fact]
    public async Task Rows_are_private_to_their_user()
    {
        await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("saved"), default);
        await Svc.UpsertAsync("u2", _job.Id, new TrackJobRequest("applied"), default);
        Assert.Equal("saved", Assert.Single((await Svc.ListAsync("u1", null, default)).Items).Status);
        Assert.Equal("applied", Assert.Single((await Svc.ListAsync("u2", null, default)).Items).Status);
    }

    [Fact]
    public async Task Unknown_and_never_published_jobs_are_not_found()
    {
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.UpsertAsync("u1", Guid.NewGuid(), new TrackJobRequest("saved"), default));
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.UpsertAsync("u1", _draft.Id, new TrackJobRequest("saved"), default));
    }

    [Fact]
    public async Task A_job_that_was_published_and_has_since_closed_can_still_be_tracked_and_listed()
    {
        var closed = TestData.Job(_job.Company, "Closed Later", status: JobStatuses.Closed);
        _fx.Db.Jobs.Add(closed);
        await _fx.Db.SaveChangesAsync();
        await Svc.UpsertAsync("u1", closed.Id, new TrackJobRequest("saved"), default);
        Assert.Equal("Closed Later", Assert.Single((await Svc.ListAsync("u1", null, default)).Items).Job.Title);
    }

    [Fact]
    public async Task Invalid_status_and_oversized_notes_are_validation_errors()
    {
        var bad = await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("dreaming"), default));
        Assert.Contains("status", bad.Errors.Keys);
        var long_ = await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("saved", new string('n', 2001)), default));
        Assert.Contains("notes", long_.Errors.Keys);
    }

    [Fact]
    public async Task List_is_ordered_newest_update_first_and_filters_by_status()
    {
        var second = TestData.Job(_job.Company, "Second");
        _fx.Db.Jobs.Add(second);
        await _fx.Db.SaveChangesAsync();
        await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("saved"), default);
        _fx.Clock.Advance(TimeSpan.FromMinutes(5));
        await Svc.UpsertAsync("u1", second.Id, new TrackJobRequest("applied"), default);
        Assert.Equal(["Second", "Tracked Job"], (await Svc.ListAsync("u1", null, default)).Items.Select(t => t.Job.Title));
        Assert.Equal(["Second"], (await Svc.ListAsync("u1", "applied", default)).Items.Select(t => t.Job.Title));
        await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.ListAsync("u1", "bogus", default));
    }

    [Fact]
    public async Task Delete_removes_only_the_callers_row_and_is_idempotent()
    {
        await Svc.UpsertAsync("u1", _job.Id, new TrackJobRequest("saved"), default);
        await Svc.UpsertAsync("u2", _job.Id, new TrackJobRequest("saved"), default);
        await Svc.DeleteAsync("u1", _job.Id, default);
        await Svc.DeleteAsync("u1", _job.Id, default);
        Assert.Equal("u2", Assert.Single(_fx.FreshDb().TrackedJobs).UserId);
    }
}
