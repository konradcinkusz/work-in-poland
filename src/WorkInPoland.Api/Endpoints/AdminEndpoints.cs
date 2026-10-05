using System.Security.Claims;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;
using WorkInPoland.Contracts;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Endpoints;

public static class AdminEndpoints
{
    public static RouteGroupBuilder MapAdminEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGet("/jobs", ([AsParameters] AdminJobQuery query, AdminService svc, CancellationToken ct) => svc.ListJobsAsync(query, ct))
            .WithName(OperationNames.AdminListJobs);
        admin.MapPost("/jobs/{id:guid}/unpublish", (Guid id, UnpublishRequest request, ClaimsPrincipal user, AdminService svc, CancellationToken ct) => svc.UnpublishJobAsync(user.UserId(), id, request, ct))
            .WithValidation()
            .WithName(OperationNames.AdminUnpublishJob);
        admin.MapPost("/jobs/{id:guid}/promote", (Guid id, PromoteRequest request, ClaimsPrincipal user, AdminService svc, CancellationToken ct) => svc.PromoteJobAsync(user.UserId(), id, request, ct))
            .WithValidation()
            .WithName(OperationNames.AdminPromoteJob);
        admin.MapGet("/companies", ([AsParameters] AdminCompanyQuery query, AdminService svc, CancellationToken ct) => svc.ListCompaniesAsync(query, ct))
            .WithName(OperationNames.AdminListCompanies);
        admin.MapPost("/companies/{id:guid}/verify", (Guid id, ClaimsPrincipal user, AdminService svc, CancellationToken ct) => svc.SetVerifiedAsync(user.UserId(), id, true, ct))
            .WithName(OperationNames.AdminVerifyCompany);
        admin.MapPost("/companies/{id:guid}/unverify", (Guid id, ClaimsPrincipal user, AdminService svc, CancellationToken ct) => svc.SetVerifiedAsync(user.UserId(), id, false, ct))
            .WithName(OperationNames.AdminUnverifyCompany);
        admin.MapGet("/reports", ([AsParameters] AdminReportQuery query, ReportingService reporting, CancellationToken ct) => reporting.ListReportsAsync(query, ct))
            .WithName(OperationNames.AdminListReports);
        admin.MapPost("/reports/{id:guid}/resolve", (Guid id, AdminResolveReportRequest request, ClaimsPrincipal user, ReportingService reporting, CancellationToken ct) => reporting.ResolveReportAsync(id, user.UserId(), request, ct))
            .WithValidation()
            .WithName(OperationNames.AdminResolveReport);
        return admin;
    }
}
