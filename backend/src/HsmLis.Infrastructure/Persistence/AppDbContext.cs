using HsmLis.Application.Common;
using HsmLis.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HsmLis.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser) : DbContext(options)
{
    /// <summary>
    /// Kept out of Supabase's "public" schema on purpose: Supabase exposes "public" through its
    /// auto-generated REST API, and patient data must only be reachable through our API.
    /// </summary>
    public const string Schema = "hsmlis";

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<SpecimenType> SpecimenTypes => Set<SpecimenType>();
    public DbSet<LabTest> LabTests => Set<LabTest>();
    public DbSet<TestPackage> TestPackages => Set<TestPackage>();
    public DbSet<ReferringOrganization> Referrers => Set<ReferringOrganization>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<LabOrder> LabOrders => Set<LabOrder>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<SpecimenContainer> Containers => Set<SpecimenContainer>();
    public DbSet<ResultEvent> ResultEvents => Set<ResultEvent>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<NumberSequence> Sequences => Set<NumberSequence>();

    // Read by the query filters below on every query, so each request sees only its own organization.
    private Guid CurrentOrgId => currentUser.OrganizationId;

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        EnsureOwnOrganizationOnly();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken ct = default)
    {
        EnsureOwnOrganizationOnly();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, ct);
    }

    /// <summary>
    /// Second line of defence behind the query filters: a signed-in request can never insert,
    /// change or delete a row of another organization, even if a future bug loads or builds one.
    /// </summary>
    private void EnsureOwnOrganizationOnly()
    {
        var orgId = CurrentOrgId;
        // Anonymous requests (sign-in, start-up seeding) write rows for the organization they name.
        if (orgId == Guid.Empty) return;

        foreach (var entry in ChangeTracker.Entries<IOrgOwned>())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted)) continue;
            var original = entry.State == EntityState.Added
                ? entry.Entity.OrganizationId
                : entry.Property(x => x.OrganizationId).OriginalValue;
            if (entry.Entity.OrganizationId != orgId || original != orgId)
                throw new InvalidOperationException(
                    $"Blocked a write to {entry.Metadata.ClrType.Name} that belongs to another organization.");
        }
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder c)
    {
        // Money and measurements: two decimals. Enums are stored by name, so the data reads on its own.
        c.Properties<decimal>().HavePrecision(18, 2);
        c.Properties<UserRole>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<Sex>().HaveConversion<string>().HaveMaxLength(10);
        c.Properties<ResultType>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<OrderStatus>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<ContainerStatus>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<ResultStatus>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<ResultFlag>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<InvoiceStatus>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<PaymentMethod>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<DiscountType>().HaveConversion<string>().HaveMaxLength(20);
        c.Properties<ReferrerType>().HaveConversion<string>().HaveMaxLength(20);
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema(Schema);

        b.Entity<Organization>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(20);
            e.Property(x => x.NameTh).HasMaxLength(200);
            e.Property(x => x.NameEn).HasMaxLength(200);
            e.Property(x => x.Email).HasMaxLength(254);
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.TaxId).HasMaxLength(20);
            e.Property(x => x.Address).HasMaxLength(400);
            e.Property(x => x.TimeZone).HasMaxLength(64);
        });

        b.Entity<Branch>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(20);
            e.Property(x => x.NameTh).HasMaxLength(200);
            e.Property(x => x.NameEn).HasMaxLength(200);
            e.Property(x => x.Address).HasMaxLength(400);
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.Email).HasMaxLength(254);
            e.Property(x => x.TaxId).HasMaxLength(20);
            e.HasIndex(x => new { x.OrganizationId, x.Code }).IsUnique();
            OwnedByOrganization(e);
        });

        b.Entity<User>(e =>
        {
            e.Property(x => x.Username).HasMaxLength(60);
            e.Property(x => x.FirstNameTh).HasMaxLength(80);
            e.Property(x => x.LastNameTh).HasMaxLength(80);
            e.Property(x => x.FirstNameEn).HasMaxLength(80);
            e.Property(x => x.LastNameEn).HasMaxLength(80);
            e.Property(x => x.Position).HasMaxLength(120);
            e.Property(x => x.Email).HasMaxLength(254);
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.EmployeeCode).HasMaxLength(40);
            e.HasIndex(x => x.Username).IsUnique();
            e.HasOne<Branch>().WithMany().HasForeignKey(x => x.BranchId).OnDelete(DeleteBehavior.Restrict);
            e.Ignore(x => x.FullName);
            OwnedByOrganization(e);
        });

        b.Entity<Department>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(20);
            e.Property(x => x.NameEn).HasMaxLength(120);
            e.Property(x => x.NameTh).HasMaxLength(120);
            e.Property(x => x.Color).HasMaxLength(7);
            e.Property(x => x.Description).HasMaxLength(500);
            e.HasIndex(x => new { x.OrganizationId, x.Code }).IsUnique();
            OwnedByOrganization(e);
        });

        b.Entity<SpecimenType>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(20);
            e.Property(x => x.NameEn).HasMaxLength(120);
            e.Property(x => x.NameTh).HasMaxLength(120);
            e.Property(x => x.ContainerType).HasMaxLength(80);
            e.Property(x => x.CollectionRequirements).HasMaxLength(500);
            e.Property(x => x.Preservation).HasMaxLength(500);
            e.HasIndex(x => new { x.OrganizationId, x.Code }).IsUnique();
            OwnedByOrganization(e);
        });

        b.Entity<LabTest>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(30);
            e.Property(x => x.NameEn).HasMaxLength(200);
            e.Property(x => x.NameTh).HasMaxLength(200);
            e.Property(x => x.Unit).HasMaxLength(30);
            e.HasIndex(x => new { x.OrganizationId, x.Code }).IsUnique();
            e.HasOne(x => x.Department).WithMany().HasForeignKey(x => x.DepartmentId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.SpecimenType).WithMany().HasForeignKey(x => x.SpecimenTypeId).OnDelete(DeleteBehavior.Restrict);
            e.OwnsMany(x => x.ReferenceRanges, r => r.ToJson());
            OwnedByOrganization(e);
        });

        b.Entity<TestPackage>(e =>
        {
            e.ToTable("test_packages");
            e.Property(x => x.Code).HasMaxLength(30);
            e.Property(x => x.NameTh).HasMaxLength(200);
            e.Property(x => x.NameEn).HasMaxLength(200);
            e.Property(x => x.Description).HasMaxLength(500);
            e.HasIndex(x => new { x.OrganizationId, x.Code }).IsUnique();
            OwnedByOrganization(e);
        });

        b.Entity<ReferringOrganization>(e =>
        {
            e.ToTable("referring_organizations");
            e.Property(x => x.Code).HasMaxLength(20);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Address).HasMaxLength(400);
            e.Property(x => x.Contact).HasMaxLength(120);
            e.Property(x => x.Phone).HasMaxLength(40);
            e.HasIndex(x => new { x.OrganizationId, x.Code }).IsUnique();
            OwnedByOrganization(e);
        });

        b.Entity<Patient>(e =>
        {
            e.Property(x => x.Hn).HasMaxLength(20);
            e.Property(x => x.Prefix).HasMaxLength(30);
            e.Property(x => x.FirstNameTh).HasMaxLength(80);
            e.Property(x => x.LastNameTh).HasMaxLength(80);
            e.Property(x => x.FirstNameEn).HasMaxLength(80);
            e.Property(x => x.LastNameEn).HasMaxLength(80);
            e.Property(x => x.CitizenId).HasMaxLength(13);
            e.Property(x => x.BloodGroup).HasMaxLength(5);
            e.Property(x => x.Nationality).HasMaxLength(60);
            e.Property(x => x.Phone).HasMaxLength(40);
            e.Property(x => x.Email).HasMaxLength(254);
            e.Property(x => x.LineId).HasMaxLength(60);
            e.Property(x => x.Address).HasMaxLength(400);
            e.Property(x => x.Province).HasMaxLength(80);
            e.Property(x => x.PostCode).HasMaxLength(10);
            e.Property(x => x.EmergencyName).HasMaxLength(120);
            e.Property(x => x.EmergencyPhone).HasMaxLength(40);
            e.Property(x => x.EmergencyRelation).HasMaxLength(60);
            e.Property(x => x.Allergies).HasMaxLength(500);
            e.Property(x => x.Conditions).HasMaxLength(500);
            e.Property(x => x.Medications).HasMaxLength(500);
            e.Ignore(x => x.FullNameTh);
            e.HasIndex(x => new { x.OrganizationId, x.Hn }).IsUnique();
            e.HasIndex(x => new { x.OrganizationId, x.CitizenId });
            e.HasIndex(x => new { x.OrganizationId, x.CreatedAt });
            // Soft-deleted patients stay visible to the records that point at them; the
            // repository hides them from searches and lists.
            OwnedByOrganization(e);
        });

        b.Entity<LabOrder>(e =>
        {
            e.Property(x => x.OrderNo).HasMaxLength(30);
            e.Property(x => x.ReferrerRef).HasMaxLength(60);
            e.Property(x => x.Entitlement).HasMaxLength(80);
            e.Property(x => x.Diagnosis).HasMaxLength(500);
            e.Property(x => x.Note).HasMaxLength(500);
            e.Property(x => x.OrderedByName).HasMaxLength(170);
            e.Property(x => x.CancelReason).HasMaxLength(300);
            e.Property(x => x.TemperatureC).HasPrecision(4, 1);
            e.Property(x => x.WeightKg).HasPrecision(6, 2);
            e.Property(x => x.HeightCm).HasPrecision(6, 2);
            e.Property(x => x.Version).IsConcurrencyToken();
            e.HasIndex(x => new { x.OrganizationId, x.OrderNo }).IsUnique();
            e.HasIndex(x => new { x.OrganizationId, x.OrderedAt });
            e.HasIndex(x => new { x.OrganizationId, x.Status });
            e.HasOne(x => x.Patient).WithMany().HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Referrer).WithMany().HasForeignKey(x => x.ReferrerId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Items).WithOne().HasForeignKey(x => x.LabOrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Containers).WithOne().HasForeignKey(x => x.LabOrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.OrderedById).OnDelete(DeleteBehavior.SetNull);
            e.OwnsMany(x => x.Packages, p => p.ToJson());
            OwnedByOrganization(e);
        });

        b.Entity<OrderItem>(e =>
        {
            e.Property(x => x.PackageCode).HasMaxLength(30);
            e.Property(x => x.TestCode).HasMaxLength(30);
            e.Property(x => x.TestNameEn).HasMaxLength(200);
            e.Property(x => x.TestNameTh).HasMaxLength(200);
            e.Property(x => x.Unit).HasMaxLength(30);
            e.Property(x => x.Value).HasMaxLength(200);
            e.Property(x => x.RefText).HasMaxLength(80);
            e.Property(x => x.Comment).HasMaxLength(500);
            e.Property(x => x.EnteredByName).HasMaxLength(170);
            e.Property(x => x.VerifiedByName).HasMaxLength(170);
            e.Property(x => x.ApprovedByName).HasMaxLength(170);
            e.Property(x => x.CancelledByName).HasMaxLength(170);
            e.Property(x => x.CancelReason).HasMaxLength(300);
            // Reference limits keep the precision they were set with.
            e.Property(x => x.RefLow).HasPrecision(18, 6);
            e.Property(x => x.RefHigh).HasPrecision(18, 6);
            e.Property(x => x.CriticalLow).HasPrecision(18, 6);
            e.Property(x => x.CriticalHigh).HasPrecision(18, 6);
            e.HasIndex(x => new { x.OrganizationId, x.ResultStatus });
            e.HasOne<LabTest>().WithMany().HasForeignKey(x => x.LabTestId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<SpecimenContainer>().WithMany().HasForeignKey(x => x.ContainerId).OnDelete(DeleteBehavior.Restrict);
            OwnedByOrganization(e);
        });

        b.Entity<SpecimenContainer>(e =>
        {
            e.ToTable("specimen_containers");
            e.Property(x => x.Lsn).HasMaxLength(40);
            e.Property(x => x.SpecimenName).HasMaxLength(120);
            e.Property(x => x.ContainerType).HasMaxLength(80);
            e.Property(x => x.CollectedByName).HasMaxLength(170);
            e.Property(x => x.ReceivedByName).HasMaxLength(170);
            e.Property(x => x.RejectedByName).HasMaxLength(170);
            e.Property(x => x.Volume).HasMaxLength(40);
            e.Property(x => x.Condition).HasMaxLength(80);
            e.Property(x => x.Comment).HasMaxLength(300);
            e.Property(x => x.RejectReason).HasMaxLength(200);
            e.HasIndex(x => new { x.OrganizationId, x.Lsn }).IsUnique();
            e.HasIndex(x => new { x.OrganizationId, x.Status });
            e.HasOne<SpecimenType>().WithMany().HasForeignKey(x => x.SpecimenTypeId).OnDelete(DeleteBehavior.Restrict);
            OwnedByOrganization(e);
        });

        b.Entity<ResultEvent>(e =>
        {
            e.Property(x => x.Action).HasMaxLength(20);
            e.Property(x => x.Value).HasMaxLength(200);
            e.Property(x => x.UserName).HasMaxLength(170);
            e.HasIndex(x => new { x.OrderItemId, x.At });
            e.HasOne<OrderItem>().WithMany().HasForeignKey(x => x.OrderItemId).OnDelete(DeleteBehavior.Restrict);
            OwnedByOrganization(e);
        });

        b.Entity<Invoice>(e =>
        {
            e.Property(x => x.InvoiceNo).HasMaxLength(30);
            e.Property(x => x.Version).IsConcurrencyToken();
            e.HasIndex(x => new { x.OrganizationId, x.InvoiceNo }).IsUnique();
            e.HasIndex(x => x.LabOrderId).IsUnique();
            e.HasIndex(x => new { x.OrganizationId, x.Status });
            e.HasOne(x => x.LabOrder).WithMany().HasForeignKey(x => x.LabOrderId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Patient).WithMany().HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.Payments).WithOne().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Restrict);
            OwnedByOrganization(e);
        });

        b.Entity<Payment>(e =>
        {
            e.Property(x => x.Note).HasMaxLength(300);
            e.Property(x => x.ReceivedByName).HasMaxLength(170);
            e.HasIndex(x => new { x.OrganizationId, x.PaidAt });
            OwnedByOrganization(e);
        });

        b.Entity<AuditLog>(e =>
        {
            e.Property(x => x.UserName).HasMaxLength(170);
            e.Property(x => x.Action).HasMaxLength(40);
            e.Property(x => x.EntityType).HasMaxLength(40);
            e.Property(x => x.EntityId).HasMaxLength(60);
            e.Property(x => x.Detail).HasMaxLength(1000);
            e.HasIndex(x => new { x.OrganizationId, x.At });
            OwnedByOrganization(e);
        });

        b.Entity<NumberSequence>(e =>
        {
            e.ToTable("number_sequences");
            e.HasKey(x => new { x.OrganizationId, x.Key });
            e.Property(x => x.Key).HasMaxLength(40);
            e.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    /// <summary>The tenant's foreign key and the filter that hides every other organization's rows.</summary>
    private void OwnedByOrganization<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> e) where T : class, IOrgOwned
    {
        e.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Cascade);
        e.HasQueryFilter(x => x.OrganizationId == CurrentOrgId);
    }
}
