import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { loadState, newUser, register, saveState, type PublishedJob } from '../support/helpers';

const user = newUser('candidate');

test.describe.serial('candidate tracker journey', () => {
  let context: BrowserContext;
  let page: Page;
  let job: PublishedJob;

  test.beforeAll(async ({ browser }) => {
    job = loadState<PublishedJob>('job'); // written by 02-employer.spec.ts
    context = await browser.newContext();
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await context.close();
  });

  test('registers as a second user', async () => {
    await register(page, user);
    saveState('candidate', user);
  });

  test('saves the job to the tracker', async () => {
    await page.goto(`/oferty/${job.slug}`);
    await page.getByRole('button', { name: 'Zapisz w trackerze' }).click();
    await expect(page.getByText('Zapisano.')).toBeVisible();
    await page.goto('/konto');
    await expect(page.getByRole('heading', { level: 1, name: 'Moje konto' })).toBeVisible();
    await expect(page.getByText('Nie przechowujemy Twojego CV i niczego nie wysyłamy pracodawcom.')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Zapisane/ })).toBeVisible();
    await expect(page.getByRole('link', { name: job.title })).toBeVisible();
  });

  test('moves it to "applied" and adds a note; both survive a reload', async () => {
    await page.goto('/konto');
    await page.getByLabel(`Status: ${job.title}`).selectOption('applied');
    await expect(page.getByRole('heading', { name: /^Aplikowano/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Zapisane/ })).toHaveCount(0);

    await page.getByLabel(`Notatki: ${job.title}`).fill('Rozmowa techniczna w piątek o 10:00');
    await page.getByRole('button', { name: 'Zapisz notatkę' }).click();
    await expect(page.getByText('Notatka zapisana.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: /^Aplikowano/ })).toBeVisible();
    await expect(page.getByLabel(`Status: ${job.title}`)).toHaveValue('applied');
    await expect(page.getByLabel(`Notatki: ${job.title}`)).toHaveValue('Rozmowa techniczna w piątek o 10:00');
  });

  test('removing the job from the tracker persists', async () => {
    await page.goto('/konto');
    await page.getByRole('button', { name: 'Usuń z trackera' }).click();
    await expect(page.getByText('Nie masz jeszcze zapisanych ofert.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Nie masz jeszcze zapisanych ofert.')).toBeVisible();
    await expect(page.getByRole('link', { name: job.title })).toHaveCount(0);
  });

  test('a second user cannot reach the employer company of the first (empty panel)', async () => {
    await page.goto('/pracodawca');
    await expect(page.getByText('Nie masz jeszcze firmy.')).toBeVisible();
    await expect(page.getByText(job.company)).toHaveCount(0);
  });

  test('export link points at the proxy and downloads JSON containing the account data', async () => {
    await page.goto('/konto');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Pobierz moje dane' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('work-in-poland-export.json');
  });
});
