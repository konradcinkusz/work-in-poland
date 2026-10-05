namespace WorkInPoland.ServiceDefaults;

/// <summary>Completed by the migration service; every other hosted service awaits it before touching the schema.</summary>
public interface IMigrationCompletionSignal
{
    bool IsCompleted { get; }

    Task WaitAsync(CancellationToken cancellationToken = default);

    void SetCompleted();
}

public sealed class MigrationCompletionSignal : IMigrationCompletionSignal
{
    private readonly TaskCompletionSource _completion = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public bool IsCompleted => _completion.Task.IsCompletedSuccessfully;

    public Task WaitAsync(CancellationToken cancellationToken = default) => _completion.Task.WaitAsync(cancellationToken);

    public void SetCompleted() => _completion.TrySetResult();
}
