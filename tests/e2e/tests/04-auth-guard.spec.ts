import { expect, test } from '@playwright/test';
import { b64url, loadState, login, type TestUser } from '../support/helpers';

test.describe('auth guard', () => {
  test('signed-out /konto redirects to login with ?redirect and returns there after login', async ({ page }) => {
    const user = loadState<TestUser>('candidate'); // registered by 03-candidate.spec.ts
    await page.goto('/konto');
    await expect(page).toHaveURL(/\/logowanie\?redirect=%2Fkonto$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Logowanie' })).toBeVisible();

    // Wrong password: a generic message that does not reveal whether the account exists.
    await login(page, { ...user, password: 'Wrong-Passw0rd!' });
    await expect(page.getByRole('alert')).toHaveText('Nieprawidłowy e-mail lub hasło.');

    await login(page, user);
    await expect(page).toHaveURL(/\/konto$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Moje konto' })).toBeVisible();
  });

  test('unknown e-mail gets the same message as a wrong password', async ({ page }) => {
    await page.goto('/logowanie');
    await login(page, { email: `nobody-${Date.now()}@example.com`, password: 'Wrong-Passw0rd!' });
    await expect(page.getByRole('alert')).toHaveText('Nieprawidłowy e-mail lub hasło.');
  });

  test('a forged session cookie (valid payload, future exp, wrong signature) is rejected and cleared', async ({ page, context, baseURL }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const forged = [
      b64url({ alg: 'RS256', typ: 'JWT' }),
      b64url({ sub: 'attacker', iss: 'WorkInPoland', aud: 'WorkInPoland', exp }),
      b64url('not-a-real-signature'),
    ].join('.');
    await context.addCookies([{ name: 'wip_at', value: forged, url: baseURL! }]);

    await page.goto('/konto');
    await expect(page).toHaveURL(/\/logowanie\?redirect=%2Fkonto$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Logowanie' })).toBeVisible();
    await expect.poll(async () => (await context.cookies()).some((c) => c.name === 'wip_at')).toBe(false);
  });

  test('logout really removes both session cookies and closes protected pages', async ({ page, context }) => {
    const user = loadState<TestUser>('candidate');
    await page.goto('/logowanie?redirect=%2Fkonto');
    await login(page, user);
    await expect(page.getByRole('heading', { level: 1, name: 'Moje konto' })).toBeVisible();
    expect((await context.cookies()).map((c) => c.name)).toEqual(expect.arrayContaining(['wip_at', 'wip_rt']));

    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await expect(page.getByRole('link', { name: 'Zaloguj się' })).toBeVisible();
    await expect.poll(async () => (await context.cookies()).filter((c) => c.name === 'wip_at' || c.name === 'wip_rt')).toHaveLength(0);

    await page.goto('/konto');
    await expect(page).toHaveURL(/\/logowanie\?redirect=%2Fkonto$/);
  });

  test('a stale refresh cookie alone cannot open protected pages', async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'wip_rt', value: 'definitely-not-a-valid-refresh-token', url: baseURL! }]);
    await page.goto('/pracodawca');
    await expect(page).toHaveURL(/\/logowanie\?redirect=%2Fpracodawca$/);
    await expect.poll(async () => (await context.cookies()).some((c) => c.name === 'wip_rt')).toBe(false);
  });
});
