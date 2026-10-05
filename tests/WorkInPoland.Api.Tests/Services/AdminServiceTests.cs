using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

public class AdminServiceTests : IDisposable
{
    private readonly ServiceFixture _fx = new();
    private readonly Domain.Company _acme = TestData.Company("Acme sp. z o.o.");
    private readonly Domain.Company _beta = TestData.Company("Beta S.A.", owner: "owner-2", verified: true);
    private readonly Domain.JobListing _live;
    private readonly Domain.JobListing _draft;

    public AdminServiceTests()
    {
        _live = TestData.Job(_acme, "Live Backend");
        _draft = TestData.Job(_beta, "Draft Product", status: JobStatuses.Draft);
        _fx.Db.Companies.AddRange(_acme, _beta);
        _fx.Db.Jobs.AddRange(_live, _draft);
        _fx.Db.SaveChanges();
    }

    public void Dispose() => _fx.Dispose();

    private AdminService Svc => _fx.Get<AdminService>();

    [Fact]
    public async Task Admin_lists_jobs_of_every_company_and_filters()
    {
        Assert.Equal(2, (await Svc.ListJobsAsync(new AdminJobQuery(), default)).Total);
        Assert.Equal(["Draft Product"], (await Svc.ListJobsAsync(new AdminJobQuery(Status: "draft"), default)).Items.Select(j => j.Title));
        Assert.Equal(["Live Backend"], (await Svc.ListJobsAsync(new AdminJobQuery(Q: "acme"), default)).Items.Select(j => j.Title));
    }

    [Fact]
    public async Task Unpublish_closes_the_listing_and_keeps_the_reason()
    {
        var result = await Svc.UnpublishJobAsync("admin-1", _live.Id, new UnpublishRequest("  Fałszywa oferta  "), default);
        Assert.Equal(JobStatuses.Closed, result.Status);
        Assert.Equal("Fałszywa oferta", _fx.FreshDb().Jobs.Single(j => j.Id == _live.Id).UnpublishReason);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Unpublish_needs_a_reason(string reason) =>
        await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.UnpublishJobAsync("admin-1", _live.Id, new UnpublishRequest(reason), default));

    [Fact]
    public async Task Unpublish_rejects_a_reason_over_500_characters() =>
        await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.UnpublishJobAsync("admin-1", _live.Id, new UnpublishRequest(new string('r', 501)), default));

    [Fact]
    public async Task Only_published_listings_can_be_unpublished_or_promoted()
    {
        await Assert.ThrowsAsync<ConflictException>(() => Svc.UnpublishJobAsync("a", _draft.Id, new UnpublishRequest("x"), default));
        await Assert.ThrowsAsync<ConflictException>(() => Svc.PromoteJobAsync("a", _draft.Id, new PromoteRequest(7), default));
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.PromoteJobAsync("a", Guid.NewGuid(), new PromoteRequest(7), default));
    }

    [Fact]
    public async Task Promote_sets_a_promotion_window_that_ends()
    {
        var promoted = await Svc.PromoteJobAsync("admin-1", _live.Id, new PromoteRequest(7), default);
        Assert.True(promoted.IsPromoted);
        Assert.Equal(TestData.Now.AddDays(7), _fx.FreshDb().Jobs.Single(j => j.Id == _live.Id).PromotedUntil);
        _fx.Clock.Advance(TimeSpan.FromDays(8));
        Assert.False((await _fx.Get<EmployerService>().GetJobAsync("owner-1", _live.Id, default)).IsPromoted);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(91)]
    [InlineData(-3)]
    public async Task Promotion_days_are_limited_to_1_to_90(int days) =>
        await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.PromoteJobAsync("admin-1", _live.Id, new PromoteRequest(days), default));

    [Fact]
    public async Task Verify_and_unverify_toggle_the_flag_for_any_company()
    {
        Assert.True((await Svc.SetVerifiedAsync("admin-1", _acme.Id, true, default)).IsVerified);
        Assert.False((await Svc.SetVerifiedAsync("admin-1", _beta.Id, false, default)).IsVerified);
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.SetVerifiedAsync("admin-1", Guid.NewGuid(), true, default));
    }

    [Fact]
    public async Task Companies_are_listed_with_filters_and_clamped_paging()
    {
        Assert.Equal(2, (await Svc.ListCompaniesAsync(new AdminCompanyQuery(), default)).Total);
        Assert.Equal(["Beta S.A."], (await Svc.ListCompaniesAsync(new AdminCompanyQuery(Verified: true), default)).Items.Select(c => c.Name));
        Assert.Equal(["Acme sp. z o.o."], (await Svc.ListCompaniesAsync(new AdminCompanyQuery(Q: "acme"), default)).Items.Select(c => c.Name));
        Assert.Equal(100, (await Svc.ListCompaniesAsync(new AdminCompanyQuery(Limit: 9999), default)).Limit);
    }
}
