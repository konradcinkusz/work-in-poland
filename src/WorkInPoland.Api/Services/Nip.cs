namespace WorkInPoland.Api.Services;

/// <summary>Polish tax id (NIP) checksum: weighted sum of the first nine digits mod 11 equals the tenth.</summary>
public static class Nip
{
    private static readonly int[] Weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];

    public static bool IsValid(string? value)
    {
        if (value is not { Length: 10 } || !value.All(char.IsAsciiDigit))
        {
            return false;
        }

        var sum = 0;
        for (var i = 0; i < Weights.Length; i++)
        {
            sum += (value[i] - '0') * Weights[i];
        }

        var check = sum % 11;
        return check != 10 && check == value[9] - '0';
    }
}
