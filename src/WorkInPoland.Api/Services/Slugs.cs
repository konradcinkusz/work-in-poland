using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace WorkInPoland.Api.Services;

/// <summary>URL slugs with Polish diacritics folded to ASCII.</summary>
public static partial class Slugs
{
    private const string PolishFrom = "ąćęłńóśźżĄĆĘŁŃÓŚŹŻ";
    private const string PolishTo = "acelnoszzACELNOSZZ";

    public static string Slugify(string? value, int maxLength = 80)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var folded = new StringBuilder(value.Length);
        foreach (var c in value.Normalize(NormalizationForm.FormC))
        {
            var i = PolishFrom.IndexOf(c);
            folded.Append(i >= 0 ? PolishTo[i] : c);
        }

        var ascii = new StringBuilder();
        foreach (var c in folded.ToString().Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            {
                ascii.Append(c);
            }
        }

        var slug = NonSlug().Replace(ascii.ToString().ToLowerInvariant(), "-").Trim('-');
        return slug.Length <= maxLength ? slug : slug[..maxLength].TrimEnd('-');
    }

    /// <summary>Kebab title + company (legal form dropped) + short random suffix.</summary>
    public static string ForJob(string title, string companyName)
    {
        var company = Slugify(LegalForm().Replace(companyName, string.Empty), 30);
        var parts = new[] { Slugify(title, 60), company, RandomSuffix() }.Where(p => p.Length > 0);
        return string.Join('-', parts);
    }

    public static string RandomSuffix() => Convert.ToHexString(RandomNumberGenerator.GetBytes(3)).ToLowerInvariant();

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonSlug();

    [GeneratedRegex(@"\s+(sp\.?\s*z\s*o\.?\s*o\.?|s\.?\s*a\.?|sp\.?\s*k\.?|sp\.?\s*j\.?)\s*$", RegexOptions.IgnoreCase)]
    private static partial Regex LegalForm();
}
