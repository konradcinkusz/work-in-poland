using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Tests.Infrastructure;

/// <summary>A throw-away RSA key standing in for the identity service. It never leaves the test process.</summary>
public static class TestTokens
{
    public const string WebIssuer = "WorkInPoland";
    public const string WebAudience = "WorkInPoland";
    public const string McpResource = "https://api.test.example/mcp/account";
    public const string AuthorizationServer = "https://auth.test.example";

    private static readonly RSA Rsa = RSA.Create(2048);
    public static readonly RsaSecurityKey Key = new(Rsa) { KeyId = "test-key" };

    public static string Web(string sub, string[]? roles = null, string? email = null, string audience = WebAudience, string issuer = WebIssuer, TimeSpan? lifetime = null) =>
        Create(sub, issuer, audience, null, roles, email, lifetime);

    public static string Mcp(string sub, string scope, string audience = McpResource, string issuer = AuthorizationServer) =>
        Create(sub, issuer, audience, scope, null, null, null);

    private static string Create(string sub, string issuer, string audience, string? scope, string[]? roles, string? email, TimeSpan? lifetime)
    {
        var claims = new List<Claim> { new("sub", sub) };
        if (email is not null)
        {
            claims.Add(new Claim("email", email));
        }

        if (scope is not null)
        {
            claims.Add(new Claim("scope", scope));
        }

        claims.AddRange((roles ?? []).Select(r => new Claim(JwtAuthenticationExtensions.RoleClaimType, r)));
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            Subject = new ClaimsIdentity(claims),
            NotBefore = DateTime.UtcNow.AddMinutes(-1),
            Expires = DateTime.UtcNow.Add(lifetime ?? TimeSpan.FromMinutes(10)),
            SigningCredentials = new SigningCredentials(Key, SecurityAlgorithms.RsaSha256),
        });
    }
}
