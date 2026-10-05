using WorkInPoland.Api.Endpoints;
using WorkInPoland.Api.Infrastructure;
using WorkInPoland.Api.Mcp;
using WorkInPoland.Contracts;
using WorkInPoland.ServiceDefaults;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddCorsPolicy(builder.Configuration, CorsPolicies.Frontend);
builder.Services.AddSwaggerWithJwt("Work in Poland API", "v1", "Polish job board API. Contract: docs/api/API.md");
builder.Services.AddStandardRateLimiting();
builder.Services.AddProblemHandling();
builder.Services.AddApiDatabase(builder.Configuration);
builder.Services.AddApiServices(builder.Configuration);
builder.Services.AddDemoSeeding(builder.Configuration);
builder.Services.AddMcpAdapter(builder.Configuration);

var app = builder.Build();

app.UseProblemHandling();
app.UseCors(CorsPolicies.Frontend);
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(o => o.SwaggerEndpoint("/swagger/v1/swagger.json", "Work in Poland API v1"));
}

app.MapDefaultEndpoints();

var publicApi = app.MapGroup("/api/v1").RequireRateLimiting(RateLimitPolicies.Public);
var authApi = app.MapGroup("/api/v1").RequireAuthorization().RequireRateLimiting(RateLimitPolicies.Api);
var adminApi = app.MapGroup("/api/v1/admin")
    .RequireAuthorization(p => p.RequireRole(Roles.Admin, Roles.SuperAdmin))
    .RequireRateLimiting(RateLimitPolicies.Api);

publicApi.MapPublicEndpoints();
authApi.MapTrackerEndpoints();
authApi.MapEmployerEndpoints();
adminApi.MapAdminEndpoints();
app.MapMcpEndpoints();

app.Run();

public partial class Program;
