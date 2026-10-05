using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace WorkInPoland.ServiceDefaults;

/// <summary>
/// Token validation only (P5): RS256 against the identity service's JWKS. This service holds no key
/// material. A missing <c>Jwt:Authority</c> degrades to "every token is refused", never to a startup failure.
/// </summary>
public static class JwtAuthenticationExtensions
{
    public const string BearerScheme = "Bearer";
    public const string RoleClaimType = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

    public static AuthenticationBuilder AddJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var authority = configuration["Jwt:Authority"]?.Trim().TrimEnd('/');
        var configured = !string.IsNullOrEmpty(authority);
        var requireHttps = configuration.GetValue("Jwt:RequireHttpsMetadata", true);
        var state = !configured ? "not-configured" : requireHttps ? "configured" : "configured (metadata over http - insecure)";
        services.AddSingleton(new IntegrationState("auth", state));
        services.AddAuthorization();
        return services.AddAuthentication(BearerScheme).AddJwtBearerScheme(
            BearerScheme,
            configured ? $"{authority}/.well-known/openid-configuration" : null,
            configuration["Jwt:Issuer"],
            configuration["Jwt:Audience"],
            requireHttps);
    }

    /// <summary>Registers one more RS256 bearer scheme with its own metadata document, issuer and audience.</summary>
    public static AuthenticationBuilder AddJwtBearerScheme(
        this AuthenticationBuilder builder,
        string scheme,
        string? metadataAddress,
        string? issuer,
        string? audience,
        bool requireHttpsMetadata = true,
        Action<JwtBearerOptions>? configure = null)
    {
        return builder.AddJwtBearer(scheme, options =>
        {
            options.MapInboundClaims = false;
            options.MetadataAddress = metadataAddress!;
            options.RequireHttpsMetadata = requireHttpsMetadata;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = issuer,
                ValidateAudience = true,
                ValidAudience = audience,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                RequireSignedTokens = true,
                ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
                ClockSkew = TimeSpan.FromSeconds(30),
                NameClaimType = "sub",
                RoleClaimType = RoleClaimType,
            };
            configure?.Invoke(options);
        });
    }
}
