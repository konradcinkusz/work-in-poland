using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Domain;

namespace WorkInPoland.Api.Data;

public sealed class ApiDbContext(DbContextOptions<ApiDbContext> options) : DbContext(options)
{
    public DbSet<Company> Companies => Set<Company>();

    public DbSet<JobListing> Jobs => Set<JobListing>();

    public DbSet<JobSkill> JobSkills => Set<JobSkill>();

    public DbSet<SalaryOffer> Salaries => Set<SalaryOffer>();

    public DbSet<TrackedJob> TrackedJobs => Set<TrackedJob>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Company>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Slug).HasMaxLength(160);
            e.Property(c => c.Name).HasMaxLength(200);
            e.Property(c => c.Website).HasMaxLength(500);
            e.Property(c => c.Description).HasMaxLength(2000);
            e.Property(c => c.City).HasMaxLength(100);
            e.Property(c => c.LogoUrl).HasMaxLength(500);
            e.Property(c => c.Nip).HasMaxLength(10);
            e.Property(c => c.OwnerUserId).HasMaxLength(128);
            e.HasIndex(c => c.Slug).IsUnique();
            e.HasIndex(c => c.OwnerUserId);
        });

        modelBuilder.Entity<JobListing>(e =>
        {
            e.HasKey(j => j.Id);
            e.Property(j => j.Slug).HasMaxLength(200);
            e.Property(j => j.Title).HasMaxLength(200);
            e.Property(j => j.Description).HasMaxLength(20000);
            e.Property(j => j.Category).HasMaxLength(40);
            e.Property(j => j.Seniority).HasMaxLength(20);
            e.Property(j => j.WorkMode).HasMaxLength(20);
            e.Property(j => j.RemoteScope).HasMaxLength(20);
            e.Property(j => j.City).HasMaxLength(100);
            e.Property(j => j.ApplyUrl).HasMaxLength(500);
            e.Property(j => j.Status).HasMaxLength(20);
            e.Property(j => j.UnpublishReason).HasMaxLength(500);
            e.HasIndex(j => j.Slug).IsUnique();
            e.HasIndex(j => new { j.Status, j.ExpiresAt });
            e.HasIndex(j => j.CompanyId);
            e.HasOne(j => j.Company).WithMany(c => c.Jobs).HasForeignKey(j => j.CompanyId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<JobSkill>(e =>
        {
            e.HasKey(s => new { s.JobId, s.Name });
            e.Property(s => s.Name).HasMaxLength(40);
            e.HasOne<JobListing>().WithMany(j => j.Skills).HasForeignKey(s => s.JobId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => s.Name);
        });

        modelBuilder.Entity<SalaryOffer>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.ContractType).HasMaxLength(20);
            e.Property(s => s.Currency).HasMaxLength(3);
            e.Property(s => s.Period).HasMaxLength(10);
            e.Property(s => s.Basis).HasMaxLength(10);
            e.Property(s => s.Min).HasPrecision(14, 2);
            e.Property(s => s.Max).HasPrecision(14, 2);
            e.Property(s => s.MonthlyMax).HasPrecision(14, 2);
            e.Property(s => s.MonthlyMidpoint).HasPrecision(14, 2);
            e.HasOne(s => s.Job).WithMany(j => j.Salaries).HasForeignKey(s => s.JobId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => new { s.ContractType, s.Currency });
        });

        modelBuilder.Entity<TrackedJob>(e =>
        {
            e.HasKey(t => new { t.UserId, t.JobId });
            e.Property(t => t.UserId).HasMaxLength(128);
            e.Property(t => t.Status).HasMaxLength(20);
            e.Property(t => t.Notes).HasMaxLength(2000);
            e.HasOne(t => t.Job).WithMany().HasForeignKey(t => t.JobId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
