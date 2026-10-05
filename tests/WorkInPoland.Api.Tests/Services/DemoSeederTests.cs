using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

public class DemoSeederTests : IDisposable
{
    private readonly ServiceFixture _fx = new();

    public void Dispose() => _fx.Dispose();

    [Fact]
    public async Task Seeding_inserts_realistic_published_listings_across_companies_and_categories()
    {
        var added = await _fx.Get<DemoSeeder>().SeedAsync(default);
        var db = _fx.FreshDb();
        var jobs = db.Jobs.ToList();
        Assert.Equal(added, jobs.Count);
        Assert.InRange(jobs.Count, 14, 20);
        Assert.True(db.Companies.Count() >= 6);
        Assert.True(jobs.Select(j => j.Category).Distinct().Count() >= 6);
        Assert.All(jobs, j => Assert.Equal(JobStatuses.Published, j.Status));
        Assert.All(db.Companies, c => Assert.Equal(DemoSeeder.OwnerUserId, c.OwnerUserId));
    }

    [Fact]
    public async Task Seeded_data_covers_the_features_a_demo_needs()
    {
        await _fx.Get<DemoSeeder>().SeedAsync(default);
        var db = _fx.FreshDb();
        Assert.Single(db.Companies.Where(c => c.IsVerified));
        Assert.Single(db.Jobs.Where(j => j.PromotedUntil != null));
        Assert.True(db.Salaries.Count(s => s.Currency == "EUR") >= 2);
        Assert.True(db.Salaries.Any(s => s.ContractType == "b2b") && db.Salaries.Any(s => s.ContractType == "uop"));
        Assert.Equal(["hybrid", "onsite", "remote"], db.Jobs.Select(j => j.WorkMode).Distinct().ToList().Order());
        var cities = db.Jobs.Select(j => j.City).Where(c => c != null).Distinct().ToList();
        Assert.Contains("Warszawa", cities);
        Assert.Contains("Kraków", cities);
        Assert.Contains("Wrocław", cities);
        Assert.Contains("Gdańsk", cities);
        Assert.Contains("Poznań", cities);
    }

    [Fact]
    public async Task Every_seeded_listing_passes_the_publish_rules_and_is_in_polish()
    {
        await _fx.Get<DemoSeeder>().SeedAsync(default);
        var db = _fx.FreshDb();
        foreach (var job in db.Jobs.ToList())
        {
            var loaded = _fx.Db.Jobs.Single(j => j.Id == job.Id);
            _fx.Db.Entry(loaded).Collection(j => j.Salaries).Load();
            _fx.Db.Entry(loaded).Collection(j => j.Skills).Load();
            var errors = new ErrorBag();
            Validators.ValidateJob(Mapper.ToInput(loaded), publish: true, errors);
            Assert.False(errors.Any, $"{job.Title}: {string.Join(", ", errors.ToDictionary().Keys)}");
            Assert.Contains("## Wymagania", job.Description);
        }
    }

    [Fact]
    public async Task Seeding_twice_is_insert_if_missing_and_never_overwrites_edits()
    {
        await _fx.Get<DemoSeeder>().SeedAsync(default);
        var edited = _fx.Db.Jobs.First();
        edited.Title = "Zmieniony przez operatora";
        _fx.Db.Companies.First().Name = "Zmieniona nazwa";
        await _fx.Db.SaveChangesAsync();
        var jobCount = _fx.FreshDb().Jobs.Count();

        Assert.Equal(0, await _fx.Get<DemoSeeder>().SeedAsync(default));

        var db = _fx.FreshDb();
        Assert.Equal(jobCount, db.Jobs.Count());
        Assert.Contains(db.Jobs, j => j.Title == "Zmieniony przez operatora");
        Assert.Contains(db.Companies, c => c.Name == "Zmieniona nazwa");
    }

    [Fact]
    public async Task Seed_data_uses_fictional_companies_with_unique_slugs()
    {
        await _fx.Get<DemoSeeder>().SeedAsync(default);
        var db = _fx.FreshDb();
        Assert.Equal(db.Jobs.Count(), db.Jobs.Select(j => j.Slug).Distinct().Count());
        Assert.All(db.Companies, c => Assert.EndsWith(".example", c.Website));
    }

    [Fact]
    public async Task Benchmarks_work_on_the_seeded_market()
    {
        await _fx.Get<DemoSeeder>().SeedAsync(default);
        var b2b = await _fx.Get<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(), default);
        var uop = await _fx.Get<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(ContractType: "uop"), default);
        Assert.True(b2b.SampleSize >= 3 && b2b.Median > 0);
        Assert.True(uop.SampleSize >= 3 && uop.Median > 0);
    }
}
