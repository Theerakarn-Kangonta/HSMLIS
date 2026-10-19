using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using HsmLis.Application.Common;
using HsmLis.Application.Dtos;
using HsmLis.Domain.Entities;
using HsmLis.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace HsmLis.Tests;

/// <summary>
/// Boots the real API against a throwaway Postgres database. The server comes from
/// TEST_DATABASE_SERVER (default: the docker-compose database on localhost:5433).
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>
{
    private const string DatabaseName = "hsmlis_test";

    /// <summary>The QZ Tray signing key the test server is given; tests check signatures with it.</summary>
    public static readonly RSA QzKey = RSA.Create(2048);

    public static readonly string QzCertificate = new CertificateRequest("CN=HSMLIS test", QzKey, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1)
        .CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1))
        .ExportCertificatePem();

    private static readonly string DatabaseServer =
        Environment.GetEnvironmentVariable("TEST_DATABASE_SERVER")
        ?? "Host=localhost;Port=5433;Username=hsmlis;Password=hsmlis";

    public ApiFactory()
    {
        using var connection = new NpgsqlConnection($"{DatabaseServer};Database=postgres");
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = $"DROP DATABASE IF EXISTS {DatabaseName} WITH (FORCE)";
        command.ExecuteNonQuery();
        command.CommandText = $"CREATE DATABASE {DatabaseName}";
        command.ExecuteNonQuery();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Database", $"{DatabaseServer};Database={DatabaseName}");
        builder.UseSetting("Database:MigrateOnStartup", "true");
        builder.UseSetting("Jwt:SigningKey", "integration-test-signing-key-0123456789abcdef");
        builder.UseSetting("RateLimit:AuthPerMinute", "100000");
        builder.UseSetting("RateLimit:RequestsPerMinute", "100000");
        builder.UseSetting("Cors:AllowedOrigins:0", "https://app.example.com");
        // Written with \n instead of line breaks, the way it is pasted into one environment variable.
        builder.UseSetting("Qz:Certificate", QzCertificate.Replace("\n", "\\n"));
        builder.UseSetting("Qz:PrivateKey", QzKey.ExportPkcs8PrivateKeyPem().Replace("\n", "\\n"));
    }

    /// <summary>A browser-like client: keeps the session cookie (HTTPS, as the cookie is Secure) and sends the app's header.</summary>
    public HttpClient NewClient(bool withAppHeader = true)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
        if (withAppHeader) client.DefaultRequestHeaders.Add("X-Requested-With", "HSMLIS");
        return client;
    }
}

public class ApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "Test@Password1";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static int _counter;

    private record Lab(Guid OrgId, string Code, Dictionary<UserRole, string> Usernames);

    /// <summary>A new organization with one user per role, written straight to the database.</summary>
    private async Task<Lab> NewLabAsync()
    {
        var n = Interlocked.Increment(ref _counter);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var org = new Organization { Id = Guid.NewGuid(), Code = $"T{n}", NameTh = $"Lab {n}", CreatedAt = DateTime.UtcNow };
        db.Organizations.Add(org);
        var names = new Dictionary<UserRole, string>();
        foreach (var role in Enum.GetValues<UserRole>())
        {
            var username = $"{role.ToString().ToLowerInvariant()}{n}";
            names[role] = username;
            db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                OrganizationId = org.Id,
                Username = username,
                PasswordHash = hasher.Hash(Password),
                FirstNameTh = role.ToString(),
                LastNameTh = $"{n}",
                Role = role,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync();
        return new Lab(org.Id, org.Code, names);
    }

    private async Task<HttpClient> SignInAsync(Lab lab, UserRole role)
    {
        var client = factory.NewClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(lab.Usernames[role], Password));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return client;
    }

    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        if (!response.IsSuccessStatusCode)
            Assert.Fail($"{(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }

    private static async Task<string?> ErrorCode(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<T> Post<T>(HttpClient client, string url, object body) =>
        await Read<T>(await client.PostAsJsonAsync(url, body, Json));

    /// <summary>A department, a specimen type and a glucose test with limits 70–100 (critical 40 / 450).</summary>
    private static async Task<(LabTestDto Glucose, LabTestDto Hiv)> CatalogAsync(HttpClient admin)
    {
        var dep = await Post<DepartmentDto>(admin, "/api/departments", new DepartmentRequest("006", "Chemistry", "เคมีคลินิก", "#3b82f6", null, true));
        var spec = await Post<SpecimenTypeDto>(admin, "/api/specimen-types", new SpecimenTypeRequest("02", "Serum", "ซีรัม", "Red top", null, null, true));
        var glucose = await Post<LabTestDto>(admin, "/api/lab-tests", new LabTestRequest(
            "GLU", dep.Id, "Glucose", null, spec.Id, "mg/dL", 40, ResultType.Numeric, null, 0, 4, 0, false,
            [new ReferenceRangeDto(null, null, null, 70, 100, 40, 450, null)], true, 0));
        var hiv = await Post<LabTestDto>(admin, "/api/lab-tests", new LabTestRequest(
            "AHIV", dep.Id, "Anti-HIV", null, spec.Id, null, 150, ResultType.Choice, ["Non Reactive", "Reactive"], 0, 24, 0, true,
            [new ReferenceRangeDto(null, null, null, null, null, null, null, "Non Reactive")], true, 1));
        return (glucose, hiv);
    }

    private static PatientRequest NewPatient(string first) => new(
        "นาย", first, "ทดสอบ", null, null, null, Sex.Male, new DateOnly(1980, 1, 1), null, "ไทย", null, null, null, null, null, null,
        null, null, null, null, null, null);

    // ---------- sign-in and request protection ----------

    [Fact]
    public async Task Sign_in_sets_a_cookie_and_reports_permissions()
    {
        var lab = await NewLabAsync();
        var wrong = await factory.NewClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(lab.Usernames[UserRole.LabTechnician], "wrong"));
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal("invalid_credentials", await ErrorCode(wrong));

        var client = await SignInAsync(lab, UserRole.LabTechnician);
        var me = await Read<MeResponse>(await client.GetAsync("/api/auth/me"));
        Assert.Contains("results.verify", me.Permissions);
        Assert.DoesNotContain("results.approve", me.Permissions);
    }

    [Fact]
    public async Task Requests_without_a_session_or_the_app_header_are_refused()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.NewClient().GetAsync("/api/patients")).StatusCode);

        var lab = await NewLabAsync();
        var bare = factory.NewClient(withAppHeader: false);
        var login = await bare.PostAsJsonAsync("/api/auth/login", new LoginRequest(lab.Usernames[UserRole.SuperAdmin], Password));
        Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
        Assert.Equal("cross_site_request", await ErrorCode(login));
    }

    [Fact]
    public async Task Qz_signing_is_for_staff_who_print_labels()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.NewClient().GetAsync("/api/qz/certificate")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.NewClient().PostAsJsonAsync("/api/qz/sign", new QzSignRequest("abc"))).StatusCode);

        var lab = await NewLabAsync();
        var cashier = await SignInAsync(lab, UserRole.Cashier);
        Assert.Equal(HttpStatusCode.Forbidden, (await cashier.GetAsync("/api/qz/certificate")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await cashier.PostAsJsonAsync("/api/qz/sign", new QzSignRequest("abc"))).StatusCode);

        var receptionist = await SignInAsync(lab, UserRole.Receptionist);
        var certificate = await Read<QzCertificateDto>(await receptionist.GetAsync("/api/qz/certificate"));
        Assert.Equal(ApiFactory.QzCertificate.Trim(), certificate.Certificate);

        const string hash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
        var signed = await Post<QzSignatureDto>(receptionist, "/api/qz/sign", new QzSignRequest(hash));
        Assert.True(ApiFactory.QzKey.VerifyData(
            Encoding.UTF8.GetBytes(hash), Convert.FromBase64String(signed.Signature), HashAlgorithmName.SHA512, RSASignaturePadding.Pkcs1));

        var tooLong = await receptionist.PostAsJsonAsync("/api/qz/sign", new QzSignRequest(new string('a', 257)));
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
    }

    [Fact]
    public async Task Roles_limit_what_can_be_done()
    {
        var lab = await NewLabAsync();
        var cashier = await SignInAsync(lab, UserRole.Cashier);
        Assert.Equal(HttpStatusCode.Forbidden, (await cashier.GetAsync("/api/orders")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await cashier.PostAsJsonAsync("/api/departments", new DepartmentRequest("X", "X", null, "#000000", null, true))).StatusCode);

        var branchAdmin = await SignInAsync(lab, UserRole.BranchAdmin);
        var escalate = await branchAdmin.PostAsJsonAsync("/api/users", new CreateUserRequest(
            $"boss{lab.Code}", Password, "ใหญ่", "สุด", null, null, null, null, null, null, null, UserRole.SuperAdmin, null), Json);
        Assert.Equal(HttpStatusCode.Forbidden, escalate.StatusCode);
        Assert.Equal("role_not_allowed", await ErrorCode(escalate));

        var weak = await branchAdmin.PostAsJsonAsync("/api/users", new CreateUserRequest(
            $"weak{lab.Code}", "short", "อ่อน", "แอ", null, null, null, null, null, null, null, UserRole.Receptionist, null), Json);
        Assert.Equal("password_too_short", await ErrorCode(weak));
    }

    [Fact]
    public async Task One_laboratory_never_sees_another_laboratorys_patients()
    {
        var labA = await NewLabAsync();
        var labB = await NewLabAsync();
        var a = await SignInAsync(labA, UserRole.Receptionist);
        var b = await SignInAsync(labB, UserRole.Receptionist);

        var patient = await Post<PatientDto>(a, "/api/patients", NewPatient("แยก"));
        Assert.Equal(HttpStatusCode.NotFound, (await b.GetAsync($"/api/patients/{patient.Id}")).StatusCode);
        var list = await Read<PagedResult<PatientDto>>(await b.GetAsync("/api/patients?search=แยก"));
        Assert.Empty(list.Items);
        var update = await b.PutAsJsonAsync($"/api/patients/{patient.Id}", NewPatient("ขโมย"), Json);
        Assert.Equal(HttpStatusCode.NotFound, update.StatusCode);
    }

    // ---------- the whole lab workflow ----------

    [Fact]
    public async Task An_order_goes_from_ordering_to_an_approved_report_and_payment()
    {
        var lab = await NewLabAsync();
        var admin = await SignInAsync(lab, UserRole.SuperAdmin);
        var (glucose, hiv) = await CatalogAsync(admin);

        var reception = await SignInAsync(lab, UserRole.Receptionist);
        var patient = await Post<PatientDto>(reception, "/api/patients", NewPatient("ครบวงจร"));
        Assert.Matches(@"^\d{8}$", patient.Hn);

        var order = await Post<OrderDetailDto>(reception, "/api/orders", new CreateOrderRequest(
            patient.Id, null, null, null, false, null, null, null, null, null, null, 70, 175, null, [glucose.Id, hiv.Id], 10));
        Assert.Equal(19, order.Discount);
        Assert.Matches("^\\d{8}$", order.OrderNo);
        var container = Assert.Single(order.Containers);
        Assert.Equal($"{order.OrderNo}-01", container.Lsn);
        Assert.Equal(171, order.Total);
        Assert.Equal(22.9m, order.Bmi);
        Assert.Equal(InvoiceStatus.Unpaid, order.Invoice!.Status);

        // A scanned label finds its order.
        var found = await Read<SearchResultDto>(await reception.GetAsync($"/api/orders/search?q={container.Lsn}"));
        Assert.Equal(container.Lsn, found.MatchedLsn);
        Assert.Equal(order.Id, Assert.Single(found.Orders).Id);

        // Results cannot be entered before the specimen is in the lab.
        var manager = await SignInAsync(lab, UserRole.LabManager);
        var early = await manager.PostAsJsonAsync($"/api/results/{order.Id}",
            new SaveResultsRequest(order.Version, [new ResultInput(order.Items[0].Id, "90", null)]), Json);
        Assert.Equal("specimen_not_received", await ErrorCode(early));

        order = await Post<OrderDetailDto>(reception, $"/api/checkin/{order.Id}/collect", new ContainerIdsRequest(null));
        Assert.Equal(OrderStatus.InProgress, order.Status);
        order = await Post<OrderDetailDto>(manager, $"/api/checkin/{order.Id}/receive", new ReceiveRequest(null, "5 mL", "ปกติ", null));
        Assert.Equal(ContainerStatus.Received, order.Containers[0].Status);

        var glu = order.Items.Single(i => i.TestCode == "GLU");
        var hivItem = order.Items.Single(i => i.TestCode == "AHIV");
        var saved = await Post<ResultActionResponse>(manager, $"/api/results/{order.Id}", new SaveResultsRequest(order.Version,
            [new ResultInput(glu.Id, "500", null), new ResultInput(hivItem.Id, "Non Reactive", null)]));
        Assert.Equal(2, saved.Done);
        Assert.Equal(ResultFlag.CriticalHigh, saved.Order.Items.Single(i => i.Id == glu.Id).Flag);
        Assert.Equal("70 - 100", saved.Order.Items.Single(i => i.Id == glu.Id).RefText);

        // A stale screen cannot save over newer work.
        var stale = await manager.PostAsJsonAsync($"/api/results/{order.Id}",
            new SaveResultsRequest(order.Version, [new ResultInput(glu.Id, "95", null)]), Json);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal("order_changed", await ErrorCode(stale));

        var verified = await Post<ResultActionResponse>(manager, $"/api/results/{order.Id}/verify", new ResultActionRequest(saved.Order.Version, null));
        Assert.Equal(2, verified.Done);

        // The person who entered and verified must wait before approving their own work...
        var own = await manager.PostAsJsonAsync($"/api/results/{order.Id}/approve", new ResultActionRequest(verified.Order.Version, null), Json);
        Assert.Equal("self_approval_wait", await ErrorCode(own));

        // ...a colleague need not.
        var doctor = await SignInAsync(lab, UserRole.Doctor);
        var approved = await Post<ResultActionResponse>(doctor, $"/api/results/{order.Id}/approve", new ResultActionRequest(verified.Order.Version, null));
        Assert.Equal(2, approved.Done);
        Assert.Equal(OrderStatus.Completed, approved.Order.Status);
        Assert.NotNull(approved.Order.CompletedAt);

        var history = await Read<List<ResultEventDto>>(await doctor.GetAsync($"/api/results/{order.Id}/items/{glu.Id}/history"));
        Assert.Equal(["approve", "verify", "enter"], history.Select(h => h.Action));

        // A technician may not approve at all.
        var tech = await SignInAsync(lab, UserRole.LabTechnician);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await tech.PostAsJsonAsync($"/api/results/{order.Id}/approve", new ResultActionRequest(approved.Order.Version, null), Json)).StatusCode);

        // Payment, in two parts.
        var cashier = await SignInAsync(lab, UserRole.Cashier);
        var invoices = await Read<PagedResult<InvoiceDto>>(await cashier.GetAsync($"/api/billing/invoices?search={order.OrderNo}"));
        var invoice = Assert.Single(invoices.Items);
        var tooMuch = await cashier.PostAsJsonAsync($"/api/billing/invoices/{invoice.Id}/pay", new PayRequest(invoice.Version, 999, PaymentMethod.Cash, null), Json);
        Assert.Equal("payment_too_large", await ErrorCode(tooMuch));
        var part = await Post<InvoiceDto>(cashier, $"/api/billing/invoices/{invoice.Id}/pay", new PayRequest(invoice.Version, 100, PaymentMethod.Cash, null));
        Assert.Equal(InvoiceStatus.Partial, part.Status);
        var full = await Post<InvoiceDto>(cashier, $"/api/billing/invoices/{invoice.Id}/pay", new PayRequest(part.Version, 71, PaymentMethod.PromptPay, null));
        Assert.Equal(InvoiceStatus.Paid, full.Status);
        Assert.Equal(0, full.Balance);

        // Everything above is in the audit log.
        var log = await Read<PagedResult<AuditLogDto>>(await admin.GetAsync("/api/audit?pageSize=100"));
        Assert.Contains(log.Items, a => a.Action == "result.approve");
        Assert.Contains(log.Items, a => a.Action == "invoice.pay");
    }

    [Fact]
    public async Task A_rejected_specimen_can_be_collected_again()
    {
        var lab = await NewLabAsync();
        var admin = await SignInAsync(lab, UserRole.SuperAdmin);
        var (glucose, _) = await CatalogAsync(admin);
        var patient = await Post<PatientDto>(admin, "/api/patients", NewPatient("ซ้ำ"));
        var order = await Post<OrderDetailDto>(admin, "/api/orders", new CreateOrderRequest(
            patient.Id, null, null, null, true, null, null, null, null, null, null, null, null, null, [glucose.Id], 0));

        order = await Post<OrderDetailDto>(admin, $"/api/checkin/{order.Id}/collect", new ContainerIdsRequest(null));
        order = await Post<OrderDetailDto>(admin, $"/api/checkin/{order.Id}/reject", new RejectRequest(order.Containers[0].Id, "Hemolysis"));
        Assert.Equal(ContainerStatus.Rejected, order.Containers[0].Status);

        order = await Post<OrderDetailDto>(admin, $"/api/checkin/{order.Id}/containers/{order.Containers[0].Id}/recollect", new { });
        Assert.Equal(2, order.Containers.Count);
        var fresh = order.Containers.Single(c => c.Status == ContainerStatus.Pending);
        Assert.Equal($"{order.OrderNo}-02", fresh.Lsn);
        Assert.Equal(fresh.Id, order.Items[0].ContainerId);

        // Cancelling also cancels the invoice.
        order = await Post<OrderDetailDto>(admin, $"/api/orders/{order.Id}/cancel", new CancelOrderRequest("ผู้ป่วยไม่มาเก็บตัวอย่าง"));
        Assert.Equal(OrderStatus.Cancelled, order.Status);
        Assert.Equal(InvoiceStatus.Cancelled, order.Invoice!.Status);
    }

    [Fact]
    public async Task One_test_can_be_cancelled_and_each_department_is_worked_on_its_own()
    {
        var lab = await NewLabAsync();
        var admin = await SignInAsync(lab, UserRole.SuperAdmin);
        var (glucose, hiv) = await CatalogAsync(admin);
        var hemato = await Post<DepartmentDto>(admin, "/api/departments", new DepartmentRequest("007", "Hematology", "โลหิตวิทยา", "#ef4444", null, true));
        var wbc = await Post<LabTestDto>(admin, "/api/lab-tests", new LabTestRequest(
            "WBC", hemato.Id, "White blood cell count", null, glucose.SpecimenTypeId, "x10^3/uL", 60, ResultType.Numeric, null, 1, 4, 0, false, [], true, 0));
        var patient = await Post<PatientDto>(admin, "/api/patients", NewPatient("แยกแผนก"));
        var order = await Post<OrderDetailDto>(admin, "/api/orders", new CreateOrderRequest(
            patient.Id, null, null, null, false, null, null, null, null, null, null, null, null, null, [glucose.Id, hiv.Id, wbc.Id], 10));
        Assert.Equal((250m, 25m, 225m), (order.Subtotal, order.Discount, order.Total));
        var glu = order.Items.Single(i => i.TestCode == "GLU");
        var cancelUrl = $"/api/orders/{order.Id}/items/{glu.Id}/cancel";

        // A cashier may not, and another laboratory cannot even find the order.
        var cashier = await SignInAsync(lab, UserRole.Cashier);
        Assert.Equal(HttpStatusCode.Forbidden, (await cashier.PostAsJsonAsync(cancelUrl, new CancelItemRequest("x"), Json)).StatusCode);
        var otherAdmin = await SignInAsync(await NewLabAsync(), UserRole.SuperAdmin);
        var foreign = await otherAdmin.PostAsJsonAsync(cancelUrl, new CancelItemRequest("x"), Json);
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        Assert.Equal("order_not_found", await ErrorCode(foreign));

        // The cancelled test comes off the bill, and the order's discount shrinks with it.
        order = await Post<OrderDetailDto>(admin, cancelUrl, new CancelItemRequest("แพทย์ยกเลิก"));
        glu = order.Items.Single(i => i.Id == glu.Id);
        Assert.Equal(ResultStatus.Cancelled, glu.ResultStatus);
        Assert.Equal("แพทย์ยกเลิก", glu.CancelReason);
        Assert.NotNull(glu.CancelledAt);
        Assert.Equal((210m, 21m, 189m), (order.Subtotal, order.Discount, order.Total));
        Assert.Equal(189, order.Invoice!.Amount);
        Assert.Equal(OrderStatus.AwaitingCollection, order.Status);
        var bill = await Read<InvoiceDetailDto>(await admin.GetAsync($"/api/billing/invoices/{order.Invoice.Id}"));
        Assert.DoesNotContain(bill.Lines, l => l.Code == "GLU");
        Assert.Equal(order.Subtotal, bill.Lines.Sum(l => l.Price));
        Assert.Equal("result_cancelled", await ErrorCode(await admin.PostAsJsonAsync(cancelUrl, new CancelItemRequest("again"), Json)));

        // Received: the worklist has one row per department, and only the cancelled test is gone.
        order = await Post<OrderDetailDto>(admin, $"/api/checkin/{order.Id}/receive", new ReceiveRequest(null, null, null, null));
        var all = await Read<PagedResult<WorklistRowDto>>(await admin.GetAsync($"/api/results?stage=All&search={order.OrderNo}"));
        Assert.Equal(2, all.Total);
        var chem = all.Items.Single(r => r.DepartmentName == "Chemistry");
        Assert.Equal(1, chem.ItemCount);
        Assert.Equal(1, all.Items.Single(r => r.DepartmentId == hemato.Id).ItemCount);
        var hivItem = order.Items.Single(i => i.TestCode == "AHIV");
        var wbcItem = order.Items.Single(i => i.TestCode == "WBC");

        // Verifying one department leaves the other department's results alone.
        var saved = await Post<ResultActionResponse>(admin, $"/api/results/{order.Id}", new SaveResultsRequest(order.Version,
            [new ResultInput(hivItem.Id, "Non Reactive", null), new ResultInput(wbcItem.Id, "7.5", null)]));
        var verified = await Post<ResultActionResponse>(admin, $"/api/results/{order.Id}/verify", new ResultActionRequest(saved.Order.Version, [wbcItem.Id]));
        Assert.Equal(1, verified.Done);
        Assert.Equal(ResultStatus.Entered, verified.Order.Items.Single(i => i.Id == hivItem.Id).ResultStatus);
        var toVerify = await Read<PagedResult<WorklistRowDto>>(await admin.GetAsync($"/api/results?stage=Verify&search={order.OrderNo}"));
        Assert.Equal(chem.DepartmentId, Assert.Single(toVerify.Items).DepartmentId);
        var byDepartment = await Read<PagedResult<WorklistRowDto>>(await admin.GetAsync($"/api/results?stage=All&search={order.OrderNo}&departmentId={hemato.Id}"));
        Assert.Equal(hemato.Id, Assert.Single(byDepartment.Items).DepartmentId);

        // The last test left cannot be cancelled on its own.
        order = await Post<OrderDetailDto>(admin, $"/api/orders/{order.Id}/items/{hivItem.Id}/cancel", new CancelItemRequest("ตัวอย่างไม่พอ"));
        var last = await admin.PostAsJsonAsync($"/api/orders/{order.Id}/items/{wbcItem.Id}/cancel", new CancelItemRequest("x"), Json);
        Assert.Equal("last_test", await ErrorCode(last));

        var history = await Read<List<ResultEventDto>>(await admin.GetAsync($"/api/results/{order.Id}/items/{hivItem.Id}/history"));
        Assert.Equal("cancel", history[0].Action);
    }

    [Fact]
    public async Task The_result_screen_shows_the_patients_earlier_results()
    {
        var lab = await NewLabAsync();
        var admin = await SignInAsync(lab, UserRole.SuperAdmin);
        var (glucose, hiv) = await CatalogAsync(admin);
        var patient = await Post<PatientDto>(admin, "/api/patients", NewPatient("ผลเก่า"));
        var manager = await SignInAsync(lab, UserRole.LabManager);
        var doctor = await SignInAsync(lab, UserRole.Doctor);

        async Task<OrderDetailDto> ApprovedGlucose(string value)
        {
            var o = await Post<OrderDetailDto>(admin, "/api/orders", new CreateOrderRequest(
                patient.Id, null, null, null, false, null, null, null, null, null, null, null, null, null, [glucose.Id], 0));
            o = await Post<OrderDetailDto>(admin, $"/api/checkin/{o.Id}/receive", new ReceiveRequest(null, null, null, null));
            var saved = await Post<ResultActionResponse>(manager, $"/api/results/{o.Id}", new SaveResultsRequest(o.Version, [new ResultInput(o.Items[0].Id, value, null)]));
            var verified = await Post<ResultActionResponse>(manager, $"/api/results/{o.Id}/verify", new ResultActionRequest(saved.Order.Version, null));
            return (await Post<ResultActionResponse>(doctor, $"/api/results/{o.Id}/approve", new ResultActionRequest(verified.Order.Version, null))).Order;
        }

        var first = await ApprovedGlucose("90");
        await ApprovedGlucose("120");
        var current = await Post<OrderDetailDto>(admin, "/api/orders", new CreateOrderRequest(
            patient.Id, null, null, null, false, null, null, null, null, null, null, null, null, null, [glucose.Id, hiv.Id], 0));

        // Newest first, only approved results of earlier orders, nothing for a test never done before.
        var previous = await Read<List<PreviousResultDto>>(await manager.GetAsync($"/api/results/{current.Id}/previous"));
        Assert.Equal(["120", "90"], previous.Select(p => p.Value));
        Assert.All(previous, p => Assert.Equal(glucose.Id, p.LabTestId));
        Assert.Equal(ResultFlag.High, previous[0].Flag);
        // An older order does not see results that came after it.
        Assert.Empty(await Read<List<PreviousResultDto>>(await manager.GetAsync($"/api/results/{first.Id}/previous")));

        var cashier = await SignInAsync(lab, UserRole.Cashier);
        Assert.Equal(HttpStatusCode.Forbidden, (await cashier.GetAsync($"/api/results/{current.Id}/previous")).StatusCode);
        var otherLab = await SignInAsync(await NewLabAsync(), UserRole.SuperAdmin);
        Assert.Equal(HttpStatusCode.NotFound, (await otherLab.GetAsync($"/api/results/{current.Id}/previous")).StatusCode);
    }

    [Fact]
    public async Task Patients_are_checked_for_duplicates_and_soft_deleted()
    {
        var lab = await NewLabAsync();
        var reception = await SignInAsync(lab, UserRole.Receptionist);
        var request = NewPatient("ซ้ำซ้อน") with { CitizenId = "9000000000012" };
        var first = await Post<PatientDto>(reception, "/api/patients", request);

        var again = await reception.PostAsJsonAsync("/api/patients", request, Json);
        Assert.Equal("citizen_id_taken", await ErrorCode(again));
        var badId = await reception.PostAsJsonAsync("/api/patients", request with { CitizenId = "9000000000013" }, Json);
        Assert.Equal("citizen_id_invalid", await ErrorCode(badId));

        var similar = await Read<List<PatientDto>>(await reception.GetAsync($"/api/patients/similar?firstName=ซ้ำซ้อน&lastName=ทดสอบ"));
        Assert.Equal(first.Id, Assert.Single(similar).Id);

        Assert.Equal(HttpStatusCode.NoContent, (await reception.DeleteAsync($"/api/patients/{first.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await reception.GetAsync($"/api/patients/{first.Id}")).StatusCode);
    }

    [Fact]
    public async Task The_audit_log_cannot_be_changed_or_deleted()
    {
        var lab = await NewLabAsync();
        await SignInAsync(lab, UserRole.SuperAdmin);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var update = await Assert.ThrowsAnyAsync<Exception>(() => db.Database.ExecuteSqlRawAsync("UPDATE hsmlis.audit_logs SET detail = 'changed'"));
        Assert.Contains("append-only", update.Message);
        var delete = await Assert.ThrowsAnyAsync<Exception>(() => db.Database.ExecuteSqlRawAsync("DELETE FROM hsmlis.audit_logs"));
        Assert.Contains("append-only", delete.Message);
    }

    [Fact]
    public async Task Dashboard_counts_the_days_orders()
    {
        var lab = await NewLabAsync();
        var admin = await SignInAsync(lab, UserRole.SuperAdmin);
        var (glucose, hiv) = await CatalogAsync(admin);
        var patient = await Post<PatientDto>(admin, "/api/patients", NewPatient("สถิติ"));
        var order = await Post<OrderDetailDto>(admin, "/api/orders", new CreateOrderRequest(
            patient.Id, null, null, null, false, null, null, null, null, null, null, null, null, null, [glucose.Id, hiv.Id], 0));

        // Revenue is money received; nothing is paid yet, though 190 is billed.
        var dashboard = await Read<DashboardDto>(await admin.GetAsync("/api/dashboard"));
        Assert.Equal(1, dashboard.Status.Total);
        Assert.Equal(0, dashboard.Kpis.Revenue);
        Assert.Equal(190, dashboard.Kpis.Billed);

        var invoice = Assert.Single((await Read<PagedResult<InvoiceDto>>(await admin.GetAsync($"/api/billing/invoices?search={order.OrderNo}"))).Items);
        await Post<InvoiceDto>(admin, $"/api/billing/invoices/{invoice.Id}/pay", new PayRequest(invoice.Version, 100, PaymentMethod.Cash, null));
        dashboard = await Read<DashboardDto>(await admin.GetAsync("/api/dashboard"));
        Assert.Equal(100, dashboard.Kpis.Revenue);
        // The chart's last day is today: one patient, the 100 paid, nothing rejected.
        var today = dashboard.Daily[^1];
        Assert.Equal((1, 100m, 0), (today.Patients, today.Revenue, today.Rejected));
        Assert.Equal(7, dashboard.Daily.Count);
        Assert.Equal(5, dashboard.Steps.Count);
        Assert.Contains(dashboard.TopTests, x => x.Id == glucose.Id);
        Assert.All(dashboard.RevenueByDepartment, x => Assert.NotNull(x.Id));

        // The dashboard's "pending" figure links to the open orders.
        var open = await Read<PagedResult<OrderSummaryDto>>(await admin.GetAsync("/api/orders?open=true"));
        Assert.Equal(dashboard.Kpis.Pending, open.Total);
    }
}
