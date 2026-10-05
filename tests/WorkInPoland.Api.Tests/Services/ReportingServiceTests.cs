using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

public class ReportingServiceTests : IDisposable
{
    private readonly ServiceFixture _fx = new();
    private readonly Domain.JobListing _job;

    public ReportingServiceTests()
    {
        var company = TestData.Company("Acme sp. z o.o.");
        _job = TestData.Job(company, "Live Backend");
        _fx.Db.Companies.Add(company);
        _fx.Db.Jobs.Add(_job);
        _fx.Db.SaveChanges();
    }

    public void Dispose() => _fx.Dispose();

    private ReportingService Svc => _fx.Get<ReportingService>();

    [Fact]
    public async Task A_report_is_stored_open_with_a_normalised_reason_and_email()
    {
        await Svc.CreateReportAsync(_job.Slug, new JobReportRequest("SCAM".ToLowerInvariant(), "  Wygląda na oszustwo  ", "Ala@Example.COM"), default);

        var row = _fx.FreshDb().JobReports.Single();
        Assert.Equal(_job.Id, row.JobId);
        Assert.Equal("scam", row.Reason);
        Assert.Equal("open", row.Status);
        Assert.Equal("Wygląda na oszustwo", row.Details);
        Assert.Equal("ala@example.com", row.ContactEmail);
    }

    [Fact]
    public async Task Contact_email_is_optional() =>
        await Svc.CreateReportAsync(_job.Slug, new JobReportRequest("other"), default);

    [Theory]
    [InlineData("bogus", null, null)]
    [InlineData("scam", "not-an-email", null)]
    public async Task Invalid_reports_are_rejected_and_nothing_is_stored(string reason, string? email, string? details)
    {
        await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.CreateReportAsync(_job.Slug, new JobReportRequest(reason, details, email), default));
        Assert.Empty(_fx.FreshDb().JobReports);
    }

    [Fact]
    public async Task Details_over_1000_characters_are_rejected() =>
        await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.CreateReportAsync(_job.Slug, new JobReportRequest("other", new string('x', 1001)), default));

    [Fact]
    public async Task Reporting_an_unknown_listing_is_a_404() =>
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.CreateReportAsync("no-such-job", new JobReportRequest("other"), default));

    [Fact]
    public async Task The_admin_list_never_exposes_the_reporters_email_and_filters_by_status()
    {
        await Svc.CreateReportAsync(_job.Slug, new JobReportRequest("scam", null, "secret@example.com"), default);
        var all = await Svc.ListReportsAsync(new AdminReportQuery(), default);
        Assert.Equal(1, all.Total);
        Assert.DoesNotContain("secret@example.com", System.Text.Json.JsonSerializer.Serialize(all));
        Assert.Equal(0, (await Svc.ListReportsAsync(new AdminReportQuery(Status: "dismissed"), default)).Total);
    }

    [Fact]
    public async Task Actioning_a_report_unpublishes_the_live_listing_and_records_who_did_it()
    {
        await Svc.CreateReportAsync(_job.Slug, new JobReportRequest("illegal"), default);
        var id = _fx.FreshDb().JobReports.Single().Id;

        await Svc.ResolveReportAsync(id, "admin-1", new AdminResolveReportRequest("actioned", "  potwierdzone "), default);

        var db = _fx.FreshDb();
        var report = db.JobReports.Single();
        Assert.Equal("actioned", report.Status);
        Assert.Equal("admin-1", report.ResolvedBy);
        Assert.Equal("potwierdzone", report.ResolveNote);
        Assert.NotNull(report.ResolvedAt);
        var job = db.Jobs.Single(j => j.Id == _job.Id);
        Assert.Equal(JobStatuses.Closed, job.Status);
        Assert.Equal("Reported as illegal", job.UnpublishReason);
    }

    [Fact]
    public async Task Dismissing_a_report_leaves_the_listing_published()
    {
        await Svc.CreateReportAsync(_job.Slug, new JobReportRequest("misleading"), default);
        var id = _fx.FreshDb().JobReports.Single().Id;

        await Svc.ResolveReportAsync(id, "admin-1", new AdminResolveReportRequest("dismissed"), default);

        var db = _fx.FreshDb();
        Assert.Equal("dismissed", db.JobReports.Single().Status);
        Assert.Equal(JobStatuses.Published, db.Jobs.Single(j => j.Id == _job.Id).Status);
    }

    [Fact]
    public async Task Resolving_validates_the_outcome_and_the_report_must_exist()
    {
        await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.ResolveReportAsync(Guid.NewGuid(), "a", new AdminResolveReportRequest("maybe"), default));
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.ResolveReportAsync(Guid.NewGuid(), "a", new AdminResolveReportRequest("dismissed"), default));
    }
}
