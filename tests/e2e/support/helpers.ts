import { expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const STATE_DIR = path.join(__dirname, '..', '.state');
export const PASSWORD = 'E2e-Passw0rd!xK9';

export interface TestUser { email: string; password: string }
export interface PublishedJob { slug: string; title: string; company: string }

export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function newUser(label: string): TestUser {
  return { email: `e2e-${label}-${uniqueSuffix()}@example.com`, password: PASSWORD };
}

export function saveState<T>(name: string, value: T): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(path.join(STATE_DIR, `${name}.json`), JSON.stringify(value));
}

export function loadState<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(STATE_DIR, `${name}.json`), 'utf8')) as T;
}

/** Registers through the real UI and asserts the user lands signed in. */
export async function register(page: Page, user: TestUser): Promise<void> {
  await page.goto('/rejestracja');
  await expect(page.getByRole('heading', { level: 1, name: 'Załóż konto' })).toBeVisible();
  await page.getByLabel('Adres e-mail').fill(user.email);
  await page.getByLabel('Hasło').fill(user.password);
  await page.getByLabel(/Akceptuję regulamin/).check();
  await page.getByLabel(/polityką prywatności/).check();
  const submit = page.getByRole('button', { name: 'Załóż konto' });
  await expect(submit).toBeEnabled(); // enabled once the consent versions arrived from authservice
  await submit.click();
  await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeVisible();
}

export async function login(page: Page, user: TestUser): Promise<void> {
  await page.getByLabel('Adres e-mail').fill(user.email);
  await page.getByLabel('Hasło').fill(user.password);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
}

export function b64url(value: unknown): string {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}
