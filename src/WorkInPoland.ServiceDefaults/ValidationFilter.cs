using System.Collections.Concurrent;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace WorkInPoland.ServiceDefaults;

/// <summary>Runs DataAnnotations on every bound argument that carries any and answers <c>Results.ValidationProblem</c>.</summary>
public sealed class ValidationFilter : IEndpointFilter
{
    private static readonly ConcurrentDictionary<Type, bool> Validatable = new();

    public ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        Dictionary<string, List<string>>? errors = null;
        foreach (var argument in context.Arguments)
        {
            if (argument is null || !Validatable.GetOrAdd(argument.GetType(), HasRules))
            {
                continue;
            }

            var results = new List<ValidationResult>();
            if (Validator.TryValidateObject(argument, new ValidationContext(argument), results, validateAllProperties: true))
            {
                continue;
            }

            errors ??= [];
            foreach (var result in results)
            {
                var members = result.MemberNames.Any() ? result.MemberNames : [string.Empty];
                foreach (var member in members)
                {
                    var key = member.Length > 0 ? char.ToLowerInvariant(member[0]) + member[1..] : member;
                    (errors.TryGetValue(key, out var list) ? list : errors[key] = []).Add(result.ErrorMessage ?? "Invalid value.");
                }
            }
        }

        return errors is null
            ? next(context)
            : ValueTask.FromResult<object?>(Results.ValidationProblem(errors.ToDictionary(e => e.Key, e => e.Value.ToArray())));
    }

    private static bool HasRules(Type type) =>
        typeof(IValidatableObject).IsAssignableFrom(type)
        || TypeDescriptor.GetProperties(type).Cast<PropertyDescriptor>().Any(p => p.Attributes.OfType<ValidationAttribute>().Any());
}

public static class ValidationFilterExtensions
{
    /// <summary>Applies the filter to an endpoint or a whole group.</summary>
    public static TBuilder WithValidation<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder.AddEndpointFilter<TBuilder, ValidationFilter>();
}
