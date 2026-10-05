namespace WorkInPoland.ServiceDefaults;

/// <summary>
/// The state of one optional integration (P8). Every registered instance is listed by
/// <c>/health</c> and by the startup banner, so "which features are live here?" is one request.
/// </summary>
public sealed record IntegrationState(string Name, string State);
