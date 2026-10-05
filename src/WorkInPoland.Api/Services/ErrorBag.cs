using WorkInPoland.Api.Infrastructure;

namespace WorkInPoland.Api.Services;

public sealed class ErrorBag
{
    private readonly Dictionary<string, List<string>> _errors = [];

    public bool Any => _errors.Count > 0;

    public void Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var list))
        {
            _errors[field] = list = [];
        }

        list.Add(message);
    }

    public IReadOnlyDictionary<string, string[]> ToDictionary() => _errors.ToDictionary(e => e.Key, e => e.Value.ToArray());

    public void ThrowIfAny()
    {
        if (Any)
        {
            throw new ValidationFailedException(ToDictionary());
        }
    }
}
