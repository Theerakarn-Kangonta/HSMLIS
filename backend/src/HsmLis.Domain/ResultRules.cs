using System.Globalization;
using HsmLis.Domain.Entities;

namespace HsmLis.Domain;

/// <summary>Pure rules for judging a result against its reference interval.</summary>
public static class ResultRules
{
    /// <summary>
    /// The interval that fits the patient best: one for their sex beats one for both, and one
    /// with an age band that contains their age beats one without. Null when none applies.
    /// </summary>
    public static ReferenceRange? PickRange(IEnumerable<ReferenceRange> ranges, Sex sex, int? ageYears)
    {
        ReferenceRange? best = null;
        var bestScore = -1;
        foreach (var range in ranges)
        {
            if (range.Sex is { } rangeSex && rangeSex != sex) continue;
            var hasAge = range.AgeMinYears is not null || range.AgeMaxYears is not null;
            if (hasAge)
            {
                if (ageYears is not { } age) continue;
                if (range.AgeMinYears is { } min && age < min) continue;
                if (range.AgeMaxYears is { } max && age > max) continue;
            }
            var score = (range.Sex is null ? 0 : 2) + (hasAge ? 1 : 0);
            if (score > bestScore)
            {
                best = range;
                bestScore = score;
            }
        }
        return best;
    }

    /// <summary>The flag for <paramref name="value"/>. Critical limits win over the normal ones.</summary>
    public static ResultFlag Evaluate(ResultType type, string? value, ReferenceRange? range)
    {
        if (string.IsNullOrWhiteSpace(value)) return ResultFlag.None;
        var text = value.Trim();

        if (type is ResultType.Numeric or ResultType.NumericText && TryParseNumber(text, out var number))
        {
            if (range is null) return ResultFlag.None;
            if (range.CriticalLow is { } cl && number <= cl) return ResultFlag.CriticalLow;
            if (range.CriticalHigh is { } ch && number >= ch) return ResultFlag.CriticalHigh;
            if (range.Low is { } low && number < low) return ResultFlag.Low;
            if (range.High is { } high && number > high) return ResultFlag.High;
            return ResultFlag.None;
        }

        if (IsPositive(text)) return ResultFlag.Positive;
        if (range?.NormalText is { Length: > 0 } normal && !string.Equals(Normalize(normal), Normalize(text), StringComparison.Ordinal))
            return IsNegative(text) || IsNotReportable(text) ? ResultFlag.None : ResultFlag.Abnormal;
        return ResultFlag.None;
    }

    public static bool IsCritical(ResultFlag flag) => flag is ResultFlag.CriticalLow or ResultFlag.CriticalHigh;

    /// <summary>Why <paramref name="value"/> cannot be stored for a test of this type, or null when it can.</summary>
    public static string? Validate(ResultType type, string value, IReadOnlyCollection<string> options)
    {
        var text = value.Trim();
        if (text.Length == 0) return "result_empty";
        switch (type)
        {
            case ResultType.Numeric:
                return TryParseNumber(text, out _) ? null : "result_not_number";
            case ResultType.Choice:
            case ResultType.PosNeg:
                return options.Count == 0 || options.Contains(text, StringComparer.OrdinalIgnoreCase) ? null : "result_not_an_option";
            case ResultType.MultiChoice:
                return options.Count == 0 || text.Split(',').Select(p => p.Trim()).All(p => options.Contains(p, StringComparer.OrdinalIgnoreCase))
                    ? null
                    : "result_not_an_option";
            default:
                return null;
        }
    }

    /// <summary>A plain decimal, also with a leading &lt; or &gt; ("&lt;0.5" counts as 0.5).</summary>
    public static bool TryParseNumber(string text, out decimal number)
    {
        var trimmed = text.Trim().TrimStart('<', '>', '=', '≤', '≥').Trim().Replace(",", "");
        return decimal.TryParse(trimmed, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out number);
    }

    private static readonly string[] NegativeWords =
        ["negative", "neg", "non reactive", "non-reactive", "nonreactive", "not detected", "undetected", "no growth", "absent", "susceptible"];

    private static readonly string[] NotReportableWords = ["not done", "invalid", "insufficient", "rejected"];

    private static readonly string[] PositiveWords = ["positive", "pos", "reactive", "detected", "present", "resistant", "growth"];

    public static bool IsNegative(string text) => NegativeWords.Contains(Normalize(text));

    private static bool IsNotReportable(string text) => NotReportableWords.Contains(Normalize(text));

    /// <summary>Positive, Reactive, Detected, 1+…4+ and the like, but never their negations.</summary>
    public static bool IsPositive(string text)
    {
        var t = Normalize(text);
        if (IsNegative(t) || IsNotReportable(t)) return false;
        if (PositiveWords.Contains(t)) return true;
        // Graded positives: 1+, 2+, 3+, 4+ and "+".
        return t == "+" || (t.Length == 2 && char.IsDigit(t[0]) && t[1] == '+');
    }

    private static string Normalize(string text) => string.Join(' ', text.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));

    /// <summary>Whole years from <paramref name="birth"/> to <paramref name="today"/>.</summary>
    public static int? AgeInYears(DateOnly? birth, DateOnly today)
    {
        if (birth is not { } b || b > today) return null;
        var age = today.Year - b.Year;
        if (today < b.AddYears(age)) age--;
        return age;
    }

    /// <summary>Body-mass index, one decimal; null without both measurements.</summary>
    public static decimal? Bmi(decimal? weightKg, decimal? heightCm)
    {
        if (weightKg is not > 0 || heightCm is not > 0) return null;
        var metres = heightCm.Value / 100m;
        return Math.Round(weightKg.Value / (metres * metres), 1);
    }

    /// <summary>The reference interval as one line, e.g. "3.5 - 5.0", "&lt; 200", "Negative".</summary>
    public static string? Describe(ReferenceRange? range)
    {
        if (range is null) return null;
        if (range.NormalText is { Length: > 0 } text) return text;
        return (range.Low, range.High) switch
        {
            ({ } l, { } h) => $"{l.ToString(CultureInfo.InvariantCulture)} - {h.ToString(CultureInfo.InvariantCulture)}",
            ({ } l, null) => $"≥ {l.ToString(CultureInfo.InvariantCulture)}",
            (null, { } h) => $"≤ {h.ToString(CultureInfo.InvariantCulture)}",
            _ => null,
        };
    }
}

public static class OrderRules
{
    /// <summary>The order's status, derived from its specimens and results.</summary>
    public static OrderStatus StatusOf(bool cancelled, IEnumerable<ContainerStatus> containers, IEnumerable<ResultStatus> results)
    {
        if (cancelled) return OrderStatus.Cancelled;
        var active = results.Where(r => r != ResultStatus.Cancelled).ToList();
        if (active.Count > 0 && active.All(r => r == ResultStatus.Approved)) return OrderStatus.Completed;
        return containers.Any(c => c is ContainerStatus.Collected or ContainerStatus.Received)
            || active.Any(r => r != ResultStatus.Pending)
            ? OrderStatus.InProgress
            : OrderStatus.AwaitingCollection;
    }

    /// <summary>The price after a package's discount.</summary>
    public static decimal PackagePrice(decimal listPrice, DiscountType type, decimal value)
    {
        var discount = type == DiscountType.Percent ? Math.Round(listPrice * Math.Clamp(value, 0, 100) / 100m, 2) : value;
        return Math.Max(0, listPrice - discount);
    }

    /// <summary>
    /// Splits a package's price over its tests in proportion to their list prices, rounded to satang.
    /// The last test takes the rounding remainder, so the shares always add up to the package price.
    /// </summary>
    public static decimal[] PackageShares(decimal packagePrice, IReadOnlyList<decimal> listPrices)
    {
        var shares = new decimal[listPrices.Count];
        if (shares.Length == 0) return shares;
        var listTotal = listPrices.Sum();
        decimal given = 0;
        for (var i = 0; i < shares.Length - 1; i++)
        {
            shares[i] = listTotal == 0
                ? Math.Round(packagePrice / shares.Length, 2, MidpointRounding.AwayFromZero)
                : Math.Round(packagePrice * listPrices[i] / listTotal, 2, MidpointRounding.AwayFromZero);
            given += shares[i];
        }
        shares[^1] = packagePrice - given;
        return shares;
    }

    /// <summary>The baht taken off an order for a percentage discount, rounded to satang.</summary>
    public static decimal OrderDiscount(decimal subtotal, decimal percent) =>
        Math.Round(subtotal * Math.Clamp(percent, 0, 100) / 100m, 2, MidpointRounding.AwayFromZero);
}

public static class PasswordPolicy
{
    public const int MinLength = 12;

    /// <summary>A stable code for the first rule the password breaks, or null when it is good enough.</summary>
    public static string? Check(string password)
    {
        if (password.Length < MinLength) return "password_too_short";
        if (!password.Any(char.IsUpper)) return "password_needs_upper";
        if (!password.Any(char.IsLower)) return "password_needs_lower";
        if (!password.Any(char.IsDigit)) return "password_needs_digit";
        if (password.All(char.IsLetterOrDigit)) return "password_needs_symbol";
        return null;
    }
}
