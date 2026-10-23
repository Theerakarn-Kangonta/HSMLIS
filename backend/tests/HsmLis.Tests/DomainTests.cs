using HsmLis.Domain;
using HsmLis.Domain.Entities;

namespace HsmLis.Tests;

public class ResultRulesTests
{
    private static readonly ReferenceRange Any = new() { Low = 70, High = 100, CriticalLow = 40, CriticalHigh = 450 };

    [Theory]
    [InlineData("85", ResultFlag.None)]
    [InlineData("69.9", ResultFlag.Low)]
    [InlineData("101", ResultFlag.High)]
    [InlineData("40", ResultFlag.CriticalLow)]
    [InlineData("39", ResultFlag.CriticalLow)]
    [InlineData("450", ResultFlag.CriticalHigh)]
    [InlineData(">500", ResultFlag.CriticalHigh)]
    public void Numeric_results_are_flagged_with_critical_limits_first(string value, ResultFlag expected) =>
        Assert.Equal(expected, ResultRules.Evaluate(ResultType.Numeric, value, Any));

    [Fact]
    public void Numeric_result_without_range_has_no_flag() =>
        Assert.Equal(ResultFlag.None, ResultRules.Evaluate(ResultType.Numeric, "5000", null));

    [Theory]
    [InlineData("Positive", ResultFlag.Positive)]
    [InlineData("Reactive", ResultFlag.Positive)]
    [InlineData("2+", ResultFlag.Positive)]
    [InlineData("Non Reactive", ResultFlag.None)]
    [InlineData("Negative", ResultFlag.None)]
    [InlineData("Not detected", ResultFlag.None)]
    [InlineData("Not done", ResultFlag.None)]
    [InlineData("1-9 AFB", ResultFlag.Abnormal)]
    public void Text_results_are_judged_against_the_normal_answer(string value, ResultFlag expected) =>
        Assert.Equal(expected, ResultRules.Evaluate(ResultType.Choice, value, new ReferenceRange { NormalText = "Negative" }));

    [Fact]
    public void The_most_specific_range_wins()
    {
        ReferenceRange both = new() { Low = 1 };
        ReferenceRange male = new() { Sex = Sex.Male, Low = 2 };
        ReferenceRange maleAdult = new() { Sex = Sex.Male, AgeMinYears = 18, Low = 3 };
        ReferenceRange[] ranges = [both, male, maleAdult];

        Assert.Same(maleAdult, ResultRules.PickRange(ranges, Sex.Male, 40));
        Assert.Same(male, ResultRules.PickRange(ranges, Sex.Male, 10));
        Assert.Same(male, ResultRules.PickRange(ranges, Sex.Male, null));
        Assert.Same(both, ResultRules.PickRange(ranges, Sex.Female, 40));
    }

    [Theory]
    [InlineData(ResultType.Numeric, "12.5", null)]
    [InlineData(ResultType.Numeric, "abc", "result_not_number")]
    [InlineData(ResultType.Choice, "Reactive", null)]
    [InlineData(ResultType.Choice, "Maybe", "result_not_an_option")]
    [InlineData(ResultType.MultiChoice, "Reactive, Invalid", null)]
    [InlineData(ResultType.Text, "Anything at all", null)]
    [InlineData(ResultType.Text, "  ", "result_empty")]
    public void Results_are_validated_by_type(ResultType type, string value, string? expected) =>
        Assert.Equal(expected, ResultRules.Validate(type, value, ["Reactive", "Non Reactive", "Invalid"]));

    [Fact]
    public void Age_and_bmi_are_computed()
    {
        Assert.Equal(25, ResultRules.AgeInYears(new DateOnly(2000, 10, 17), new DateOnly(2025, 10, 17)));
        Assert.Equal(24, ResultRules.AgeInYears(new DateOnly(2000, 10, 18), new DateOnly(2025, 10, 17)));
        Assert.Null(ResultRules.AgeInYears(null, new DateOnly(2025, 1, 1)));
        Assert.Equal(22.9m, ResultRules.Bmi(70, 175));
        Assert.Null(ResultRules.Bmi(70, null));
    }

    [Fact]
    public void Ranges_are_described_for_the_report()
    {
        Assert.Equal("70 - 100", ResultRules.Describe(Any));
        Assert.Equal("≤ 200", ResultRules.Describe(new ReferenceRange { High = 200 }));
        Assert.Equal("Negative", ResultRules.Describe(new ReferenceRange { NormalText = "Negative" }));
    }
}

public class WorkflowRulesTests
{
    private static readonly DateTime Now = new(2026, 9, 21, 10, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Order_status_follows_specimens_and_results()
    {
        Assert.Equal(OrderStatus.AwaitingCollection, OrderRules.StatusOf(false, [ContainerStatus.Pending], [ResultStatus.Pending]));
        Assert.Equal(OrderStatus.InProgress, OrderRules.StatusOf(false, [ContainerStatus.Collected], [ResultStatus.Pending]));
        Assert.Equal(OrderStatus.InProgress, OrderRules.StatusOf(false, [ContainerStatus.Received], [ResultStatus.Approved, ResultStatus.Entered]));
        Assert.Equal(OrderStatus.Completed, OrderRules.StatusOf(false, [ContainerStatus.Received], [ResultStatus.Approved, ResultStatus.Cancelled]));
        Assert.Equal(OrderStatus.Cancelled, OrderRules.StatusOf(true, [ContainerStatus.Received], [ResultStatus.Approved]));
    }

    [Theory]
    [InlineData(1000, DiscountType.Percent, 15, 850)]
    [InlineData(1000, DiscountType.Amount, 100, 900)]
    [InlineData(100, DiscountType.Amount, 500, 0)]
    public void Package_price_applies_its_discount(decimal list, DiscountType type, decimal value, decimal expected) =>
        Assert.Equal(expected, OrderRules.PackagePrice(list, type, value));

    [Theory]
    [InlineData(190, 10, 19)]
    [InlineData(333, 12.5, 41.63)]
    [InlineData(500, 100, 500)]
    [InlineData(500, 0, 0)]
    public void Order_discount_is_a_percentage_of_the_subtotal(decimal subtotal, decimal percent, decimal expected) =>
        Assert.Equal(expected, OrderRules.OrderDiscount(subtotal, percent));

    [Fact]
    public void Package_shares_follow_list_prices_and_add_up_to_the_package_price()
    {
        Assert.Equal([60m, 40m, 20m], OrderRules.PackageShares(120, [150, 100, 50]));
        // Rounding goes to the last test, so nothing is lost or invented.
        var shares = OrderRules.PackageShares(100, [1, 1, 1]);
        Assert.Equal([33.33m, 33.33m, 33.34m], shares);
        Assert.Equal(100, shares.Sum());
        Assert.Equal([50m, 50m], OrderRules.PackageShares(100, [0, 0]));
        Assert.Empty(OrderRules.PackageShares(100, []));
    }

    [Fact]
    public void Numbers_have_the_documented_formats()
    {
        var day = new DateOnly(2026, 9, 21);
        Assert.Equal("26090001", Numbering.OrderNo(day, 1));
        Assert.Equal(Numbering.OrderKey(day), Numbering.OrderKey(new DateOnly(2026, 9, 30)));
        Assert.Equal("26090001-02", Numbering.Lsn("26090001", 2));
        Assert.Equal("26090049", Numbering.Hn(day, 49));
        Assert.Equal("INV2609210007", Numbering.InvoiceNo(day, 7));
    }

    [Fact]
    public void Local_day_follows_the_lab_time_zone()
    {
        // 18:30 UTC on the 20th is already the 21st in Bangkok (UTC+7).
        Assert.Equal(new DateOnly(2026, 9, 21), LabClock.Today(new DateTime(2026, 9, 20, 18, 30, 0, DateTimeKind.Utc), "Asia/Bangkok"));
        Assert.Equal(new DateTime(2026, 9, 20, 17, 0, 0), LabClock.StartOfDayUtc(new DateOnly(2026, 9, 21), "Asia/Bangkok"));
    }

    [Theory]
    [InlineData("short1!A", "password_too_short")]
    [InlineData("alllowercase1!", "password_needs_upper")]
    [InlineData("ALLUPPERCASE1!", "password_needs_lower")]
    [InlineData("NoDigitsHere!!", "password_needs_digit")]
    [InlineData("NoSymbols12345", "password_needs_symbol")]
    [InlineData("Demo@1234567", null)]
    public void Passwords_follow_the_policy(string password, string? expected) => Assert.Equal(expected, PasswordPolicy.Check(password));

    [Theory]
    [InlineData("9000000000012", true)]
    [InlineData("9000000000013", false)]
    [InlineData("12345", false)]
    public void Citizen_id_check_digit_is_verified(string id, bool valid) => Assert.Equal(valid, ThaiCitizenId.IsValid(id));

    [Fact]
    public void Permissions_keep_admins_above_staff()
    {
        Assert.True(Permissions.Has(UserRole.LabTechnician, Permissions.ResultsVerify));
        Assert.True(Permissions.Has(UserRole.LabTechnician, Permissions.ResultsApprove));
        Assert.False(Permissions.Has(UserRole.Cashier, Permissions.Orders));
        Assert.False(Permissions.CanManage(UserRole.BranchAdmin, UserRole.SuperAdmin));
        Assert.True(Permissions.CanManage(UserRole.BranchAdmin, UserRole.LabTechnician));
    }
}
