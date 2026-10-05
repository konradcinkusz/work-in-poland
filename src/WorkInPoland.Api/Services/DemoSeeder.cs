using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using WorkInPoland.Api.Data;
using WorkInPoland.Api.Domain;
using WorkInPoland.Contracts;
using WorkInPoland.ServiceDefaults;

namespace WorkInPoland.Api.Services;

/// <summary>
/// Fictional Polish demo listings (Seed:Demo=true). Insert-if-missing by slug: an existing row is never touched,
/// so operator edits win over this file. Every listing passes the same publish validation as a real one.
/// </summary>
public sealed class DemoSeeder(ApiDbContext db, TimeProvider clock, ILogger<DemoSeeder> logger)
{
    public const string OwnerUserId = "demo-seed";

    private sealed record SeedCompany(string Name, string Website, string City, string Description, string? Nip = null, bool Verified = false);

    private sealed record SeedJob(
        string Company, string Title, string Category, string Seniority, string WorkMode, string? Scope, string? City,
        SalaryOfferDto[] Salaries, string[] Skills, int DaysAgo, string Intro, string[] Requirements, string[] Offer, bool Promoted = false);

    private static SalaryOfferDto B2b(decimal min, decimal max, string currency = "PLN") => new("b2b", min, max, currency, "month", "net");

    private static SalaryOfferDto Uop(decimal min, decimal max) => new("uop", min, max, "PLN", "month", "gross");

    private static readonly SeedCompany[] Companies =
    [
        new("Lipowa Software sp. z o.o.", "https://lipowa-software.example", "Kraków", "Butikowy dom software'owy z Krakowa. Budujemy systemy dla firm z sektora energetycznego i logistycznego.", "1234563218", true),
        new("Bursztyn Logistics Tech S.A.", "https://bursztyn-logistics.example", "Gdańsk", "Platforma do zarządzania flotą i magazynami dla przewoźników znad Bałtyku."),
        new("Kuźnia Kodu sp. z o.o.", "https://kuznia-kodu.example", "Wrocław", "Zespół inżynierów tworzący aplikacje webowe i mobilne dla klientów z całej Europy."),
        new("Syrena Fintech sp. z o.o.", "https://syrena-fintech.example", "Warszawa", "Fintech z Warszawy: płatności, rozliczenia i narzędzia dla księgowych."),
        new("Pracownia Szkło i Piksel sp.j.", "https://szklo-piksel.example", "Poznań", "Studio projektowe: badania użytkowników, UX i systemy designu dla aplikacji biznesowych."),
        new("Orla Perć Labs sp. z o.o.", "https://orla-perc-labs.example", "Kraków", "Laboratorium uczenia maszynowego. Pracujemy zdalnie, spotykamy się w Krakowie raz na kwartał."),
        new("Dolina Danych sp. z o.o.", "https://dolina-danych.example", "Gdańsk", "Hurtownie danych, analityka i raportowanie dla handlu detalicznego."),
    ];

    private static readonly SeedJob[] Jobs =
    [
        new("Lipowa Software sp. z o.o.", "Senior .NET Developer", "backend", "senior", "hybrid", null, "Kraków",
            [B2b(22000, 28000), Uop(18000, 23000)], ["c#", ".net", "postgresql", "docker"], 2,
            "Dołącz do zespołu rozwijającego platformę do rozliczeń energii. Dostajesz realny wpływ na architekturę i kod produkcyjny.",
            ["Min. 5 lat doświadczenia z C# i .NET", "Znajomość PostgreSQL i EF Core", "Doświadczenie z architekturą opartą o API"],
            ["Hybrydowo: 2 dni w tygodniu w biurze w Krakowie", "Budżet szkoleniowy 6000 zł rocznie", "Prywatna opieka medyczna"], Promoted: true),
        new("Lipowa Software sp. z o.o.", "Backend Developer Java", "backend", "mid", "onsite", null, "Kraków",
            [Uop(14000, 18000), B2b(16000, 21000)], ["java", "spring", "kafka", "postgresql"], 5,
            "Szukamy programisty Java do zespołu odpowiedzialnego za integracje z operatorami sieci.",
            ["2-4 lata doświadczenia w Javie", "Spring Boot, REST, SQL", "Dobra komunikacja w zespole"],
            ["Praca w biurze w centrum Krakowa", "Elastyczne godziny", "Karta sportowa"]),
        new("Bursztyn Logistics Tech S.A.", "Senior Frontend Developer (React)", "frontend", "senior", "remote", "poland", null,
            [B2b(20000, 26000), Uop(16000, 21000)], ["react", "typescript", "next.js", "css"], 1,
            "Rozwijasz panel dla dyspozytorów floty: mapy, listy zleceń, powiadomienia w czasie rzeczywistym.",
            ["Min. 5 lat z React i TypeScript", "Testy komponentów i e2e", "Dbałość o dostępność"],
            ["Praca w pełni zdalna z terenu Polski", "Sprzęt do wyboru", "Dodatkowe 26 dni urlopu przy B2B"]),
        new("Bursztyn Logistics Tech S.A.", "DevOps Engineer", "devops", "senior", "remote", "poland", null,
            [B2b(21000, 27000)], ["kubernetes", "terraform", "azure", "github-actions"], 4,
            "Odpowiadasz za platformę uruchomieniową naszych usług: klastry, CI/CD, obserwowalność.",
            ["Kubernetes w produkcji", "Terraform lub Bicep", "Doświadczenie z OpenTelemetry"],
            ["Zdalnie lub z biura w Gdańsku", "Rotacyjny dyżur płatny dodatkowo", "Budżet na certyfikaty"]),
        new("Kuźnia Kodu sp. z o.o.", "Fullstack Developer (.NET + React)", "fullstack", "mid", "hybrid", null, "Wrocław",
            [Uop(13000, 17000), B2b(15000, 20000)], ["c#", "react", "typescript", "sql"], 3,
            "Tworzysz funkcje od bazy danych po interfejs w produktach dla klientów z Niemiec i Skandynawii.",
            ["2-4 lata doświadczenia fullstack", "C# i React", "Samodzielność w prowadzeniu zadań"],
            ["Hybrydowo, biuro na Starym Mieście", "Pakiet relokacyjny dla osób spoza Wrocławia", "Owocowe czwartki"]),
        new("Kuźnia Kodu sp. z o.o.", "Mobile Developer (Kotlin)", "mobile", "mid", "remote", "eu", null,
            [B2b(4000, 5500, "EUR")], ["kotlin", "android", "jetpack-compose"], 6,
            "Rozwijasz aplikację Android dla klienta z sektora zdrowia. Praca w zespole rozproszonym po Europie.",
            ["Kotlin i Jetpack Compose", "Min. 3 lata komercyjnego Androida", "Angielski w mowie i piśmie"],
            ["Zdalnie z dowolnego kraju UE", "Rozliczenie w EUR", "Budżet na sprzęt testowy"]),
        new("Syrena Fintech sp. z o.o.", "Senior Security Engineer", "security", "senior", "onsite", null, "Warszawa",
            [Uop(19000, 25000), B2b(24000, 31000)], ["appsec", "owasp", "azure", "python"], 7,
            "Chronisz platformę płatniczą: przeglądy kodu, testy penetracyjne, reagowanie na incydenty.",
            ["Min. 5 lat w bezpieczeństwie aplikacji", "Znajomość OWASP i modelowania zagrożeń", "Python lub C#"],
            ["Biuro na Woli z parkingiem", "Dodatek za gotowość do incydentów", "Pakiet opieki medycznej"]),
        new("Syrena Fintech sp. z o.o.", "Product Manager", "product", "senior", "hybrid", null, "Warszawa",
            [Uop(17000, 22000), B2b(20000, 26000)], ["roadmapping", "analityka", "sql"], 9,
            "Prowadzisz produkt dla księgowych: od odkrywania problemów po wdrożenie i pomiar efektów.",
            ["Min. 4 lata jako PM", "Praca z danymi (SQL)", "Doświadczenie w produktach B2B"],
            ["Hybrydowo, 3 dni w biurze", "Wpływ na strategię produktu", "Premia roczna"]),
        new("Syrena Fintech sp. z o.o.", "QA Automation Engineer", "qa", "mid", "hybrid", null, "Warszawa",
            [Uop(12000, 16000), B2b(14000, 18500)], ["playwright", "c#", "ci-cd"], 11,
            "Budujesz automatyczne testy end-to-end dla aplikacji webowej i API płatności.",
            ["2-4 lata w automatyzacji testów", "Playwright lub Selenium", "Znajomość CI/CD"],
            ["Hybrydowo", "Szkolenia z testowania", "Elastyczny czas pracy"]),
        new("Pracownia Szkło i Piksel sp.j.", "Junior UX/UI Designer", "design", "junior", "onsite", null, "Poznań",
            [Uop(7000, 9000)], ["figma", "badania-uzytkownikow", "design-system"], 8,
            "Wspierasz zespół projektowy w badaniach, prototypach i pracy nad systemem designu.",
            ["Portfolio z minimum dwoma projektami", "Figma", "Chęć uczenia się od seniorów"],
            ["Mentoring od starszych projektantów", "Biuro w Poznaniu przy Starym Rynku", "Budżet na konferencje"]),
        new("Pracownia Szkło i Piksel sp.j.", "Specjalista ds. wsparcia klienta", "support", "junior", "onsite", null, "Poznań",
            [new SalaryOfferDto("zlecenie", 35, 45, "PLN", "hour", "gross")], ["obsluga-klienta", "zendesk", "angielski"], 12,
            "Odpowiadasz na zapytania klientów aplikacji i pomagasz w ich pierwszej konfiguracji.",
            ["Komunikatywny angielski", "Cierpliwość i empatia", "Podstawy pracy z systemami zgłoszeń"],
            ["Umowa zlecenie, stawka godzinowa", "Zmiany w ustalonych blokach", "Możliwość przejścia na UoP"]),
        new("Orla Perć Labs sp. z o.o.", "Machine Learning Engineer", "ai-ml", "senior", "remote", "worldwide", null,
            [B2b(6000, 8500, "EUR")], ["python", "pytorch", "mlops", "llm"], 2,
            "Trenujesz i wdrażasz modele językowe do zadań ekstrakcji informacji z dokumentów.",
            ["Min. 4 lata w uczeniu maszynowym", "PyTorch, MLOps", "Doświadczenie z modelami językowymi"],
            ["Praca zdalna z dowolnego miejsca", "Rozliczenie w EUR", "Czas na własne badania: 10% tygodnia"]),
        new("Orla Perć Labs sp. z o.o.", "Project Manager (IT)", "project-management", "mid", "hybrid", null, "Kraków",
            [Uop(12000, 15500)], ["scrum", "jira", "zarzadzanie-ryzykiem"], 14,
            "Prowadzisz projekty wdrożeniowe: planowanie, budżet, kontakt z klientem i zespołem inżynierów.",
            ["3 lata jako PM w IT", "Scrum lub Kanban", "Umiejętność negocjacji"],
            ["Hybrydowo", "Certyfikacja PMP lub PSM opłacona przez firmę", "Dodatkowe dni wolne"]),
        new("Dolina Danych sp. z o.o.", "Data Engineer", "data", "senior", "hybrid", null, "Gdańsk",
            [B2b(20000, 26000), Uop(16000, 21000)], ["python", "sql", "dbt", "airflow"], 3,
            "Projektujesz potoki danych i hurtownię dla sieci sklepów: od ingestu po warstwę raportową.",
            ["Min. 4 lata w inżynierii danych", "SQL na poziomie zaawansowanym", "dbt lub Airflow"],
            ["Hybrydowo, biuro we Wrzeszczu", "Budżet na szkolenia", "Karta sportowa"]),
        new("Dolina Danych sp. z o.o.", "Praktykant Analityk Danych", "data", "intern", "onsite", null, "Gdańsk",
            [new SalaryOfferDto("zlecenie", 25, 30, "PLN", "hour", "gross")], ["sql", "excel", "power-bi"], 10,
            "Staż w zespole analityków: raporty sprzedażowe, wizualizacje i pierwsze zadania z SQL.",
            ["Student lub absolwent kierunku ścisłego", "Podstawy SQL", "Chęć nauki"],
            ["Elastyczny wymiar godzin", "Mentor w zespole", "Szansa na etat po stażu"]),
        new("Kuźnia Kodu sp. z o.o.", "Lead Backend Engineer", "backend", "lead", "remote", "poland", null,
            [B2b(28000, 36000), Uop(22000, 28000)], ["c#", "azure", "event-driven", "mentoring"], 1,
            "Prowadzisz zespół pięciu inżynierów i odpowiadasz za kierunek techniczny usług backendowych.",
            ["Min. 8 lat doświadczenia, w tym prowadzenie zespołu", "C# i architektura rozproszona", "Mentoring"],
            ["Praca zdalna z Polski", "Wpływ na rekrutację i budżet zespołu", "Premia kwartalna"]),
    ];

    public async Task<int> SeedAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var companies = new Dictionary<string, Company>();
        foreach (var seed in Companies)
        {
            var slug = Slugs.Slugify(seed.Name, 100);
            var company = await db.Companies.FirstOrDefaultAsync(c => c.Slug == slug, ct);
            if (company is null)
            {
                company = new Company
                {
                    Id = Guid.NewGuid(),
                    Slug = slug,
                    Name = seed.Name,
                    Website = seed.Website,
                    City = seed.City,
                    Description = seed.Description,
                    Nip = seed.Nip,
                    IsVerified = seed.Verified,
                    OwnerUserId = OwnerUserId,
                    CreatedAt = now,
                };
                db.Companies.Add(company);
            }

            companies[seed.Name] = company;
        }

        var added = 0;
        foreach (var seed in Jobs)
        {
            var company = companies[seed.Company];
            var slug = Slugs.Slugify(seed.Title, 60) + "-" + Slugs.Slugify(seed.Company.Replace("sp. z o.o.", string.Empty).Replace("S.A.", string.Empty).Replace("sp.j.", string.Empty), 30)
                + "-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(seed.Title + seed.Company)))[..6].ToLowerInvariant();
            if (await db.Jobs.AnyAsync(j => j.Slug == slug, ct))
            {
                continue;
            }

            var input = Validators.Normalize(new JobInput(
                company.Id, seed.Title, Describe(seed), seed.Category, seed.Seniority, seed.WorkMode, seed.Scope, seed.City,
                seed.Salaries, seed.Skills, company.Website + "/kariera/" + Slugs.Slugify(seed.Title, 60)));
            var errors = new ErrorBag();
            Validators.ValidateJob(input, publish: true, errors);
            errors.ThrowIfAny();

            var published = now.AddDays(-seed.DaysAgo);
            var job = new JobListing
            {
                Id = Guid.NewGuid(),
                Slug = slug,
                Company = company,
                CompanyId = company.Id,
                Status = JobStatuses.Published,
                PublishedAt = published,
                ExpiresAt = now.AddDays(30),
                CreatedAt = published,
                UpdatedAt = published,
                PromotedUntil = seed.Promoted ? now.AddDays(90) : null,
            };
            Mapper.Apply(job, input);
            db.Jobs.Add(job);
            added++;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Demo seed: {Companies} companies known, {Jobs} listing(s) inserted.", companies.Count, added);
        return added;
    }

    private static string Describe(SeedJob job) =>
        $"## O roli\n\n{job.Intro}\n\n## Wymagania\n\n{string.Join('\n', job.Requirements.Select(r => "- " + r))}\n\n## Oferujemy\n\n{string.Join('\n', job.Offer.Select(o => "- " + o))}\n";
}

public sealed class DemoSeedService(IServiceProvider services, IMigrationCompletionSignal signal, ILogger<DemoSeedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await signal.WaitAsync(stoppingToken);
            using var scope = services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<DemoSeeder>().SeedAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // shutting down
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Demo seeding failed; the service keeps running without demo data.");
        }
    }
}
