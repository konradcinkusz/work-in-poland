namespace WorkInPoland.Api.Infrastructure;

/// <summary>Business failures the transport edges (REST, MCP) translate into their own error shapes.</summary>
public abstract class DomainException(string message) : Exception(message);

public sealed class NotFoundException(string message) : DomainException(message);

public sealed class ConflictException(string message) : DomainException(message);

public sealed class ForbiddenException(string message) : DomainException(message);

public sealed class ValidationFailedException(IReadOnlyDictionary<string, string[]> errors)
    : DomainException("One or more validation errors occurred: " + string.Join("; ", errors.Select(e => $"{e.Key}: {string.Join(", ", e.Value)}")))
{
    public IReadOnlyDictionary<string, string[]> Errors { get; } = errors;
}
