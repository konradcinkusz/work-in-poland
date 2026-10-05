using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Services;

/// <summary>Month-normalisation of salary offers (API.md section 3) and the basis implied by a contract type.</summary>
public static class SalaryNormalizer
{
    public const int HoursPerMonth = 168;
    public const int DaysPerMonth = 21;

    public static decimal ToMonthly(decimal amount, string period) => decimal.Round(period switch
    {
        "hour" => amount * HoursPerMonth,
        "day" => amount * DaysPerMonth,
        _ => amount,
    }, 2);

    /// <summary>UoP is compared gross, every other contract net (net of VAT for B2B).</summary>
    public static string BasisFor(string contractType) => contractType == "uop" ? "gross" : "net";

    public static decimal Midpoint(SalaryOfferDto offer) => ToMonthly((offer.Min + offer.Max) / 2m, offer.Period);

    /// <summary>Percentile with linear interpolation between closest ranks; <paramref name="sorted"/> must be ascending.</summary>
    public static decimal Percentile(IReadOnlyList<decimal> sorted, double fraction)
    {
        var rank = (sorted.Count - 1) * fraction;
        var lower = (int)Math.Floor(rank);
        var upper = (int)Math.Ceiling(rank);
        return decimal.Round(sorted[lower] + ((sorted[upper] - sorted[lower]) * (decimal)(rank - lower)), 2);
    }
}
