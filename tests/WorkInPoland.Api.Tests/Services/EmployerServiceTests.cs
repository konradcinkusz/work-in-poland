using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Domain;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

public class EmployerServiceTests : IDisposable
{
    private const string Owner = "owner-1";
    private const string Intruder = "owner-2";
    private readonly ServiceFixture _fx = new(new WorkInPoland.Api.Infrastructure.JobsOptions { ListingLifetimeDays = 30, MaxPublishedPerCompany = 2 });

    public void Dispose() => _fx.Dispose();

    private EmployerService Svc => _fx.Get<EmployerService>();

    private async Task<CompanyDetailDto> NewCompany(string owner = Owner, string name = "Acme sp. z o.o.") =>
        await Svc.CreateCompanyAsync(owner, TestData.CompanyInput(name), default);

    private async Task<EmployerJobDto> NewJob(Guid companyId, bool publish = true, string title = "Senior Backend Engineer") =>
        await Svc.CreateJobAsync(Owner, TestData.JobInput(companyId, title, publish), default);

    // ---- companies ----

    [Fact]
    public async Task Creating_a_company_derives_a_folded_slug_and_keeps_the_nip_in_the_employer_view()
    {
        var company = await Svc.CreateCompanyAsync(Owner, TestData.CompanyInput("Źródło Łączności sp. z o.o.", "1234563218"), default);
        Assert.Equal("zrodlo-lacznosci-sp-z-o-o", company.Slug);
        Assert.Equal("1234563218", company.Nip);
        Assert.False(company.IsVerified);
    }

    [Fact]
    public async Task Company_slugs_are_unique()
    {
        var first = await NewCompany(name: "Acme");
        var second = await NewCompany(Intruder, "Acme");
        var third = await NewCompany(Intruder, "ACME");
        Assert.Equal(["acme", "acme-2", "acme-3"], new[] { first.Slug, second.Slug, third.Slug });
    }

    [Fact]
    public async Task An_invalid_company_is_rejected_with_field_errors()
    {
        var ex = await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.CreateCompanyAsync(Owner, new CompanyInput("A", "http://x", Nip: "123"), default));
        Assert.Equal(["name", "nip", "website"], ex.Errors.Keys.Order());
    }

    [Fact]
    public async Task Companies_are_listed_per_owner()
    {
        await NewCompany();
        await NewCompany(Intruder, "Other");
        Assert.Equal(["Acme sp. z o.o."], (await Svc.ListCompaniesAsync(Owner, default)).Select(c => c.Name));
    }

    [Fact]
    public async Task Updating_someone_elses_company_is_not_found()
    {
        var company = await NewCompany();
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.UpdateCompanyAsync(Intruder, company.Id, TestData.CompanyInput("Hacked"), default));
        Assert.Equal("Acme sp. z o.o.", _fx.FreshDb().Companies.Single().Name);
    }

    [Fact]
    public async Task Changing_name_or_nip_clears_verification_but_other_edits_keep_it()
    {
        var company = await NewCompany();
        var row = await _fx.Db.Companies.SingleAsync();
        row.IsVerified = true;
        await _fx.Db.SaveChangesAsync();

        var city = await Svc.UpdateCompanyAsync(Owner, company.Id, TestData.CompanyInput() with { City = "Gdańsk" }, default);
        Assert.True(city.IsVerified);
        var renamed = await Svc.UpdateCompanyAsync(Owner, company.Id, TestData.CompanyInput("Acme Nowa sp. z o.o."), default);
        Assert.False(renamed.IsVerified);

        row.IsVerified = true;
        await _fx.Db.SaveChangesAsync();
        var nip = await Svc.UpdateCompanyAsync(Owner, company.Id, TestData.CompanyInput("Acme Nowa sp. z o.o.", "1234563218"), default);
        Assert.False(nip.IsVerified);
        Assert.Equal(company.Slug, nip.Slug);
    }

    // ---- job creation ----

    [Fact]
    public async Task A_draft_can_be_saved_without_salaries_and_with_a_short_description()
    {
        var company = await NewCompany();
        var input = TestData.JobInput(company.Id, publish: false, salaries: [], skills: []) with { Description = "w toku", ApplyUrl = null };
        var draft = await Svc.CreateJobAsync(Owner, input, default);
        Assert.Equal(JobStatuses.Draft, draft.Status);
        Assert.Null(draft.PublishedAt);
        Assert.Null(draft.ExpiresAt);
        Assert.Empty(draft.Salaries);
    }

    [Fact]
    public async Task Creating_with_publish_runs_every_rule_and_sets_the_dates()
    {
        var company = await NewCompany();
        var bad = await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.CreateJobAsync(Owner, TestData.JobInput(company.Id, salaries: []), default));
        Assert.Contains("salaries", bad.Errors.Keys);
        Assert.Empty(_fx.FreshDb().Jobs);

        var job = await NewJob(company.Id);
        Assert.Equal(JobStatuses.Published, job.Status);
        Assert.Equal(TestData.Now, job.PublishedAt);
        Assert.Equal(TestData.Now.AddDays(30), job.ExpiresAt);
        Assert.Matches("^senior-backend-engineer-acme-[0-9a-f]{6}$", job.Slug);
    }

    [Fact]
    public async Task Skills_are_stored_normalised_and_salary_months_are_precomputed()
    {
        var company = await NewCompany();
        var job = await Svc.CreateJobAsync(Owner, TestData.JobInput(company.Id, skills: ["C#", " c# ", "SQL"], salaries: [TestData.B2b(100, 120, period: "hour")]), default);
        Assert.Equal(["c#", "sql"], job.Skills);
        var offer = _fx.FreshDb().Salaries.Single();
        Assert.Equal((20160m, 18480m), (offer.MonthlyMax, offer.MonthlyMidpoint));
    }

    [Fact]
    public async Task Creating_a_job_for_someone_elses_company_is_not_found()
    {
        var company = await NewCompany();
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.CreateJobAsync(Intruder, TestData.JobInput(company.Id), default));
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.CreateJobAsync(Owner, TestData.JobInput(Guid.NewGuid()), default));
    }

    [Fact]
    public async Task Two_listings_with_the_same_title_get_different_slugs()
    {
        var company = await NewCompany();
        var a = await NewJob(company.Id);
        var b = await NewJob(company.Id);
        Assert.NotEqual(a.Slug, b.Slug);
    }

    // ---- ownership ----

    [Fact]
    public async Task Every_job_operation_on_someone_elses_listing_is_not_found()
    {
        var company = await NewCompany();
        var job = await NewJob(company.Id, publish: false);
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.GetJobAsync(Intruder, job.Id, default));
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.UpdateJobAsync(Intruder, job.Id, TestData.JobInput(company.Id), default));
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.PublishJobAsync(Intruder, job.Id, default));
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.CloseJobAsync(Intruder, job.Id, default));
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.RenewJobAsync(Intruder, job.Id, default));
        await Assert.ThrowsAsync<NotFoundException>(() => Svc.DeleteJobAsync(Intruder, job.Id, default));
        Assert.Empty((await Svc.ListJobsAsync(Intruder, new EmployerJobQuery(), default)).Items);
        Assert.Single((await Svc.ListJobsAsync(Owner, new EmployerJobQuery(), default)).Items);
    }

    // ---- lifecycle ----

    [Fact]
    public async Task Draft_publish_close_renew_follows_the_lifecycle()
    {
        var company = await NewCompany();
        var draft = await NewJob(company.Id, publish: false);

        var published = await Svc.PublishJobAsync(Owner, draft.Id, default);
        Assert.Equal((JobStatuses.Published, TestData.Now.AddDays(30)), (published.Status, published.ExpiresAt));

        _fx.Clock.Advance(TimeSpan.FromDays(3));
        var closed = await Svc.CloseJobAsync(Owner, draft.Id, default);
        Assert.Equal(JobStatuses.Closed, closed.Status);

        var renewed = await Svc.RenewJobAsync(Owner, draft.Id, default);
        Assert.Equal(JobStatuses.Published, renewed.Status);
        Assert.Equal(TestData.Now.AddDays(33), renewed.ExpiresAt);
    }

    [Fact]
    public async Task Publishing_revalidates_the_stored_draft()
    {
        var company = await NewCompany();
        var draft = await Svc.CreateJobAsync(Owner, TestData.JobInput(company.Id, publish: false, salaries: []), default);
        var ex = await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.PublishJobAsync(Owner, draft.Id, default));
        Assert.Contains("salaries", ex.Errors.Keys);
        Assert.Equal(JobStatuses.Draft, (await Svc.GetJobAsync(Owner, draft.Id, default)).Status);
    }

    [Fact]
    public async Task Only_a_draft_can_be_published_only_a_live_job_closed_and_a_draft_cannot_be_renewed()
    {
        var company = await NewCompany();
        var live = await NewJob(company.Id);
        var draft = await NewJob(company.Id, publish: false);
        await Assert.ThrowsAsync<ConflictException>(() => Svc.PublishJobAsync(Owner, live.Id, default));
        await Assert.ThrowsAsync<ConflictException>(() => Svc.CloseJobAsync(Owner, draft.Id, default));
        await Assert.ThrowsAsync<ConflictException>(() => Svc.RenewJobAsync(Owner, draft.Id, default));
    }

    [Fact]
    public async Task Editing_is_allowed_while_draft_or_published_and_rejected_once_closed_or_expired()
    {
        var company = await NewCompany();
        var job = await NewJob(company.Id);
        var edited = await Svc.UpdateJobAsync(Owner, job.Id, TestData.JobInput(company.Id, "Staff Backend Engineer", skills: ["go"]), default);
        Assert.Equal(("Staff Backend Engineer", JobStatuses.Published), (edited.Title, edited.Status));
        Assert.Equal(job.Slug, edited.Slug);
        Assert.Equal(["go"], edited.Skills);

        await Svc.CloseJobAsync(Owner, job.Id, default);
        await Assert.ThrowsAsync<ConflictException>(() => Svc.UpdateJobAsync(Owner, job.Id, TestData.JobInput(company.Id), default));

        var second = await NewJob(company.Id);
        _fx.Clock.Advance(TimeSpan.FromDays(31));
        await Assert.ThrowsAsync<ConflictException>(() => Svc.UpdateJobAsync(Owner, second.Id, TestData.JobInput(company.Id), default));
    }

    [Fact]
    public async Task Editing_a_published_listing_applies_the_full_rules_but_a_draft_edit_does_not()
    {
        var company = await NewCompany();
        var live = await NewJob(company.Id);
        var draft = await NewJob(company.Id, publish: false);
        var thin = TestData.JobInput(company.Id, salaries: []);
        await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.UpdateJobAsync(Owner, live.Id, thin, default));
        Assert.Empty((await Svc.UpdateJobAsync(Owner, draft.Id, thin, default)).Salaries);
    }

    [Fact]
    public async Task Editing_replaces_salaries_without_leaving_orphans()
    {
        var company = await NewCompany();
        var job = await Svc.CreateJobAsync(Owner, TestData.JobInput(company.Id, salaries: [TestData.B2b(), TestData.Uop()]), default);
        await Svc.UpdateJobAsync(Owner, job.Id, TestData.JobInput(company.Id, salaries: [TestData.Uop(10000, 12000)]), default);
        var offer = Assert.Single(_fx.FreshDb().Salaries);
        Assert.Equal(("uop", 10000m), (offer.ContractType, offer.Min));
    }

    [Fact]
    public async Task A_listing_cannot_move_to_another_company()
    {
        var a = await NewCompany();
        var b = await NewCompany(name: "Beta");
        var job = await NewJob(a.Id);
        var ex = await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.UpdateJobAsync(Owner, job.Id, TestData.JobInput(b.Id), default));
        Assert.Contains("companyId", ex.Errors.Keys);
    }

    [Fact]
    public async Task The_published_cap_is_enforced_on_create_publish_and_renew()
    {
        var company = await NewCompany();
        var first = await NewJob(company.Id);
        await NewJob(company.Id);
        await Assert.ThrowsAsync<ConflictException>(() => NewJob(company.Id));
        var draft = await NewJob(company.Id, publish: false);
        await Assert.ThrowsAsync<ConflictException>(() => Svc.PublishJobAsync(Owner, draft.Id, default));

        await Svc.CloseJobAsync(Owner, first.Id, default);
        await Svc.PublishJobAsync(Owner, draft.Id, default);
        await Assert.ThrowsAsync<ConflictException>(() => Svc.RenewJobAsync(Owner, first.Id, default));
    }

    [Fact]
    public async Task Renewing_a_live_listing_does_not_count_it_against_itself()
    {
        var company = await NewCompany();
        await NewJob(company.Id);
        var second = await NewJob(company.Id);
        var renewed = await Svc.RenewJobAsync(Owner, second.Id, default);
        Assert.Equal(JobStatuses.Published, renewed.Status);
    }

    [Fact]
    public async Task Expired_listings_do_not_count_toward_the_cap_and_can_be_renewed()
    {
        var company = await NewCompany();
        var a = await NewJob(company.Id);
        await NewJob(company.Id);
        _fx.Clock.Advance(TimeSpan.FromDays(31));
        Assert.Equal(JobStatuses.Expired, (await Svc.GetJobAsync(Owner, a.Id, default)).Status);
        var renewed = await Svc.RenewJobAsync(Owner, a.Id, default);
        Assert.Equal(JobStatuses.Published, renewed.Status);
        await NewJob(company.Id);
    }

    [Fact]
    public async Task Only_drafts_can_be_deleted()
    {
        var company = await NewCompany();
        var draft = await NewJob(company.Id, publish: false);
        var live = await NewJob(company.Id);
        await Svc.DeleteJobAsync(Owner, draft.Id, default);
        await Assert.ThrowsAsync<ConflictException>(() => Svc.DeleteJobAsync(Owner, live.Id, default));
        Assert.Equal(live.Id, Assert.Single(_fx.FreshDb().Jobs).Id);
        Assert.Single(_fx.FreshDb().Salaries);
    }

    [Fact]
    public async Task The_list_filters_by_company_and_status_and_reports_expired_listings_as_expired()
    {
        var a = await NewCompany();
        var b = await NewCompany(name: "Beta");
        await NewJob(a.Id);
        await NewJob(a.Id, publish: false);
        await Svc.CreateJobAsync(Owner, TestData.JobInput(b.Id), default);
        Assert.Equal(3, (await Svc.ListJobsAsync(Owner, new EmployerJobQuery(), default)).Total);
        Assert.Equal(2, (await Svc.ListJobsAsync(Owner, new EmployerJobQuery(CompanyId: a.Id), default)).Total);
        Assert.Equal(2, (await Svc.ListJobsAsync(Owner, new EmployerJobQuery(Status: "published"), default)).Total);
        Assert.Equal(1, (await Svc.ListJobsAsync(Owner, new EmployerJobQuery(Status: "draft"), default)).Total);

        _fx.Clock.Advance(TimeSpan.FromDays(31));
        Assert.Equal(0, (await Svc.ListJobsAsync(Owner, new EmployerJobQuery(Status: "published"), default)).Total);
        Assert.Equal(2, (await Svc.ListJobsAsync(Owner, new EmployerJobQuery(Status: "expired"), default)).Total);
        await Assert.ThrowsAsync<ValidationFailedException>(() => Svc.ListJobsAsync(Owner, new EmployerJobQuery(Status: "bogus"), default));
    }

    [Fact]
    public async Task A_listing_unpublished_by_a_moderator_cannot_be_renewed_by_the_owner()
    {
        var company = await NewCompany();
        var job = await NewJob(company.Id);
        await _fx.Get<AdminService>().UnpublishJobAsync("admin-1", job.Id, new UnpublishRequest("spam"), default);
        await Assert.ThrowsAsync<ConflictException>(() => Svc.RenewJobAsync(Owner, job.Id, default));
    }
}
