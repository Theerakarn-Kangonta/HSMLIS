using HsmLis.Application.Common;
using HsmLis.Application.Repositories;
using HsmLis.Domain.Entities;
using HsmLis.Infrastructure.Persistence;
using HsmLis.Infrastructure.Security;
using HsmLis.Infrastructure.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HsmLis.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionName = "Database";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options => options
            .UseNpgsql(
                configuration.GetConnectionString(ConnectionName),
                npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", AppDbContext.Schema))
            .UseSnakeCaseNamingConvention());

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.Section));

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IOrganizationRepository, OrganizationRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<ICatalogRepository<Branch>, CatalogRepository<Branch>>();
        services.AddScoped<ICatalogRepository<Department>, CatalogRepository<Department>>();
        services.AddScoped<ICatalogRepository<SpecimenType>, CatalogRepository<SpecimenType>>();
        services.AddScoped<ICatalogRepository<LabTest>, CatalogRepository<LabTest>>();
        services.AddScoped<ICatalogRepository<TestPackage>, CatalogRepository<TestPackage>>();
        services.AddScoped<ICatalogRepository<ReferringOrganization>, CatalogRepository<ReferringOrganization>>();
        services.AddScoped<ICatalogUsage, CatalogUsage>();
        services.AddScoped<IPatientRepository, PatientRepository>();
        services.AddScoped<ILabOrderRepository, LabOrderRepository>();
        services.AddScoped<IInvoiceRepository, InvoiceRepository>();
        services.AddScoped<IAuditRepository, AuditRepository>();
        services.AddScoped<ISequenceRepository, SequenceRepository>();

        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<ITokenService, JwtTokenService>();
        services.Configure<QzOptions>(configuration.GetSection(QzOptions.Section));
        services.AddSingleton<IQzSigner, QzSigner>();
        services.AddScoped<DatabaseSeeder>();
        return services;
    }
}
