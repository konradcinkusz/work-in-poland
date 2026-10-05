using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi;

namespace WorkInPoland.ServiceDefaults;

/// <summary>CORS and OpenAPI: one named policy and one document with a bearer security scheme.</summary>
public static class ApiSurfaceExtensions
{
    public static IServiceCollection AddCorsPolicy(this IServiceCollection services, IConfiguration configuration, string policyName)
    {
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()?
            .Where(o => !string.IsNullOrWhiteSpace(o)).Select(o => o.Trim().TrimEnd('/')).ToArray() ?? [];
        services.AddSingleton(new IntegrationState("cors", origins.Length > 0 ? $"{origins.Length} origin(s)" : "same-origin"));
        services.AddCors(o => o.AddPolicy(policyName, p =>
        {
            if (origins.Length > 0)
            {
                p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
            }
        }));
        return services;
    }

    public static IServiceCollection AddSwaggerWithJwt(this IServiceCollection services, string title, string version, string description)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc(version, new OpenApiInfo { Title = title, Version = version, Description = description });
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                Description = "An access token issued by the identity service.",
            });
            options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
            {
                [new OpenApiSecuritySchemeReference("Bearer", document)] = [],
            });
        });
        return services;
    }
}
