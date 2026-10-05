using WorkInPoland.Api.Services;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Services;

public class SalaryNormalizerTests
{
    [Theory]
    [InlineData(20000, "month", 20000)]
    [InlineData(100, "hour", 16800)]
    [InlineData(800, "day", 16800)]
    [InlineData(33.33, "hour", 5599.44)]
    public void Amounts_are_normalised_to_a_month(decimal amount, string period, decimal expected) =>
        Assert.Equal(expected, SalaryNormalizer.ToMonthly(amount, period));

    [Fact]
    public void Midpoint_is_computed_before_normalising() =>
        Assert.Equal(16800m, SalaryNormalizer.Midpoint(new SalaryOfferDto("b2b", 90, 110, "PLN", "hour", "net")));

    [Theory]
    [InlineData("uop", "gross")]
    [InlineData("b2b", "net")]
    [InlineData("zlecenie", "net")]
    [InlineData("dzielo", "net")]
    public void Basis_follows_the_contract_type(string contract, string basis) => Assert.Equal(basis, SalaryNormalizer.BasisFor(contract));

    [Fact]
    public void Percentiles_interpolate_between_ranks()
    {
        decimal[] values = [10, 20, 30, 40, 50];
        Assert.Equal(20m, SalaryNormalizer.Percentile(values, 0.25));
        Assert.Equal(30m, SalaryNormalizer.Percentile(values, 0.5));
        Assert.Equal(45m, SalaryNormalizer.Percentile(values, 0.875));
        decimal[] even = [10, 20, 30, 40];
        Assert.Equal(25m, SalaryNormalizer.Percentile(even, 0.5));
        Assert.Equal(17.5m, SalaryNormalizer.Percentile(even, 0.25));
    }
}
