namespace HsmLis.Domain;

/// <summary>The Thai 13-digit citizen ID, whose last digit is a check digit over the first twelve.</summary>
public static class ThaiCitizenId
{
    public static bool IsValid(string id)
    {
        if (id.Length != 13 || !id.All(char.IsAsciiDigit)) return false;
        var sum = 0;
        for (var i = 0; i < 12; i++) sum += (id[i] - '0') * (13 - i);
        return (11 - sum % 11) % 10 == id[12] - '0';
    }

    /// <summary>Shows only the last four digits, e.g. x-xxxx-xxxxx-12-3.</summary>
    public static string Mask(string id) => id.Length == 13 ? $"x-xxxx-xxxx{id[9]}-{id[10..12]}-{id[12]}" : id;
}
