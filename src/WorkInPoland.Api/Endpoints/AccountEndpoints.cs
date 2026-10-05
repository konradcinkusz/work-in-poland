using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Services;
using WorkInPoland.Contracts;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Endpoints;

/// <summary>Everything behind the <c>authApi</c> group: the candidate tracker and the employer area.</summary>
public static class AccountEndpoints
{
    public static RouteGroupBuilder MapTrackerEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/tracker", (string? status, ClaimsPrincipal user, TrackerService tracker, CancellationToken ct) => tracker.ListAsync(user.UserId(), status, ct))
            .WithName(OperationNames.ListTracked);
        api.MapPut("/tracker/{jobId:guid}", (Guid jobId, TrackJobRequest request, ClaimsPrincipal user, TrackerService tracker, CancellationToken ct) => tracker.UpsertAsync(user.UserId(), jobId, request, ct))
            .WithValidation()
            .WithName(OperationNames.UpsertTracked);
        api.MapDelete("/tracker/{jobId:guid}", async (Guid jobId, ClaimsPrincipal user, TrackerService tracker, CancellationToken ct) =>
        {
            await tracker.DeleteAsync(user.UserId(), jobId, ct);
            return Results.NoContent();
        }).WithName(OperationNames.DeleteTracked);
        api.MapGet("/me", (ClaimsPrincipal user) => new MeDto(user.UserId(), user.FindFirstValue("email"), user.Roles()))
            .WithName(OperationNames.Me);
        api.MapGet("/me/export", async (ClaimsPrincipal user, AccountDataService data, HttpContext http, CancellationToken ct) =>
        {
            http.Response.Headers.ContentDisposition = "attachment; filename=\"work-in-poland-export.json\"";
            return Results.Ok(await data.ExportAsync(user.UserId(), ct));
        }).WithName(OperationNames.ExportMyData);
        api.MapDelete("/me/data", async ([FromBody] DeleteDataRequest request, ClaimsPrincipal user, AccountDataService data, CancellationToken ct) =>
        {
            await data.DeleteAsync(user.UserId(), request, ct);
            return Results.NoContent();
        }).WithName(OperationNames.DeleteMyData);
        return api;
    }

    public static RouteGroupBuilder MapEmployerEndpoints(this RouteGroupBuilder api)
    {
        var employer = api.MapGroup("/employer");
        employer.MapGet("/companies", async (ClaimsPrincipal user, EmployerService svc, CancellationToken ct) => await svc.ListCompaniesAsync(user.UserId(), ct))
            .WithName(OperationNames.ListMyCompanies);
        employer.MapPost("/companies", async (CompanyInput input, ClaimsPrincipal user, EmployerService svc, CancellationToken ct) =>
        {
            var created = await svc.CreateCompanyAsync(user.UserId(), input, ct);
            return Results.Created($"/api/v1/employer/companies/{created.Id}", created);
        }).WithName(OperationNames.CreateCompany);
        employer.MapPut("/companies/{id:guid}", (Guid id, CompanyInput input, ClaimsPrincipal user, EmployerService svc, CancellationToken ct) => svc.UpdateCompanyAsync(user.UserId(), id, input, ct))
            .WithName(OperationNames.UpdateCompany);

        employer.MapGet("/jobs", ([AsParameters] EmployerJobQuery query, ClaimsPrincipal user, EmployerService svc, CancellationToken ct) => svc.ListJobsAsync(user.UserId(), query, ct))
            .WithName(OperationNames.ListMyJobs);
        employer.MapPost("/jobs", async (JobInput input, ClaimsPrincipal user, EmployerService svc, CancellationToken ct) =>
        {
            var created = await svc.CreateJobAsync(user.UserId(), input, ct);
            return Results.Created($"/api/v1/employer/jobs/{created.Id}", created);
        }).WithName(OperationNames.CreateJob);
        employer.MapGet("/jobs/{id:guid}", (Guid id, ClaimsPrincipal user, EmployerService svc, CancellationToken ct) => svc.GetJobAsync(user.UserId(), id, ct))
            .WithName(OperationNames.GetMyJob);
        employer.MapPut("/jobs/{id:guid}", (Guid id, JobInput input, ClaimsPrincipal user, EmployerService svc, CancellationToken ct) => svc.UpdateJobAsync(user.UserId(), id, input, ct))
            .WithName(OperationNames.UpdateJob);
        employer.MapPost("/jobs/{id:guid}/publish", (Guid id, ClaimsPrincipal user, EmployerService svc, CancellationToken ct) => svc.PublishJobAsync(user.UserId(), id, ct))
            .WithName(OperationNames.PublishJob);
        employer.MapPost("/jobs/{id:guid}/close", (Guid id, ClaimsPrincipal user, EmployerService svc, CancellationToken ct) => svc.CloseJobAsync(user.UserId(), id, ct))
            .WithName(OperationNames.CloseJob);
        employer.MapPost("/jobs/{id:guid}/renew", (Guid id, ClaimsPrincipal user, EmployerService svc, CancellationToken ct) => svc.RenewJobAsync(user.UserId(), id, ct))
            .WithName(OperationNames.RenewJob);
        employer.MapDelete("/jobs/{id:guid}", async (Guid id, ClaimsPrincipal user, EmployerService svc, CancellationToken ct) =>
        {
            await svc.DeleteJobAsync(user.UserId(), id, ct);
            return Results.NoContent();
        }).WithName(OperationNames.DeleteJob);
        return api;
    }
}
