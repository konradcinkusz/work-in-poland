using WorkInPoland.Api.Services;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

/// <summary>One test per rule of API.md section 7, for drafts (shape only) and for publish (everything).</summary>
public class ValidatorsTests
{
    private static readonly Guid CompanyId = Guid.NewGuid();

    private static Dictionary<string, string[]> Check(JobInput input, bool publish)
    {
        var errors = new ErrorBag();
        Validators.ValidateJob(Validators.Normalize(input), publish, errors);
        return errors.ToDictionary().ToDictionary(e => e.Key, e => e.Value);
    }

    private static JobInput Valid() => TestData.JobInput(CompanyId);

    [Fact]
    public void A_complete_listing_is_valid_for_publish() => Assert.Empty(Check(Valid(), publish: true));

    [Theory]
    [InlineData("abcd", true, true)]
    [InlineData("abcde", true, false)]
    [InlineData("", false, true)]
    [InlineData("abc", false, false)]
    public void Title_length_is_5_to_120_on_publish_and_non_empty_on_draft(string title, bool publish, bool fails)
    {
        var errors = Check(Valid() with { Title = title }, publish);
        Assert.Equal(fails, errors.ContainsKey("title"));
    }

    [Fact]
    public void Title_over_120_characters_fails_even_as_a_draft() =>
        Assert.Contains("title", Check(Valid() with { Title = new string('a', 121) }, publish: false).Keys);

    [Fact]
    public void Description_needs_50_characters_to_publish_but_not_as_a_draft()
    {
        var shortText = Valid() with { Description = "krótki" };
        Assert.Contains("description", Check(shortText, publish: true).Keys);
        Assert.DoesNotContain("description", Check(shortText, publish: false).Keys);
    }

    [Fact]
    public void Description_over_20000_characters_fails_even_as_a_draft() =>
        Assert.Contains("description", Check(Valid() with { Description = new string('x', 20_001) }, publish: false).Keys);

    [Theory]
    [InlineData("https://acme.example/apply", false)]
    [InlineData("http://acme.example/apply", true)]
    [InlineData("ftp://acme.example", true)]
    [InlineData("/relative", true)]
    [InlineData("https://user:secret@acme.example/apply", true)]
    [InlineData("javascript:alert(1)", true)]
    public void Apply_url_must_be_an_https_url_without_credentials(string url, bool fails) =>
        Assert.Equal(fails, Check(Valid() with { ApplyUrl = url }, publish: true).ContainsKey("applyUrl"));

    [Fact]
    public void Apply_url_over_500_characters_fails() =>
        Assert.Contains("applyUrl", Check(Valid() with { ApplyUrl = "https://acme.example/" + new string('a', 490) }, publish: false).Keys);

    [Fact]
    public void Apply_url_is_required_to_publish_but_optional_in_a_draft()
    {
        var none = Valid() with { ApplyUrl = null };
        Assert.Contains("applyUrl", Check(none, publish: true).Keys);
        Assert.DoesNotContain("applyUrl", Check(none, publish: false).Keys);
    }

    [Fact]
    public void Skills_are_trimmed_lowercased_and_deduplicated()
    {
        var normalized = Validators.Normalize(Valid() with { Skills = [" C# ", "c#", "PostgreSQL", "  "] });
        Assert.Equal(["c#", "postgresql"], normalized.Skills);
    }

    [Fact]
    public void Between_1_and_15_skills_are_required_to_publish()
    {
        Assert.Contains("skills", Check(Valid() with { Skills = [] }, publish: true).Keys);
        Assert.DoesNotContain("skills", Check(Valid() with { Skills = Enumerable.Range(1, 15).Select(i => "s" + i).ToList() }, publish: true).Keys);
        Assert.Contains("skills", Check(Valid() with { Skills = Enumerable.Range(1, 16).Select(i => "s" + i).ToList() }, publish: false).Keys);
    }

    [Fact]
    public void A_skill_over_40_characters_fails() =>
        Assert.Contains("skills", Check(Valid() with { Skills = [new string('s', 41)] }, publish: false).Keys);

    [Fact]
    public void Remote_jobs_need_a_remote_scope_to_publish_and_city_is_optional()
    {
        var remote = Valid() with { WorkMode = "remote", City = null, RemoteScope = null };
        Assert.Contains("remoteScope", Check(remote, publish: true).Keys);
        Assert.DoesNotContain("city", Check(remote, publish: true).Keys);
        Assert.Empty(Check(remote with { RemoteScope = "eu" }, publish: true));
    }

    [Theory]
    [InlineData("hybrid")]
    [InlineData("onsite")]
    public void Non_remote_jobs_need_a_city_and_must_not_have_a_remote_scope(string mode)
    {
        Assert.Contains("city", Check(Valid() with { WorkMode = mode, City = null }, publish: true).Keys);
        Assert.Contains("remoteScope", Check(Valid() with { WorkMode = mode, RemoteScope = "poland" }, publish: false).Keys);
    }

    [Theory]
    [InlineData("category", "plumbing")]
    [InlineData("seniority", "guru")]
    [InlineData("workMode", "teleport")]
    public void Unknown_vocabulary_values_are_rejected_even_in_a_draft(string field, string value)
    {
        var input = field switch
        {
            "category" => Valid() with { Category = value },
            "seniority" => Valid() with { Seniority = value },
            _ => Valid() with { WorkMode = value },
        };
        Assert.Contains(field, Check(input, publish: false).Keys);
    }

    [Fact]
    public void Vocabulary_values_are_case_insensitive_on_input()
    {
        Assert.Empty(Check(Valid() with { Category = "BACKEND", Seniority = " Senior ", WorkMode = "Hybrid" }, publish: true));
    }

    [Fact]
    public void A_listing_without_a_salary_range_cannot_be_published_but_a_draft_may_omit_it()
    {
        var none = Valid() with { Salaries = [] };
        Assert.Contains("salaries", Check(none, publish: true).Keys);
        Assert.Empty(Check(none, publish: false));
    }

    [Fact]
    public void At_most_four_salary_offers_and_one_per_contract_type()
    {
        var five = Valid() with { Salaries = [TestData.B2b(), TestData.Uop(), new("zlecenie", 1, 2, "PLN", "month", "net"), new("dzielo", 1, 2, "PLN", "month", "net"), new("b2b", 1, 2, "EUR", "month", "net")] };
        Assert.Contains("salaries", Check(five, publish: false).Keys);
        var duplicate = Valid() with { Salaries = [TestData.B2b(), TestData.B2b(1000, 2000, "EUR")] };
        Assert.Contains("salaries", Check(duplicate, publish: false).Keys);
    }

    [Theory]
    [InlineData(0, 100, true)]
    [InlineData(-5, 100, true)]
    [InlineData(100, 99, true)]
    [InlineData(100, 100, false)]
    [InlineData(100, 10_000_000, false)]
    [InlineData(100, 10_000_001, true)]
    public void Salary_bounds_hold_on_publish(decimal min, decimal max, bool fails)
    {
        var input = Valid() with { Salaries = [new SalaryOfferDto("b2b", min, max, "PLN", "month", "net")] };
        Assert.Equal(fails, Check(input, publish: true).Keys.Any(k => k.StartsWith("salaries[0]")));
    }

    [Fact]
    public void Zero_minimum_passes_shape_validation_in_a_draft_but_not_publish()
    {
        var input = Valid() with { Salaries = [new SalaryOfferDto("b2b", 0, 100, "PLN", "month", "net")] };
        Assert.Empty(Check(input, publish: false));
        Assert.Contains("salaries[0].min", Check(input, publish: true).Keys);
    }

    [Fact]
    public void Amounts_have_at_most_two_decimals() =>
        Assert.Contains("salaries[0]", Check(Valid() with { Salaries = [TestData.B2b(100.123m, 200)] }, publish: false).Keys);

    [Theory]
    [InlineData("contractType", "slavery")]
    [InlineData("currency", "ZZZ")]
    [InlineData("period", "fortnight")]
    [InlineData("basis", "sort-of")]
    public void Salary_enumerations_are_validated(string field, string value)
    {
        var offer = field switch
        {
            "contractType" => TestData.B2b() with { ContractType = value },
            "currency" => TestData.B2b() with { Currency = value },
            "period" => TestData.B2b() with { Period = value },
            _ => TestData.B2b() with { Basis = value },
        };
        Assert.Contains($"salaries[0].{field}", Check(Valid() with { Salaries = [offer] }, publish: false).Keys);
    }

    [Fact]
    public void Currency_is_normalised_to_upper_case() =>
        Assert.Empty(Check(Valid() with { Salaries = [TestData.B2b(currency: "eur")] }, publish: true));

    // ---- companies ----

    private static Dictionary<string, string[]> CheckCompany(CompanyInput input)
    {
        var errors = new ErrorBag();
        Validators.ValidateCompany(Validators.Normalize(input), errors);
        return errors.ToDictionary().ToDictionary(e => e.Key, e => e.Value);
    }

    [Fact]
    public void A_valid_company_has_no_errors() => Assert.Empty(CheckCompany(TestData.CompanyInput(nip: "1234563218")));

    [Theory]
    [InlineData("A", true)]
    [InlineData("AB", false)]
    public void Company_name_has_a_minimum_length(string name, bool fails) =>
        Assert.Equal(fails, CheckCompany(TestData.CompanyInput(name)).ContainsKey("name"));

    [Fact]
    public void Company_website_and_logo_follow_the_https_rule()
    {
        var errors = CheckCompany(TestData.CompanyInput() with { Website = "http://acme.example", LogoUrl = "https://u:p@acme.example/l.png" });
        Assert.Contains("website", errors.Keys);
        Assert.Contains("logoUrl", errors.Keys);
        Assert.Empty(CheckCompany(TestData.CompanyInput() with { LogoUrl = null }));
    }

    [Fact]
    public void Company_description_is_limited_to_2000_characters() =>
        Assert.Contains("description", CheckCompany(TestData.CompanyInput() with { Description = new string('d', 2001) }).Keys);

    [Theory]
    [InlineData("1234563219", true)]
    [InlineData("1234563218", false)]
    [InlineData(null, false)]
    [InlineData("  ", false)]
    public void Nip_is_optional_but_must_carry_a_valid_checksum(string? nip, bool fails) =>
        Assert.Equal(fails, CheckCompany(TestData.CompanyInput() with { Nip = nip }).ContainsKey("nip"));
}
