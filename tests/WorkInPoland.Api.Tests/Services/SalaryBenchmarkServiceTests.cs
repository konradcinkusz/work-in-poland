using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

public class SalaryBenchmarkServiceTests : IDisposable
{
    private readonly ServiceFixture _fx = new();
    private readonly Domain.Company _company = TestData.Company();

    public void Dispose() => _fx.Dispose();

    private async Task Add(params Domain.JobListing[] jobs)
    {
        _fx.Db.Companies.Add(_company);
        _fx.Db.Jobs.AddRange(jobs);
        await _fx.Db.SaveChangesAsync();
    }

    private Domain.JobListing B2bJob(decimal min, decimal max, string title = "Dev", string city = "Warszawa", string currency = "PLN", string period = "month", string seniority = "mid") =>
        TestData.Job(_company, title, city: city, seniority: seniority, salaries: [TestData.B2b(min, max, currency, period)]);

    [Fact]
    public async Task Fewer_than_three_offers_report_only_the_sample_size()
    {
        await Add(B2bJob(10000, 12000), B2bJob(20000, 24000));
        var result = await _fx.Get<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(), default);
        Assert.Equal(2, result.SampleSize);
        Assert.Equal(3, result.MinimumSample);
        Assert.Null(result.Min);
        Assert.Null(result.P25);
        Assert.Null(result.Median);
        Assert.Null(result.P75);
        Assert.Null(result.Max);
    }

    [Fact]
    public async Task Three_offers_produce_percentiles_over_midpoints()
    {
        await Add(B2bJob(10000, 12000), B2bJob(18000, 22000), B2bJob(28000, 36000));
        var result = await _fx.Get<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(), default);
        Assert.Equal(3, result.SampleSize);
        Assert.Equal(11000m, result.Min);
        Assert.Equal(15500m, result.P25);
        Assert.Equal(20000m, result.Median);
        Assert.Equal(26000m, result.P75);
        Assert.Equal(32000m, result.Max);
        Assert.Equal(("PLN", "b2b", "net", "month"), (result.Currency, result.ContractType, result.Basis, result.Period));
    }

    [Fact]
    public async Task Hourly_offers_are_normalised_to_a_month_before_comparing()
    {
        await Add(B2bJob(100, 100, period: "hour"), B2bJob(16800, 16800), B2bJob(16800, 16800));
        var result = await _fx.Get<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(), default);
        Assert.Equal(16800m, result.Min);
        Assert.Equal(16800m, result.Max);
    }

    [Fact]
    public async Task Gross_and_net_are_never_mixed()
    {
        // Three UoP (gross) offers and three B2B (net) offers with very different levels.
        var uop = Enumerable.Range(0, 3).Select(i => TestData.Job(_company, "U" + i, salaries: [TestData.Uop(10000 + (i * 1000), 10000 + (i * 1000))])).ToArray();
        var b2b = Enumerable.Range(0, 3).Select(i => B2bJob(30000, 30000, "B" + i)).ToArray();
        await Add([.. uop, .. b2b]);
        var net = await _fx.Get<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(ContractType: "b2b"), default);
        var gross = await _fx.Get<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(ContractType: "uop"), default);
        Assert.Equal((3, 30000m, "net"), (net.SampleSize, net.Median, net.Basis));
        Assert.Equal((3, 11000m, "gross"), (gross.SampleSize, gross.Median, gross.Basis));
    }

    [Fact]
    public async Task An_offer_whose_basis_does_not_match_the_contract_type_is_excluded()
    {
        var odd = TestData.Job(_company, "Gross B2B", salaries: [new SalaryOfferDto("b2b", 99000, 99000, "PLN", "month", "gross")]);
        await Add(odd, B2bJob(10000, 10000), B2bJob(10000, 10000), B2bJob(10000, 10000));
        var result = await _fx.Get<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(), default);
        Assert.Equal(3, result.SampleSize);
        Assert.Equal(10000m, result.Max);
    }

    [Fact]
    public async Task Currency_title_seniority_and_city_filters_narrow_the_sample()
    {
        await Add(
            B2bJob(10000, 10000, "Backend Developer", "Kraków", seniority: "senior"), B2bJob(11000, 11000, "Backend Developer", "Kraków", seniority: "senior"), B2bJob(12000, 12000, "Backend Developer", "Kraków", seniority: "senior"),
            B2bJob(5000, 5000, "Backend Developer", "Kraków", "EUR"), B2bJob(1, 1, "Tester", "Kraków"), B2bJob(1, 1, "Backend Developer", "Gdańsk", seniority: "junior"));
        var svc = _fx.Get<SalaryBenchmarkService>();
        Assert.Equal(3, (await svc.GetAsync(new BenchmarkQuery(Title: "backend", City: "kraków", Seniority: "senior"), default)).SampleSize);
        Assert.Equal(1, (await svc.GetAsync(new BenchmarkQuery(Currency: "EUR"), default)).SampleSize);
        Assert.Equal(1, (await svc.GetAsync(new BenchmarkQuery(Title: "tester"), default)).SampleSize);
    }

    [Fact]
    public async Task Closed_and_expired_listings_do_not_count()
    {
        await Add(
            B2bJob(10000, 10000), B2bJob(10000, 10000),
            TestData.Job(_company, "Closed", status: JobStatuses.Closed, salaries: [TestData.B2b(1, 1)]),
            TestData.Job(_company, "Stale", expiresAt: TestData.Now.AddDays(-1), salaries: [TestData.B2b(1, 1)]));
        Assert.Equal(2, (await _fx.Get<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(), default)).SampleSize);
    }

    [Theory]
    [InlineData("slavery", null, "contractType")]
    [InlineData(null, "ZZZ", "currency")]
    public async Task Unknown_contract_type_or_currency_is_a_validation_error(string? contract, string? currency, string field)
    {
        var ex = await Assert.ThrowsAsync<ValidationFailedException>(() => _fx.Get<SalaryBenchmarkService>().GetAsync(new BenchmarkQuery(ContractType: contract, Currency: currency), default));
        Assert.Contains(field, ex.Errors.Keys);
    }
}
