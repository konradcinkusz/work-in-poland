using Microsoft.AspNetCore.Mvc;
using WorkInPoland.Api.Services;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Endpoints;

public static class PublicEndpoints
{
    public static RouteGroupBuilder MapPublicEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/jobs", ([AsParameters] JobSearchQuery query, CatalogService catalog, CancellationToken ct) => catalog.SearchJobsAsync(query, ct))
            .WithName(OperationNames.SearchJobs);
        api.MapGet("/jobs/{slug}", (string slug, CatalogService catalog, CancellationToken ct) => catalog.GetJobAsync(slug, ct))
            .WithName(OperationNames.GetJob);
        api.MapPost("/jobs/{slug}/apply-click", (string slug, CatalogService catalog, CancellationToken ct) => catalog.RegisterApplyClickAsync(slug, ct))
            .WithName(OperationNames.ApplyClick);
        api.MapPost("/jobs/{slug}/report", (string slug, JobReportRequest request, ReportingService reporting, CancellationToken ct) => reporting.CreateReportAsync(slug, request, ct))
            .WithValidation()
            .Produces(StatusCodes.Status202Accepted)
            .WithName(OperationNames.ReportJob);
        api.MapGet("/companies", ([AsParameters] CompanyQuery query, CatalogService catalog, CancellationToken ct) => catalog.SearchCompaniesAsync(query, ct))
            .WithName(OperationNames.ListCompanies);
        api.MapGet("/companies/{slug}", (string slug, CatalogService catalog, CancellationToken ct) => catalog.GetCompanyAsync(slug, ct))
            .WithName(OperationNames.GetCompany);
        api.MapGet("/salaries/benchmarks", ([AsParameters] BenchmarkQuery query, SalaryBenchmarkService benchmarks, CancellationToken ct) => benchmarks.GetAsync(query, ct))
            .WithName(OperationNames.SalaryBenchmarks);
        api.MapGet("/meta/filters", (CatalogService catalog, CancellationToken ct) => catalog.GetFilterValuesAsync(ct))
            .WithName(OperationNames.FilterValues);
        api.MapGet("/stats", (CatalogService catalog, CancellationToken ct) => catalog.GetStatsAsync(ct))
            .WithName(OperationNames.Stats);
        return api;
    }
}
