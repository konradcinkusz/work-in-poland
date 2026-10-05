using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

public class ListingExpiryTests : IDisposable
{
    private readonly ServiceFixture _fx = new();

    public void Dispose() => _fx.Dispose();

    [Fact]
    public async Task The_sweep_expires_overdue_published_listings_and_nothing_else()
    {
        var company = TestData.Company();
        var overdue = TestData.Job(company, "Overdue", expiresAt: TestData.Now.AddDays(-1));
        var fresh = TestData.Job(company, "Fresh");
        var closed = TestData.Job(company, "Closed", status: JobStatuses.Closed, expiresAt: TestData.Now.AddDays(-1));
        var draft = TestData.Job(company, "Draft", status: JobStatuses.Draft);
        draft.ExpiresAt = null;
        _fx.Db.Companies.Add(company);
        _fx.Db.Jobs.AddRange(overdue, fresh, closed, draft);
        await _fx.Db.SaveChangesAsync();

        var swept = await _fx.Get<ListingExpirySweep>().SweepAsync(default);

        Assert.Equal(1, swept);
        var statuses = _fx.FreshDb().Jobs.ToDictionary(j => j.Title, j => j.Status);
        Assert.Equal(JobStatuses.Expired, statuses["Overdue"]);
        Assert.Equal(JobStatuses.Published, statuses["Fresh"]);
        Assert.Equal(JobStatuses.Closed, statuses["Closed"]);
        Assert.Equal(JobStatuses.Draft, statuses["Draft"]);
    }

    [Fact]
    public async Task The_sweep_is_idempotent()
    {
        var company = TestData.Company();
        _fx.Db.Companies.Add(company);
        _fx.Db.Jobs.Add(TestData.Job(company, "Overdue", expiresAt: TestData.Now.AddHours(-1)));
        await _fx.Db.SaveChangesAsync();
        Assert.Equal(1, await _fx.Get<ListingExpirySweep>().SweepAsync(default));
        Assert.Equal(0, await _fx.Get<ListingExpirySweep>().SweepAsync(default));
    }

    [Fact]
    public async Task A_job_expires_exactly_at_its_expiry_instant()
    {
        var company = TestData.Company();
        var job = TestData.Job(company, "Boundary", expiresAt: TestData.Now.AddMinutes(10));
        _fx.Db.Companies.Add(company);
        _fx.Db.Jobs.Add(job);
        await _fx.Db.SaveChangesAsync();
        Assert.Equal(0, await _fx.Get<ListingExpirySweep>().SweepAsync(default));
        _fx.Clock.Advance(TimeSpan.FromMinutes(10));
        Assert.Equal(1, await _fx.Get<ListingExpirySweep>().SweepAsync(default));
    }
}
