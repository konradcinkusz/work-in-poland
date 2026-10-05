import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { newUser, register, saveState, uniqueSuffix, type PublishedJob } from '../support/helpers';

const user = newUser('employer');
const suffix = uniqueSuffix();
const companyName = `E2E Firma ${suffix} sp. z o.o.`;
const jobTitle = `E2E Backend Engineer ${suffix}`;

async function fillJobBasics(page: Page, title: string) {
  await page.getByLabel('Tytuł oferty').fill(title);
  await page.getByLabel('Adres aplikowania (https://…)').fill('https://e2e-firma.example/kariera/backend');
  await page.getByLabel(/Opis \(Markdown/).fill('## Zadania\n\n- budowa API w .NET\n- code review i mentoring\n\nSzukamy osoby, która lubi dobre testy.');
  const skill = page.getByLabel('Dodaj umiejętność (Enter lub przecinek)');
  await skill.fill('e2e-skill');
  await skill.press('Enter');
}

test.describe.serial('employer journey', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await context.close();
  });

  test('registers a unique user and lands signed in', async () => {
    await register(page, user);
    await expect(page.getByRole('link', { name: 'Moje konto' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Zaloguj się' })).toHaveCount(0);
    const names = (await context.cookies()).map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['wip_at', 'wip_rt']));
    const at = (await context.cookies()).find((c) => c.name === 'wip_at');
    expect(at?.httpOnly).toBe(true);
    expect(at?.sameSite).toBe('Strict');
  });

  test('creates a company; a bad NIP is rejected client-side', async () => {
    await page.goto('/pracodawca');
    await expect(page.getByText('Nie masz jeszcze firmy.')).toBeVisible();
    await page.getByRole('button', { name: 'Dodaj firmę' }).click();
    await page.getByLabel('Nazwa firmy').fill(companyName);
    await page.getByLabel('Miasto').fill('Łódź');
    await page.getByLabel(/Strona www/).fill('https://e2e-firma.example');
    await page.getByLabel('Opis firmy (Markdown)').fill('Firma testowa do automatycznych testów.');
    await page.getByLabel('NIP (opcjonalnie)').fill('1234567891');
    await page.getByRole('button', { name: 'Dodaj firmę' }).click();
    await expect(page.getByText('Nieprawidłowy NIP')).toBeVisible();
    await page.getByLabel('NIP (opcjonalnie)').fill('5260250995');
    await page.getByRole('button', { name: 'Dodaj firmę' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: companyName })).toBeVisible();
  });

  test('publishing without a salary shows the Polish field error from the API', async () => {
    await page.goto('/pracodawca/oferty/nowa');
    await expect(page.getByText(/Widełki wynagrodzenia są wymagane — Polska ustawa o jawności wynagrodzeń od 24\.12\.2025/).first()).toBeVisible();
    await fillJobBasics(page, `E2E bez widełek ${suffix}`);
    await page.getByRole('button', { name: 'Opublikuj' }).click();
    await expect(page.getByText('Popraw zaznaczone pola i spróbuj ponownie.')).toBeVisible();
    const salaryError = page.locator('#salaries-err');
    await expect(salaryError).toBeVisible();
    await expect(salaryError).toContainText(/widełk|wynagrodz|zakres|min/i);
    await expect(page).toHaveURL(/\/pracodawca\/oferty\/nowa$/);
  });

  test('creates and publishes a job with B2B and UoP salaries; it shows on /pracodawca', async () => {
    await page.goto('/pracodawca/oferty/nowa');
    await fillJobBasics(page, jobTitle);
    const row1 = page.getByRole('group', { name: 'Widełka 1' });
    await row1.getByRole('spinbutton', { name: 'Od' }).fill('18000');
    await row1.getByRole('spinbutton', { name: 'Do' }).fill('24000');
    await expect(row1.getByLabel('Rodzaj umowy')).toHaveValue('b2b');
    await expect(row1.getByLabel('Brutto / netto')).toHaveValue('net');
    await page.getByRole('button', { name: 'Dodaj widełkę dla innej umowy' }).click();
    const row2 = page.getByRole('group', { name: 'Widełka 2' });
    await expect(row2.getByLabel('Rodzaj umowy')).toHaveValue('uop');
    await expect(row2.getByLabel('Brutto / netto')).toHaveValue('gross');
    await row2.getByRole('spinbutton', { name: 'Od' }).fill('15000');
    await row2.getByRole('spinbutton', { name: 'Do' }).fill('20000');
    // The markdown preview renders live and never as raw HTML.
    await expect(page.getByTestId('description-preview').getByRole('heading', { name: 'Zadania' })).toBeVisible();
    await page.getByRole('button', { name: 'Opublikuj' }).click();

    await expect(page).toHaveURL(/\/pracodawca$/);
    const row = page.getByRole('row').filter({ hasText: jobTitle });
    await expect(row).toContainText('Opublikowana');
    await row.getByRole('link', { name: jobTitle }).click();
    await expect(page.getByRole('heading', { level: 1, name: jobTitle })).toBeVisible();
    await expect(page.getByText(/18\s000 – 24\s000 PLN netto \/ mies\. \(B2B\)/).first()).toBeVisible();
    await expect(page.getByText(/15\s000 – 20\s000 PLN brutto \/ mies\. \(UoP\)/).first()).toBeVisible();
    const slug = new URL(page.url()).pathname.split('/').pop()!;
    saveState<PublishedJob>('job', { slug, title: jobTitle, company: companyName });
  });

  test('an anonymous browser sees the job in public search', async ({ browser }) => {
    const anon = await browser.newContext();
    const p = await anon.newPage();
    await p.goto(`/?q=${encodeURIComponent(jobTitle)}`);
    const card = p.getByRole('article').filter({ hasText: jobTitle });
    await expect(card).toBeVisible();
    await expect(card).toContainText(companyName);
    await expect(card).toContainText(/18\s000 – 24\s000 PLN netto/);
    await anon.close();
  });
});
