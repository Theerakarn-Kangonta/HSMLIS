using System.Globalization;

namespace HsmLis.Domain;

/// <summary>The formats of the numbers people read off labels and documents. Years are Gregorian (26 = 2026).</summary>
public static class Numbering
{
    private static string Day(DateOnly d) => d.ToString("yyMMdd", CultureInfo.InvariantCulture);
    private static string Month(DateOnly d) => d.ToString("yyMM", CultureInfo.InvariantCulture);

    public static string OrderKey(DateOnly day) => $"order:{Day(day)}";
    public static string OrderNo(string prefix, DateOnly day, int seq) => $"{prefix}{Day(day)}{seq:D4}";

    /// <summary>One container's lab sample number: the order number plus -01, -02…</summary>
    public static string Lsn(string orderNo, int index) => $"{orderNo}-{index:D2}";

    public static string HnKey(DateOnly day) => $"hn:{Month(day)}";
    public static string Hn(DateOnly day, int seq) => $"{Month(day)}{seq:D4}";

    public static string InvoiceKey(DateOnly day) => $"invoice:{Day(day)}";
    public static string InvoiceNo(DateOnly day, int seq) => $"INV{Day(day)}{seq:D4}";
}

/// <summary>Turns UTC instants into the laboratory's local calendar.</summary>
public static class LabClock
{
    public static TimeZoneInfo Zone(string timeZone)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZone);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    public static DateTime ToLocal(DateTime utc, string timeZone) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone(timeZone));

    public static DateOnly Today(DateTime utcNow, string timeZone) => DateOnly.FromDateTime(ToLocal(utcNow, timeZone));

    /// <summary>The UTC instant local midnight of <paramref name="day"/> falls on.</summary>
    public static DateTime StartOfDayUtc(DateOnly day, string timeZone) =>
        TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), Zone(timeZone));
}
