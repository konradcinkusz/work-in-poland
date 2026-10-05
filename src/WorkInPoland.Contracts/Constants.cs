namespace WorkInPoland.Contracts;

/// <summary>OAuth scopes registered in the identity service (API.md section 9).</summary>
public static class Scopes
{
    public const string JobsRead = "jobs:read";
    public const string TrackerWrite = "tracker:write";
    public const string EmployerWrite = "employer:write";
    public const string OfflineAccess = "offline_access";

    public static readonly string[] All = [JobsRead, TrackerWrite, EmployerWrite, OfflineAccess];
}

public static class AuthSchemes
{
    public const string Web = "Bearer";
    public const string Mcp = "Mcp";
}

public static class Roles
{
    public const string Admin = "Admin";
    public const string SuperAdmin = "SuperAdmin";
}

public static class CorsPolicies
{
    public const string Frontend = "Frontend";
}

public static class RateLimitPolicies
{
    public const string Api = "api";
    public const string Public = "public";
}

/// <summary>Stable operation ids (endpoint names) for generated clients.</summary>
public static class OperationNames
{
    public const string SearchJobs = "SearchJobs";
    public const string GetJob = "GetJob";
    public const string ApplyClick = "ApplyClick";
    public const string ListCompanies = "ListCompanies";
    public const string GetCompany = "GetCompany";
    public const string SalaryBenchmarks = "SalaryBenchmarks";
    public const string FilterValues = "FilterValues";
    public const string Stats = "Stats";

    public const string ListTracked = "ListTracked";
    public const string UpsertTracked = "UpsertTracked";
    public const string DeleteTracked = "DeleteTracked";
    public const string Me = "Me";
    public const string ExportMyData = "ExportMyData";
    public const string DeleteMyData = "DeleteMyData";

    public const string ListMyCompanies = "ListMyCompanies";
    public const string CreateCompany = "CreateCompany";
    public const string UpdateCompany = "UpdateCompany";
    public const string ListMyJobs = "ListMyJobs";
    public const string CreateJob = "CreateJob";
    public const string GetMyJob = "GetMyJob";
    public const string UpdateJob = "UpdateJob";
    public const string PublishJob = "PublishJob";
    public const string CloseJob = "CloseJob";
    public const string RenewJob = "RenewJob";
    public const string DeleteJob = "DeleteJob";

    public const string AdminListJobs = "AdminListJobs";
    public const string AdminUnpublishJob = "AdminUnpublishJob";
    public const string AdminPromoteJob = "AdminPromoteJob";
    public const string AdminListCompanies = "AdminListCompanies";
    public const string AdminVerifyCompany = "AdminVerifyCompany";
    public const string AdminUnverifyCompany = "AdminUnverifyCompany";
}

/// <summary>Allowed values of the vocabularies in API.md section 2 (all lowercase except currency).</summary>
public static class Vocabulary
{
    public static readonly string[] Categories =
        ["backend", "frontend", "fullstack", "mobile", "devops", "data", "ai-ml", "qa", "security", "design", "product", "project-management", "support", "other"];

    public static readonly string[] Seniorities = ["intern", "junior", "mid", "senior", "lead"];
    public static readonly string[] WorkModes = ["remote", "hybrid", "onsite"];
    public static readonly string[] RemoteScopes = ["poland", "eu", "worldwide"];
    public static readonly string[] ContractTypes = ["uop", "b2b", "zlecenie", "dzielo"];
    public static readonly string[] SalaryBases = ["gross", "net"];
    public static readonly string[] SalaryPeriods = ["month", "hour", "day"];
    public static readonly string[] Currencies = ["PLN", "EUR", "USD", "GBP", "CHF"];
    public static readonly string[] JobStatuses = ["draft", "published", "closed", "expired"];
    public static readonly string[] ApplicationStatuses = ["saved", "applied", "interviewing", "offer", "rejected", "archived"];
}

public static class JobStatuses
{
    public const string Draft = "draft";
    public const string Published = "published";
    public const string Closed = "closed";
    public const string Expired = "expired";
}

public static class ApplicationStatuses
{
    public const string Saved = "saved";
    public const string Applied = "applied";
    public const string Interviewing = "interviewing";
    public const string Offer = "offer";
    public const string Rejected = "rejected";
    public const string Archived = "archived";
}
