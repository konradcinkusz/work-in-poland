import { expect, test } from '@playwright/test';

// Seed data comes from the API's demo seeder (Seed__Demo=true).

test.describe('anonymous visitor', () => {
  test('home lists jobs with salary ranges per contract type', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('widełkami wynagrodzenia');
    const card = page.getByRole('article').filter({ hasText: 'Senior .NET Developer' });
    await expect(card).toBeVisible();
    await expect(card).toContainText(/22\s000 – 28\s000 PLN netto \/ mies\. \(B2B\)/);
    await expect(card).toContainText(/18\s000 – 23\s000 PLN brutto \/ mies\. \(UoP\)/);
    await expect(card).toContainText('Zweryfikowana firma');
    await expect(card).toContainText('Promowane');
    await expect(page.getByRole('list', { name: 'Statystyki serwisu' }).or(page.getByLabel('Statystyki serwisu'))).toBeVisible();
  });

  test('searching by keyword narrows the results and keeps the filter in the URL', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Senior .NET Developer' })).toBeVisible();
    await page.getByLabel('Stanowisko, firma lub technologia').fill('Playwright');
    await page.getByRole('button', { name: 'Szukaj' }).click();
    await expect(page).toHaveURL(/[?&]q=Playwright/);
    await expect(page.getByRole('link', { name: 'QA Automation Engineer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Senior .NET Developer' })).toHaveCount(0);
  });

  test('a minimum salary narrows the results', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Senior .NET Developer' })).toBeVisible();
    await page.getByLabel(/Minimalne wynagrodzenie/).fill('30000');
    await page.getByRole('button', { name: 'Szukaj' }).click();
    await expect(page).toHaveURL(/salaryMin=30000/);
    await expect(page.getByRole('link', { name: 'Lead Backend Engineer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Senior .NET Developer' })).toHaveCount(0);
  });

  test('a search with no match shows the empty state', async ({ page }) => {
    await page.goto('/?q=zzz-nie-ma-takiej-oferty');
    await expect(page.getByText('Brak ofert spełniających kryteria.')).toBeVisible();
    await page.getByRole('link', { name: 'Wyczyść filtry' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('job page: JSON-LD JobPosting with baseSalary, and apply redirects to the https applyUrl', async ({ page, request }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Senior .NET Developer' }).click();
    await expect(page).toHaveURL(/\/oferty\/senior-net-developer/);
    await expect(page.getByRole('heading', { level: 1, name: 'Senior .NET Developer' })).toBeVisible();

    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const ld = JSON.parse(raw ?? '{}') as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(ld['@type']).toBe('JobPosting');
    expect(ld.title).toBe('Senior .NET Developer');
    expect(ld.baseSalary.value.minValue).toBe(22000);
    expect(ld.baseSalary.value.unitText).toBe('MONTH');
    expect(ld.hiringOrganization.name).toContain('Lipowa Software');
    expect(ld.jobLocation.address.addressCountry).toBe('PL');
    expect(ld.employmentType).toEqual(expect.arrayContaining(['CONTRACTOR', 'FULL_TIME']));

    const href = await page.getByRole('link', { name: 'Aplikuj u pracodawcy' }).getAttribute('href');
    expect(href).toMatch(/^\/oferty\/.+\/aplikuj$/);
    const res = await request.get(href!, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers().location).toMatch(/^https:\/\/lipowa-software\.example\/kariera\//);
  });

  test('saving a job while signed out sends you to login and back', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Senior .NET Developer' }).click();
    const slugPath = new URL(page.url()).pathname;
    await page.getByRole('button', { name: 'Zapisz w trackerze' }).click();
    await expect(page).toHaveURL(new RegExp(`/logowanie\\?redirect=${encodeURIComponent(slugPath)}`));
  });

  test('unknown job slug is a Polish 404', async ({ page }) => {
    const res = await page.goto('/oferty/nie-ma-takiej-oferty-000000');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Nie znaleziono strony' })).toBeVisible();
  });

  test('salary benchmark shows a median for a populated combination', async ({ page }) => {
    await page.goto('/wynagrodzenia');
    await page.getByLabel('Rodzaj umowy').selectOption('b2b');
    await page.getByRole('button', { name: 'Pokaż benchmark' }).click();
    await expect(page).toHaveURL(/contractType=b2b/);
    await expect(page.getByText(/^Mediana: \d/)).toBeVisible();
    await expect(page.getByRole('img', { name: /minimum .*mediana .*maksimum/ })).toBeVisible();
    await expect(page.getByText('Za mało danych')).toHaveCount(0);
  });

  test('salary benchmark shows "za mało danych" for an empty combination', async ({ page }) => {
    await page.goto('/wynagrodzenia?contractType=dzielo&currency=PLN');
    await expect(page.getByText('Za mało danych (min. 3 oferty)')).toBeVisible();
    await expect(page.getByText(/^Mediana: \d/)).toHaveCount(0);
  });

  test('MCP page builds the endpoint URLs from runtime config', async ({ page }) => {
    await page.goto('/mcp');
    await expect(page.getByRole('heading', { level: 1, name: 'Asystenci AI' })).toBeVisible();
    await expect(page.getByTestId('mcp-open-url')).toHaveText(/\/mcp$/);
    await expect(page.getByTestId('mcp-account-url')).toHaveText(/\/mcp\/account$/);
    await expect(page.getByText(/claude mcp add --transport http work-in-poland /).first()).toBeVisible();
  });

  test('infrastructure routes answer', async ({ request }) => {
    const health = await request.get('/healthz');
    expect(health.status()).toBe(200);
    expect((await health.json()).status).toBe('ok');
    const config = await request.get('/api/config');
    expect(Object.keys(await config.json()).sort()).toEqual(['publicApiUrl', 'siteUrl']);
    const sitemap = await request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain('/oferty/senior-net-developer');
    expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:');
  });

  test('legal drafts carry the warning banner and a version', async ({ page }) => {
    for (const path of ['/regulamin', '/polityka-prywatnosci', '/cookies']) {
      await page.goto(path);
      await expect(page.getByRole('note')).toContainText('Wersja robocza — wymaga weryfikacji przez prawnika');
      await expect(page.getByTestId('doc-version')).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
