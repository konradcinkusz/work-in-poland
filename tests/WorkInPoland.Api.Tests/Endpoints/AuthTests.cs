using System.Net;
using WorkInPoland.Api.Tests.Infrastructure;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Tests.Endpoints;

/// <summary>Real token validation (RS256, issuer, audience) against a test key injected with PostConfigure.</summary>
public class AuthTests : IDisposable
{
    private readonly ApiFactory _factory = new(mcpAccount: true);

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task No_token_is_401_with_no_body()
    {
        var response = await _factory.CreateClient().GetAsync("/api/v1/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task A_valid_web_token_reaches_the_endpoint_and_exposes_the_claims()
    {
        var token = TestTokens.Web("user-1", ["Admin"], "ala@example.com");
        var me = await (await _factory.CreateClientFor(token).GetAsync("/api/v1/me")).ReadAsync<MeDto>();
        Assert.Equal(("user-1", "ala@example.com"), (me.UserId, me.Email));
        Assert.Equal(["Admin"], me.Roles);
    }

    [Fact]
    public async Task A_token_with_the_wrong_audience_is_401() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClientFor(TestTokens.Web("u", audience: "someone-else")).GetAsync("/api/v1/me")).StatusCode);

    [Fact]
    public async Task A_token_with_the_wrong_issuer_is_401() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClientFor(TestTokens.Web("u", issuer: "evil")).GetAsync("/api/v1/me")).StatusCode);

    [Fact]
    public async Task An_expired_token_is_401() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClientFor(TestTokens.Web("u", lifetime: TimeSpan.FromMinutes(-5))).GetAsync("/api/v1/me")).StatusCode);

    [Fact]
    public async Task A_token_signed_by_another_key_is_401()
    {
        using var rsa = System.Security.Cryptography.RSA.Create(2048);
        var descriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Issuer = TestTokens.WebIssuer,
            Audience = TestTokens.WebAudience,
            Subject = new System.Security.Claims.ClaimsIdentity([new System.Security.Claims.Claim("sub", "u")]),
            Expires = DateTime.UtcNow.AddMinutes(5),
            SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(new Microsoft.IdentityModel.Tokens.RsaSecurityKey(rsa), "RS256"),
        };
        var forged = new Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler().CreateToken(descriptor);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClientFor(forged).GetAsync("/api/v1/me")).StatusCode);
    }

    [Fact]
    public async Task An_hmac_signed_token_is_401_because_only_rs256_is_accepted()
    {
        var key = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(new byte[64]);
        var descriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Issuer = TestTokens.WebIssuer,
            Audience = TestTokens.WebAudience,
            Subject = new System.Security.Claims.ClaimsIdentity([new System.Security.Claims.Claim("sub", "u")]),
            Expires = DateTime.UtcNow.AddMinutes(5),
            SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(key, "HS256"),
        };
        var token = new Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler().CreateToken(descriptor);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClientFor(token).GetAsync("/api/v1/me")).StatusCode);
    }

    [Fact]
    public async Task An_mcp_token_is_refused_by_the_web_api() =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClientFor(TestTokens.Mcp("u", "jobs:read")).GetAsync("/api/v1/me")).StatusCode);

    [Fact]
    public async Task A_web_token_is_refused_by_the_account_mcp_endpoint()
    {
        var response = await _factory.CreateClientFor(TestTokens.Web("u")).PostAsync("/mcp/account", new StringContent("{}", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains("resource_metadata=", response.Headers.WwwAuthenticate.ToString());
    }

    [Theory]
    [InlineData("/api/v1/tracker")]
    [InlineData("/api/v1/employer/companies")]
    [InlineData("/api/v1/employer/jobs")]
    [InlineData("/api/v1/admin/jobs")]
    [InlineData("/api/v1/admin/companies")]
    [InlineData("/api/v1/me/export")]
    public async Task Every_protected_group_answers_401_without_a_token(string url) =>
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync(url)).StatusCode);

    [Fact]
    public async Task Admin_endpoints_are_403_with_a_problem_body_for_a_user_without_the_role()
    {
        var response = await _factory.CreateClientFor(TestTokens.Web("user-1", ["User"])).GetAsync("/api/v1/admin/jobs");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("Forbidden", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("Admin")]
    [InlineData("SuperAdmin")]
    public async Task Admin_endpoints_accept_admin_and_super_admin(string role) =>
        Assert.Equal(HttpStatusCode.OK, (await _factory.CreateClientFor(TestTokens.Web("root", [role])).GetAsync("/api/v1/admin/jobs")).StatusCode);

    [Fact]
    public async Task Public_endpoints_stay_anonymous() =>
        Assert.Equal(HttpStatusCode.OK, (await _factory.CreateClient().GetAsync("/api/v1/jobs")).StatusCode);

    [Fact]
    public async Task Without_jwt_authority_configured_authenticated_endpoints_answer_401_not_500()
    {
        using var bare = new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program>();
        var client = bare.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", TestTokens.Web("u"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/jobs")).StatusCode);
    }
}
