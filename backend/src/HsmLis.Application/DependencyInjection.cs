using HsmLis.Application.Dtos;
using HsmLis.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace HsmLis.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<IOrgContextProvider, OrgContextProvider>();
        services.AddScoped<IAuditTrail, AuditTrail>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IOrganizationService, OrganizationService>();
        services.AddScoped<ICatalogService<DepartmentDto, DepartmentRequest>, DepartmentService>();
        services.AddScoped<ICatalogService<SpecimenTypeDto, SpecimenTypeRequest>, SpecimenTypeService>();
        services.AddScoped<ICatalogService<LabTestDto, LabTestRequest>, LabTestService>();
        services.AddScoped<ICatalogService<PackageDto, PackageRequest>, PackageService>();
        services.AddScoped<ICatalogService<ReferrerDto, ReferrerRequest>, ReferrerService>();
        services.AddScoped<ICatalogService<BranchDto, BranchRequest>, BranchService>();
        services.AddScoped<IPatientService, PatientService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IResultService, ResultService>();
        services.AddScoped<IBillingService, BillingService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IAuditService, AuditService>();
        return services;
    }
}
