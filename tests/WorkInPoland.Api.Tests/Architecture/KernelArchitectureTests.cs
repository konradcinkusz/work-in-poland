using System.Reflection;
using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Tests.Architecture;

/// <summary>P2 made mechanical: the shared kernel stays small and knows no entity and no domain assembly.</summary>
public class KernelArchitectureTests
{
    private const int KernelLineCeiling = 800;
    private static readonly Assembly Kernel = typeof(ServiceDefaultsExtensions).Assembly;

    private static string RepositoryRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "WorkInPoland.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName ?? throw new InvalidOperationException("WorkInPoland.sln not found above the test binaries.");
    }

    [Fact]
    public void The_kernel_is_at_most_800_lines_of_csharp()
    {
        var root = Path.Combine(RepositoryRoot(), "src", "WorkInPoland.ServiceDefaults");
        var files = Directory.EnumerateFiles(root, "*.cs", SearchOption.AllDirectories)
            .Where(f => !f.Split(Path.DirectorySeparatorChar).Any(part => part is "obj" or "bin"))
            .ToList();
        Assert.NotEmpty(files);
        var lines = files.Sum(f => File.ReadAllLines(f).Length);
        Assert.True(lines <= KernelLineCeiling, $"The kernel has {lines} lines in {files.Count} files; the ceiling is {KernelLineCeiling}.");
    }

    [Fact]
    public void The_kernel_references_neither_the_api_nor_the_contracts()
    {
        var referenced = Kernel.GetReferencedAssemblies().Select(a => a.Name).ToList();
        Assert.DoesNotContain("WorkInPoland.Api", referenced);
        Assert.DoesNotContain("WorkInPoland.Contracts", referenced);
    }

    [Fact]
    public void The_kernel_project_file_references_no_other_workinpoland_project()
    {
        var csproj = File.ReadAllText(Path.Combine(RepositoryRoot(), "src", "WorkInPoland.ServiceDefaults", "WorkInPoland.ServiceDefaults.csproj"));
        Assert.DoesNotContain("ProjectReference", csproj);
    }

    [Fact]
    public void The_kernel_declares_no_entity()
    {
        var options = new DbContextOptionsBuilder<ApiDbContext>().UseInMemoryDatabase("arch").Options;
        using var db = new ApiDbContext(options);
        var entityTypes = db.Model.GetEntityTypes().Select(e => e.ClrType).ToList();
        Assert.NotEmpty(entityTypes);
        Assert.DoesNotContain(entityTypes, t => t.Assembly == Kernel);

        foreach (var type in Kernel.GetTypes())
        {
            var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
            Assert.DoesNotContain(properties, p => p.PropertyType.IsGenericType && p.PropertyType.GetGenericTypeDefinition() == typeof(DbSet<>));
            Assert.DoesNotContain(properties, p => p.Name is "Id" || p.Name == type.Name + "Id");
        }
    }

    [Fact]
    public void The_kernel_exposes_only_extension_methods_and_small_plumbing_types()
    {
        var statics = Kernel.GetExportedTypes().Where(t => t.IsAbstract && t.IsSealed).ToList();
        Assert.All(statics, t => Assert.EndsWith("Extensions", t.Name));
        Assert.DoesNotContain(Kernel.GetExportedTypes(), t => t.IsClass && !t.IsSealed && !t.IsAbstract && t.BaseType != typeof(object));
    }
}
