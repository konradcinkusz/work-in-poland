using WorkInPoland.Api.Services;

namespace WorkInPoland.Api.Tests.Services;

public class SlugsTests
{
    [Theory]
    [InlineData("Zażółć gęślą jaźń", "zazolc-gesla-jazn")]
    [InlineData("ĄĆĘŁŃÓŚŹŻ", "acelnoszz")]
    [InlineData("Senior C# / .NET Developer!", "senior-c-net-developer")]
    [InlineData("  Kraków -- Łódź  ", "krakow-lodz")]
    [InlineData("Café Müller", "cafe-muller")]
    public void Slugify_folds_polish_diacritics_and_kebab_cases(string input, string expected) =>
        Assert.Equal(expected, Slugs.Slugify(input));

    [Fact]
    public void Slugify_of_nothing_is_empty() => Assert.Equal(string.Empty, Slugs.Slugify("  "));

    [Fact]
    public void Slugify_truncates_without_leaving_a_trailing_dash() =>
        Assert.Equal("aaaa", Slugs.Slugify("aaaa bbbb", 5));

    [Fact]
    public void Job_slug_is_title_company_without_legal_form_and_a_hex_suffix()
    {
        var slug = Slugs.ForJob("Starszy Programista Łódź", "Źródło Danych sp. z o.o.");
        Assert.Matches("^starszy-programista-lodz-zrodlo-danych-[0-9a-f]{6}$", slug);
    }

    [Fact]
    public void Job_slugs_of_the_same_listing_differ_by_suffix() =>
        Assert.NotEqual(Slugs.ForJob("Dev", "Acme"), Slugs.ForJob("Dev", "Acme"));
}
