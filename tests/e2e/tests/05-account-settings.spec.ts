import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { register, login, newUser, type TestUser } from '../support/helpers';

test.describe.serial('Account settings (2FA, password change, profile)', () => {
  let context: BrowserContext;
  let page: Page;
  let user: TestUser;

  test.beforeAll(async ({ browser }) => {
    user = newUser('account-settings');
    context = await browser.newContext();
    page = await context.newPage();

    // Register the user
    await register(page, user);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('navigates to account settings page', async () => {
    await page.goto('/konto/ustawienia');
    await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia konta' })).toBeVisible();
    await expect(page.getByText('Zarządzaj bezpieczeństwem i ustawieniami swojego konta.')).toBeVisible();
  });

  test('shows password section for password account', async () => {
    await page.goto('/konto/ustawienia');
    await expect(page.getByRole('heading', { level: 2, name: 'Hasło' })).toBeVisible();
    await expect(page.getByLabel('Bieżące hasło')).toBeVisible();
  });

  test('shows 2FA section', async () => {
    await page.goto('/konto/ustawienia');
    await expect(page.getByRole('heading', { level: 2, name: 'Weryfikacja dwuetapowa' })).toBeVisible();
    // Initially should show setup option
    await expect(page.getByText(/Aby włączyć weryfikację dwuetapową/)).toBeVisible();
  });

  test('shows profile section', async () => {
    await page.goto('/konto/ustawienia');
    await expect(page.getByRole('heading', { level: 2, name: 'Profil' })).toBeVisible();
    await expect(page.getByLabel('Nazwa użytkownika')).toBeVisible();
  });

  test('changes password successfully', async () => {
    const newPassword = 'NewPassword456!';

    await page.goto('/konto/ustawienia');
    await page.getByLabel('Bieżące hasło').fill(user.password);
    await page.getByLabel('Nowe hasło').fill(newPassword);
    await page.getByLabel('Potwierdź nowe hasło').fill(newPassword);

    await page.getByRole('button', { name: 'Zmień hasło' }).click();

    // Verify success message appears
    await expect(page.getByText('Hasło zmienione pomyślnie')).toBeVisible();

    // Update the user password for subsequent tests
    user.password = newPassword;

    // Verify user is still logged in (page is still accessible)
    await expect(page.getByRole('heading', { level: 1, name: 'Ustawienia konta' })).toBeVisible();
  });

  test('can login with new password after change', async () => {
    // Logout first
    await page.goto('/konto');
    await page.getByRole('button', { name: 'Wyloguj' }).click();

    // Verify logged out
    await expect(page.getByRole('link', { name: 'Zaloguj się' })).toBeVisible();

    // Login with new password
    await page.goto('/logowanie');
    await login(page, user);

    // Verify logged in
    await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeVisible();
  });

  test('updates profile username', async () => {
    const newUsername = `testuser_${Date.now()}`;

    await page.goto('/konto/ustawienia');
    await page.getByLabel('Nazwa użytkownika').fill(newUsername);
    await page.getByRole('button', { name: 'Aktualizuj profil' }).click();

    // Verify success message
    await expect(page.getByText('Profil zaktualizowany pomyślnie')).toBeVisible();
  });

  test('displays validation error for invalid username', async () => {
    await page.goto('/konto/ustawienia');

    // Try invalid username (special characters)
    await page.getByLabel('Nazwa użytkownika').fill('invalid@user#');
    await page.getByRole('button', { name: 'Aktualizuj profil' }).click();

    // Should show error message (client-side validation)
    await expect(page.getByText(/może zawierać tylko litery, cyfry, łączniki/)).toBeVisible();
  });

  test('2FA section shows start button when disabled', async () => {
    await page.goto('/konto/ustawienia');
    const twoFactorSection = page.locator('section:has(h2:text("Weryfikacja dwuetapowa"))');
    await expect(twoFactorSection.getByText(/Aby włączyć weryfikację dwuetapową/)).toBeVisible();
  });

  test('password validation requires confirmation', async () => {
    await page.goto('/konto/ustawienia');

    // Fill mismatched passwords
    await page.getByLabel('Bieżące hasło').fill(user.password);
    await page.getByLabel('Nowe hasło').fill('Test123456!');
    await page.getByLabel('Potwierdź nowe hasło').fill('DifferentPassword456!');

    await page.getByRole('button', { name: 'Zmień hasło' }).click();

    // Should show error about mismatch
    await expect(page.getByText(/się nie zgadzają/)).toBeVisible();
  });
});
