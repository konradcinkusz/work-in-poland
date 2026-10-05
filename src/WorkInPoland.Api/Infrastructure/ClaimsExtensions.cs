using System.Security.Claims;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Infrastructure;

public static class ClaimsExtensions
{
    public static string UserId(this ClaimsPrincipal user) =>
        user.FindFirstValue("sub") is { Length: > 0 } sub ? sub : throw new UnauthorizedAccessException("The token carries no sub claim.");

    public static IReadOnlyList<string> Roles(this ClaimsPrincipal user) =>
        user.FindAll(JwtAuthenticationExtensions.RoleClaimType).Select(c => c.Value).Distinct().ToList();

    public static IReadOnlySet<string> Scopes(this ClaimsPrincipal user) =>
        (user.FindFirstValue("scope") ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet(StringComparer.Ordinal);
}
