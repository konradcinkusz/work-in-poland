using WorkInPoland.Api.Services;

namespace WorkInPoland.Api.Tests.Services;

public class NipTests
{
    [Theory]
    [InlineData("1234563218")]
    [InlineData("5260250995")]
    public void Valid_checksums_are_accepted(string nip) => Assert.True(Nip.IsValid(nip));

    [Theory]
    [InlineData("1234563219", "wrong check digit")]
    [InlineData("123456321", "too short")]
    [InlineData("12345632180", "too long")]
    [InlineData("12345A3218", "not digits")]
    [InlineData("123-456-32-18", "formatted")]
    [InlineData("", "empty")]
    [InlineData("1234567890", "remainder 10 is never valid")]
    public void Invalid_values_are_rejected(string nip, string why)
    {
        _ = why;
        Assert.False(Nip.IsValid(nip));
    }

    [Fact]
    public void Null_is_rejected() => Assert.False(Nip.IsValid(null));
}
