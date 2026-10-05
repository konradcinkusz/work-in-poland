using Microsoft.AspNetCore.Diagnostics;

namespace WorkInPoland.Api.Infrastructure;

/// <summary>Translates domain exceptions into the problem+json shapes of API.md section 1.</summary>
public sealed class DomainExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        IResult? result = exception switch
        {
            ValidationFailedException v => Results.ValidationProblem(v.Errors.ToDictionary(e => e.Key, e => e.Value)),
            NotFoundException n => Results.Problem(title: "Not Found", detail: n.Message, statusCode: StatusCodes.Status404NotFound),
            ConflictException c => Results.Problem(title: "Conflict", detail: c.Message, statusCode: StatusCodes.Status409Conflict),
            ForbiddenException f => Results.Problem(title: "Forbidden", detail: f.Message, statusCode: StatusCodes.Status403Forbidden),
            UnauthorizedAccessException => Results.StatusCode(StatusCodes.Status401Unauthorized),
            _ => null,
        };
        if (result is null)
        {
            return false;
        }

        await result.ExecuteAsync(context);
        return true;
    }
}

public static class ProblemHandlingExtensions
{
    public static IServiceCollection AddProblemHandling(this IServiceCollection services)
    {
        services.AddProblemDetails();
        services.AddExceptionHandler<DomainExceptionHandler>();
        return services;
    }

    /// <summary>Exception handler plus a problem body for bare 403s (401 stays body-less by contract).</summary>
    public static WebApplication UseProblemHandling(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages(async context =>
        {
            if (context.HttpContext.Response.StatusCode == StatusCodes.Status403Forbidden)
            {
                await Results.Problem(title: "Forbidden", detail: "You do not have permission to perform this action.", statusCode: StatusCodes.Status403Forbidden)
                    .ExecuteAsync(context.HttpContext);
            }
        });
        return app;
    }
}
