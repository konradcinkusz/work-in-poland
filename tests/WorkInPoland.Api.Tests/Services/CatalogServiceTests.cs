using WorkInPoland.Api.Domain;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

/// <summary>The search filter matrix of API.md section 3, translated to queries over a small hand-built market.</summary>
public class CatalogServiceTests : IDisposable
{
    private readonly ServiceFixture _fx = new();
    private readonly Company _acme = TestData.Company("Acme sp. z o.o.", verified: true);
    private readonly Company _beta = TestData.Company("Beta S.A.");
    private readonly Dictionary<string, JobListing> _jobs = [];

    public CatalogServiceTests()
    {
        var now = TestData.Now;
        _jobs["be-senior"] = TestData.Job(_acme, "Senior Backend Engineer", "backend", "senior", "hybrid", city: "Warszawa", skills: ["c#", "postgresql"], salaries: [TestData.B2b(20000, 28000), TestData.Uop(16000, 20000)], publishedAt: now.AddDays(-3));
        _jobs["fe-mid"] = TestData.Job(_acme, "Frontend Developer", "frontend", "mid", "remote", "poland", null, ["react", "typescript"], [TestData.B2b(14000, 18000)], publishedAt: now.AddDays(-2));
        _jobs["ml-eu"] = TestData.Job(_beta, "ML Engineer", "ai-ml", "senior", "remote", "eu", null, ["python", "pytorch"], [TestData.B2b(5000, 7000, "EUR")], publishedAt: now.AddDays(-1));
        _jobs["support"] = TestData.Job(_beta, "Support Agent", "support", "junior", "onsite", city: "Kraków", skills: ["zendesk"], salaries: [new SalaryOfferDto("zlecenie", 40, 50, "PLN", "hour", "gross")], publishedAt: now.AddDays(-4));
        _jobs["promo"] = TestData.Job(_beta, "QA Engineer", "qa", "mid", "hybrid", city: "Wrocław", skills: ["playwright", "c#"], salaries: [TestData.Uop(9000, 12000)], publishedAt: now.AddDays(-10), promotedUntil: now.AddDays(5));
        _jobs["closed"] = TestData.Job(_acme, "Closed Backend", status: JobStatuses.Closed);
        _jobs["draft"] = TestData.Job(_acme, "Draft Backend", status: JobStatuses.Draft);
        _jobs["expired-status"] = TestData.Job(_acme, "Expired Backend", status: JobStatuses.Expired);
        _jobs["past-expiry"] = TestData.Job(_acme, "Stale Backend", expiresAt: now.AddMinutes(-1));
        _fx.Db.Companies.AddRange(_acme, _beta);
        _fx.Db.Jobs.AddRange(_jobs.Values);
        _fx.Db.SaveChanges();
    }

    public void Dispose() => _fx.Dispose();

    private async Task<string[]> Titles(JobSearchQuery query) =>
        (await _fx.Get<CatalogService>().SearchJobsAsync(query, default)).Items.Select(j => j.Title).ToArray();

    [Fact]
    public async Task Only_published_and_not_expired_jobs_are_returned()
    {
        var page = await _fx.Get<CatalogService>().SearchJobsAsync(new JobSearchQuery(), default);
        Assert.Equal(5, page.Total);
        Assert.DoesNotContain(page.Items, j => j.Title is "Closed Backend" or "Draft Backend" or "Expired Backend" or "Stale Backend");
    }

    [Fact]
    public async Task A_published_job_past_its_expiry_is_hidden_without_any_sweep()
    {
        _fx.Clock.Advance(TimeSpan.FromDays(31));
        Assert.Empty(await Titles(new JobSearchQuery()));
    }

    [Theory]
    [InlineData("engineer", new[] { "ML Engineer", "QA Engineer", "Senior Backend Engineer" })]
    [InlineData("ACME", new[] { "Frontend Developer", "Senior Backend Engineer" })]
    [InlineData("pytorch", new[] { "ML Engineer" })]
    [InlineData("type", new[] { "Frontend Developer" })]
    [InlineData("nothing-matches", new string[0])]
    public async Task Free_text_matches_title_company_and_skills_case_insensitively(string q, string[] expected) =>
        Assert.Equal(expected, (await Titles(new JobSearchQuery(Q: q))).Order().ToArray());

    [Theory]
    [InlineData("backend", new[] { "Senior Backend Engineer" })]
    [InlineData("backend,frontend", new[] { "Frontend Developer", "Senior Backend Engineer" })]
    [InlineData("BACKEND , qa", new[] { "QA Engineer", "Senior Backend Engineer" })]
    public async Task Category_is_an_or_list(string category, string[] expected) =>
        Assert.Equal(expected, (await Titles(new JobSearchQuery(Category: category))).Order().ToArray());

    [Fact]
    public async Task Seniority_work_mode_and_remote_scope_filter()
    {
        Assert.Equal(["ML Engineer", "Senior Backend Engineer"], (await Titles(new JobSearchQuery(Seniority: "senior"))).Order());
        Assert.Equal(["Frontend Developer", "ML Engineer"], (await Titles(new JobSearchQuery(WorkMode: "remote"))).Order());
        Assert.Equal(["ML Engineer"], await Titles(new JobSearchQuery(RemoteScope: "eu")));
        Assert.Equal(["Frontend Developer", "ML Engineer"], (await Titles(new JobSearchQuery(RemoteScope: "poland,eu"))).Order());
    }

    [Fact]
    public async Task Contract_type_matches_jobs_with_an_offer_of_that_type()
    {
        Assert.Equal(["QA Engineer", "Senior Backend Engineer"], (await Titles(new JobSearchQuery(ContractType: "uop"))).Order());
        Assert.Equal(["Support Agent"], await Titles(new JobSearchQuery(ContractType: "zlecenie")));
    }

    [Fact]
    public async Task City_is_a_case_insensitive_exact_match()
    {
        Assert.Equal(["Support Agent"], await Titles(new JobSearchQuery(City: "kraków")));
        Assert.Empty(await Titles(new JobSearchQuery(City: "Krak")));
    }

    [Fact]
    public async Task Skills_must_all_be_present()
    {
        Assert.Equal(["QA Engineer", "Senior Backend Engineer"], (await Titles(new JobSearchQuery(Skills: "c#"))).Order());
        Assert.Equal(["QA Engineer"], await Titles(new JobSearchQuery(Skills: "c#,playwright")));
        Assert.Empty(await Titles(new JobSearchQuery(Skills: "c#,pytorch")));
    }

    [Fact]
    public async Task Salary_min_compares_the_normalised_monthly_maximum_in_the_requested_currency()
    {
        Assert.Equal(["Frontend Developer", "Senior Backend Engineer"], (await Titles(new JobSearchQuery(SalaryMin: 18000))).Order());
        // 50 PLN/h * 168 = 8400/month: below 9000, so only the hourly offer is excluded from >= 9000... and included for 8400.
        Assert.Contains("Support Agent", await Titles(new JobSearchQuery(SalaryMin: 8400)));
        Assert.DoesNotContain("Support Agent", await Titles(new JobSearchQuery(SalaryMin: 8401)));
        Assert.Equal(["ML Engineer"], await Titles(new JobSearchQuery(SalaryMin: 6000, Currency: "EUR")));
        Assert.Empty(await Titles(new JobSearchQuery(SalaryMin: 7001, Currency: "EUR")));
    }

    [Fact]
    public async Task Currency_alone_requires_an_offer_in_that_currency() =>
        Assert.Equal(["ML Engineer"], await Titles(new JobSearchQuery(Currency: "eur")));

    [Fact]
    public async Task Verified_only_keeps_verified_companies()
    {
        var titles = await Titles(new JobSearchQuery(VerifiedOnly: true));
        Assert.Equal(["Frontend Developer", "Senior Backend Engineer"], titles.Order());
    }

    [Fact]
    public async Task Relevance_puts_promoted_first_then_newest()
    {
        var titles = await Titles(new JobSearchQuery());
        Assert.Equal(["QA Engineer", "ML Engineer", "Frontend Developer", "Senior Backend Engineer", "Support Agent"], titles);
    }

    [Fact]
    public async Task Promotion_lapses_when_its_date_passes()
    {
        _fx.Clock.Advance(TimeSpan.FromDays(6));
        var page = await _fx.Get<CatalogService>().SearchJobsAsync(new JobSearchQuery(), default);
        Assert.Equal("ML Engineer", page.Items[0].Title);
        Assert.All(page.Items, j => Assert.False(j.IsPromoted));
    }

    [Fact]
    public async Task Newest_sorts_by_publication_date() =>
        Assert.Equal(["ML Engineer", "Frontend Developer", "Senior Backend Engineer", "Support Agent", "QA Engineer"], await Titles(new JobSearchQuery(Sort: "newest")));

    [Fact]
    public async Task Salary_sort_puts_the_highest_normalised_maximum_first()
    {
        var titles = await Titles(new JobSearchQuery(Sort: "salary"));
        Assert.Equal("Senior Backend Engineer", titles[0]);
        Assert.Equal("Frontend Developer", titles[1]);
        Assert.Equal("ML Engineer", titles[^1]);
    }

    [Theory]
    [InlineData(0, 0, 1, 1)]
    [InlineData(-4, 5000, 1, 100)]
    [InlineData(2, 2, 2, 2)]
    [InlineData(null, null, 1, 20)]
    public async Task Page_and_limit_are_clamped_not_rejected(int? page, int? limit, int expectedPage, int expectedLimit)
    {
        var result = await _fx.Get<CatalogService>().SearchJobsAsync(new JobSearchQuery(Page: page, Limit: limit), default);
        Assert.Equal(expectedPage, result.Page);
        Assert.Equal(expectedLimit, result.Limit);
        Assert.Equal(5, result.Total);
    }

    [Fact]
    public async Task Paging_returns_disjoint_slices_with_the_full_total()
    {
        var first = await _fx.Get<CatalogService>().SearchJobsAsync(new JobSearchQuery(Limit: 2, Page: 1), default);
        var third = await _fx.Get<CatalogService>().SearchJobsAsync(new JobSearchQuery(Limit: 2, Page: 3), default);
        Assert.Equal(2, first.Items.Count);
        Assert.Single(third.Items);
        Assert.Equal(5, third.Total);
    }

    [Fact]
    public async Task Summaries_carry_salaries_skills_and_company()
    {
        var job = (await _fx.Get<CatalogService>().SearchJobsAsync(new JobSearchQuery(Q: "senior backend"), default)).Items.Single();
        Assert.Equal(["b2b", "uop"], job.Salaries.Select(s => s.ContractType));
        Assert.Equal(["c#", "postgresql"], job.Skills);
        Assert.True(job.Company.IsVerified);
    }

    // ---- detail, counters ----

    [Fact]
    public async Task Detail_increments_views_and_returns_the_description()
    {
        var slug = _jobs["be-senior"].Slug;
        var detail = await _fx.Get<CatalogService>().GetJobAsync(slug, default);
        await _fx.Get<CatalogService>().GetJobAsync(slug, default);
        Assert.Equal(TestData.LongDescription, detail.Description);
        Assert.Equal(2, _fx.FreshDb().Jobs.Single(j => j.Slug == slug).Views);
    }

    [Theory]
    [InlineData("closed")]
    [InlineData("draft")]
    [InlineData("expired-status")]
    [InlineData("past-expiry")]
    public async Task Detail_of_anything_not_live_is_not_found_and_not_counted(string key)
    {
        await Assert.ThrowsAsync<NotFoundException>(() => _fx.Get<CatalogService>().GetJobAsync(_jobs[key].Slug, default));
        Assert.Equal(0, _fx.FreshDb().Jobs.Single(j => j.Id == _jobs[key].Id).Views);
    }

    [Fact]
    public async Task Apply_click_counts_and_returns_the_employer_url()
    {
        var result = await _fx.Get<CatalogService>().RegisterApplyClickAsync(_jobs["fe-mid"].Slug, default);
        Assert.Equal("https://acme.example/apply", result.ApplyUrl);
        Assert.Equal(1, _fx.FreshDb().Jobs.Single(j => j.Id == _jobs["fe-mid"].Id).ApplyClicks);
    }

    [Fact]
    public async Task Apply_click_on_a_closed_job_is_not_found() =>
        await Assert.ThrowsAsync<NotFoundException>(() => _fx.Get<CatalogService>().RegisterApplyClickAsync(_jobs["closed"].Slug, default));

    // ---- companies, meta, stats ----

    [Fact]
    public async Task Companies_list_counts_open_jobs_only()
    {
        var page = await _fx.Get<CatalogService>().SearchCompaniesAsync(new CompanyQuery(), default);
        Assert.Equal(2, page.Total);
        Assert.Equal(2, page.Items.Single(c => c.Name == "Acme sp. z o.o.").OpenJobs);
        Assert.Equal(3, page.Items.Single(c => c.Name == "Beta S.A.").OpenJobs);
    }

    [Fact]
    public async Task Companies_filter_by_name_and_verification()
    {
        Assert.Equal(["Beta S.A."], (await _fx.Get<CatalogService>().SearchCompaniesAsync(new CompanyQuery(Q: "bet"), default)).Items.Select(c => c.Name));
        Assert.Equal(["Acme sp. z o.o."], (await _fx.Get<CatalogService>().SearchCompaniesAsync(new CompanyQuery(VerifiedOnly: true), default)).Items.Select(c => c.Name));
    }

    [Fact]
    public async Task A_company_without_open_jobs_is_not_listed()
    {
        var idle = TestData.Company("Idle sp. z o.o.");
        _fx.Db.Companies.Add(idle);
        await _fx.Db.SaveChangesAsync();
        Assert.DoesNotContain((await _fx.Get<CatalogService>().SearchCompaniesAsync(new CompanyQuery(), default)).Items, c => c.Name == "Idle sp. z o.o.");
    }

    [Fact]
    public async Task Company_detail_lists_open_jobs_and_never_exposes_the_nip()
    {
        _acme.Nip = "1234563218";
        await _fx.Db.SaveChangesAsync();
        var detail = await _fx.Get<CatalogService>().GetCompanyAsync(_acme.Slug, default);
        Assert.Equal(2, detail.OpenJobs.Count);
        Assert.DoesNotContain("1234563218", System.Text.Json.JsonSerializer.Serialize(detail));
    }

    [Fact]
    public async Task Company_detail_is_not_found_for_unknown_slugs_and_for_companies_that_never_published()
    {
        var idle = TestData.Company("Idle sp. z o.o.");
        _fx.Db.Companies.Add(idle);
        await _fx.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<NotFoundException>(() => _fx.Get<CatalogService>().GetCompanyAsync("nope", default));
        await Assert.ThrowsAsync<NotFoundException>(() => _fx.Get<CatalogService>().GetCompanyAsync(idle.Slug, default));
    }

    [Fact]
    public async Task Filter_values_carry_every_vocabulary_and_only_cities_with_a_live_job()
    {
        var filters = await _fx.Get<CatalogService>().GetFilterValuesAsync(default);
        Assert.Equal(["Kraków", "Warszawa", "Wrocław"], filters.Cities);
        Assert.Equal(Vocabulary.Categories, filters.Categories);
        Assert.Equal(Vocabulary.ApplicationStatuses, filters.ApplicationStatuses);
        Assert.Equal(Vocabulary.Currencies, filters.Currencies);
    }

    [Fact]
    public async Task Stats_count_live_jobs_and_companies_with_live_jobs()
    {
        var stats = await _fx.Get<CatalogService>().GetStatsAsync(default);
        Assert.Equal(new StatsDto(5, 2), stats);
    }
}
