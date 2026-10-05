namespace WorkInPoland.Api.Infrastructure;

public sealed class JobsOptions
{
    public int ListingLifetimeDays { get; set; } = 30;

    public int MaxPublishedPerCompany { get; set; } = 25;
}

public sealed class McpOptions
{
    /// <summary>Canonical URI of /mcp/account; absent means the account endpoint is not mapped.</summary>
    public string? ResourceUri { get; set; }

    /// <summary>Public origin of the identity service (the MCP token issuer).</summary>
    public string? AuthorizationServer { get; set; }

    public bool AccountEnabled => Uri.TryCreate(ResourceUri, UriKind.Absolute, out _) && !string.IsNullOrWhiteSpace(AuthorizationServer);
}
