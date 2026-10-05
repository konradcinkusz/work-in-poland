using System.ComponentModel;
using ModelContextProtocol.Protocol;
using ModelContextProtocol.Server;
using WorkInPoland.Api.Services;
using WorkInPoland.Contracts;

namespace WorkInPoland.Api.Mcp;

/// <summary>
/// Tools that act as the signed-in user; served only on /mcp/account. Each one checks its own scope.
/// Deliberately absent: export and deletion of the account's data (GET /me/export, DELETE /me/data). A destructive,
/// account-level action stays out of an assistant's reach; the person does it themselves in the web app.
/// </summary>
[McpServerToolType]
public sealed class AccountTools(TrackerService tracker, EmployerService employer)
{
    private const string SalaryHelp = "Array of salary offers, at most one per contractType, each { contractType: uop|b2b|zlecenie|dzielo, min, max, currency: PLN|EUR|USD|GBP|CHF, period: month|hour|day, basis: gross|net } (net means net of VAT for b2b). A range is mandatory to publish.";

    [McpServerTool(Name = "track_job", Idempotent = true, Title = "Track a job")]
    [Description("Saves a job to the user's private tracker or updates its status and notes. Nothing is sent to the employer. appliedAt is set the first time the status becomes applied, interviewing or offer. Requires the tracker:write scope. Returns the tracked job as JSON.")]
    public Task<string> TrackJob(
        RequestContext<CallToolRequestParams> context,
        [Description("The job's id (GUID, field 'id' of a job).")] Guid jobId,
        [Description("One of: saved, applied, interviewing, offer, rejected, archived.")] string status,
        [Description("Private note, at most 2000 characters. Omit to keep the existing note.")] string? notes = null,
        CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.TrackerWrite);
        return McpSupport.RunAsync(() => tracker.UpsertAsync(user, jobId, new TrackJobRequest(status, notes), ct));
    }

    [McpServerTool(Name = "list_tracked_jobs", ReadOnly = true, Title = "List tracked jobs")]
    [Description("Lists the user's tracked jobs, most recently updated first, including jobs that have since closed. Requires the jobs:read scope. Returns { items: [{ job, status, notes, appliedAt, updatedAt }] }.")]
    public Task<string> ListTrackedJobs(
        RequestContext<CallToolRequestParams> context,
        [Description("Optional status filter: saved, applied, interviewing, offer, rejected, archived.")] string? status = null,
        CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.JobsRead);
        return McpSupport.RunAsync(() => tracker.ListAsync(user, status, ct));
    }

    [McpServerTool(Name = "untrack_job", Destructive = true, Idempotent = true, Title = "Remove a tracked job")]
    [Description("Removes a job from the user's tracker. Requires the tracker:write scope. Returns { removed: true }.")]
    public Task<string> UntrackJob(
        RequestContext<CallToolRequestParams> context,
        [Description("The job's id (GUID).")] Guid jobId,
        CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.TrackerWrite);
        return McpSupport.RunAsync(async () =>
        {
            await tracker.DeleteAsync(user, jobId, ct);
            return new { removed = true };
        });
    }

    [McpServerTool(Name = "list_my_companies", ReadOnly = true, Title = "List my companies")]
    [Description("Lists the companies the signed-in employer owns, with ids needed by post_job. Requires the employer:write scope.")]
    public Task<string> ListMyCompanies(RequestContext<CallToolRequestParams> context, CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.EmployerWrite);
        return McpSupport.RunAsync(() => employer.ListCompaniesAsync(user, ct));
    }

    [McpServerTool(Name = "create_company", Title = "Create a company")]
    [Description("Creates a company profile owned by the signed-in user. Changing name or nip later clears verification. Requires the employer:write scope. Returns the company including its id.")]
    public Task<string> CreateCompany(
        RequestContext<CallToolRequestParams> context,
        [Description("Company name, 2-120 characters.")] string name,
        [Description("Company website, absolute https URL.")] string website,
        [Description("Markdown description, at most 2000 characters.")] string? description = null,
        [Description("Headquarters city.")] string? city = null,
        [Description("Logo image URL, absolute https.")] string? logoUrl = null,
        [Description("Polish tax id (NIP), 10 digits with a valid checksum.")] string? nip = null,
        CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.EmployerWrite);
        return McpSupport.RunAsync(() => employer.CreateCompanyAsync(user, new CompanyInput(name, website, description, city, logoUrl, nip), ct));
    }

    [McpServerTool(Name = "list_my_jobs", ReadOnly = true, Title = "List my listings")]
    [Description("Lists the signed-in employer's listings with status, views and apply clicks. Requires the employer:write scope. Returns { items, total, page, limit }.")]
    public Task<string> ListMyJobs(
        RequestContext<CallToolRequestParams> context,
        [Description("Only listings of this company (GUID).")] Guid? companyId = null,
        [Description("Only this status: draft, published, closed, expired.")] string? status = null,
        [Description("Page number, starting at 1.")] int? page = null,
        [Description("Page size 1-100, default 20.")] int? limit = null,
        CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.EmployerWrite);
        return McpSupport.RunAsync(() => employer.ListJobsAsync(user, new EmployerJobQuery(companyId, status, page, limit), ct));
    }

    [McpServerTool(Name = "get_my_job", ReadOnly = true, Title = "Get one of my listings")]
    [Description("Returns one of the signed-in employer's listings, including drafts, with views and apply clicks. Requires the employer:write scope.")]
    public Task<string> GetMyJob(RequestContext<CallToolRequestParams> context, [Description("The listing's id (GUID).")] Guid jobId, CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.EmployerWrite);
        return McpSupport.RunAsync(() => employer.GetJobAsync(user, jobId, ct));
    }

    [McpServerTool(Name = "post_job", Title = "Post a job")]
    [Description("Creates a job listing for one of the user's companies, as a draft (publish=false) or published immediately (publish=true). Publishing enforces every rule: title 5-120 characters, description 50-20000 characters (markdown), 1-15 skills, an https applyUrl, a mandatory salary range, a city unless remote and a remoteScope when remote. A draft is checked for shape only. Requires the employer:write scope. Returns the listing; fix any validation message and call again.")]
    public Task<string> PostJob(
        RequestContext<CallToolRequestParams> context,
        [Description("Company id (GUID) from list_my_companies or create_company.")] Guid companyId,
        [Description("Job title.")] string title,
        [Description("backend, frontend, fullstack, mobile, devops, data, ai-ml, qa, security, design, product, project-management, support or other.")] string category,
        [Description("intern, junior, mid, senior or lead.")] string seniority,
        [Description("remote, hybrid or onsite.")] string workMode,
        [Description("Markdown description in the language of the audience (usually Polish). Required to publish.")] string? description = null,
        [Description("Required when workMode is remote (poland, eu or worldwide); must be omitted otherwise.")] string? remoteScope = null,
        [Description("City; required unless the job is remote.")] string? city = null,
        [Description(SalaryHelp)] SalaryOfferDto[]? salaries = null,
        [Description("1-15 skills, e.g. ['c#', 'postgresql'].")] string[]? skills = null,
        [Description("Absolute https URL where candidates apply (the employer's own site).")] string? applyUrl = null,
        [Description("true to publish now, false to save a draft.")] bool publish = false,
        CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.EmployerWrite);
        return McpSupport.RunAsync(() => employer.CreateJobAsync(user, McpSupport.ToJobInput(companyId, title, description, category, seniority, workMode, remoteScope, city, salaries, skills, applyUrl, publish), ct));
    }

    [McpServerTool(Name = "update_job", Idempotent = true, Title = "Update a job")]
    [Description("Replaces the content of a draft or published listing (send every field, not a patch). A closed or expired listing cannot be edited: renew it first. Requires the employer:write scope.")]
    public Task<string> UpdateJob(
        RequestContext<CallToolRequestParams> context,
        [Description("The listing's id (GUID).")] Guid jobId,
        [Description("Company id (GUID); must be the listing's current company.")] Guid companyId,
        [Description("Job title.")] string title,
        [Description("Category, see post_job.")] string category,
        [Description("intern, junior, mid, senior or lead.")] string seniority,
        [Description("remote, hybrid or onsite.")] string workMode,
        [Description("Markdown description.")] string? description = null,
        [Description("Required when remote; omit otherwise.")] string? remoteScope = null,
        [Description("City; required unless remote.")] string? city = null,
        [Description(SalaryHelp)] SalaryOfferDto[]? salaries = null,
        [Description("1-15 skills.")] string[]? skills = null,
        [Description("Absolute https URL where candidates apply.")] string? applyUrl = null,
        CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.EmployerWrite);
        return McpSupport.RunAsync(() => employer.UpdateJobAsync(user, jobId, McpSupport.ToJobInput(companyId, title, description, category, seniority, workMode, remoteScope, city, salaries, skills, applyUrl, false), ct));
    }

    [McpServerTool(Name = "publish_job", Title = "Publish a draft")]
    [Description("Publishes a draft listing after re-validating every rule (including the mandatory salary range). It stays visible for 30 days by default. Requires the employer:write scope.")]
    public Task<string> PublishJob(RequestContext<CallToolRequestParams> context, [Description("The draft's id (GUID).")] Guid jobId, CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.EmployerWrite);
        return McpSupport.RunAsync(() => employer.PublishJobAsync(user, jobId, ct));
    }

    [McpServerTool(Name = "close_job", Title = "Close a job")]
    [Description("Closes a published listing so it disappears from search. Requires the employer:write scope.")]
    public Task<string> CloseJob(RequestContext<CallToolRequestParams> context, [Description("The listing's id (GUID).")] Guid jobId, CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.EmployerWrite);
        return McpSupport.RunAsync(() => employer.CloseJobAsync(user, jobId, ct));
    }

    [McpServerTool(Name = "renew_job", Title = "Renew a job")]
    [Description("Publishes a published, closed or expired listing again with a fresh expiry. It counts against the company's cap on simultaneously published listings. Requires the employer:write scope.")]
    public Task<string> RenewJob(RequestContext<CallToolRequestParams> context, [Description("The listing's id (GUID).")] Guid jobId, CancellationToken ct = default)
    {
        var user = McpSupport.Caller(context, Scopes.EmployerWrite);
        return McpSupport.RunAsync(() => employer.RenewJobAsync(user, jobId, ct));
    }
}
