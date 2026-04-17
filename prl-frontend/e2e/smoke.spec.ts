import { test, expect } from '@playwright/test';

// Collect console errors during each test
let consoleErrors: string[];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
});

test.afterEach(async () => {
  // Filter out known benign errors (e.g. third-party script failures, favicon 404s)
  const realErrors = consoleErrors.filter(
    (e) => !e.includes('favicon') && !e.includes('the server responded with a status of 404')
  );
  expect(realErrors, 'Page should have no JS console errors').toEqual([]);
});

test.describe('Smoke tests — all major pages load', () => {
  test('Home page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('Citizens dashboard', async ({ page }) => {
    await page.goto('/citizens');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('Violence dashboard', async ({ page }) => {
    await page.goto('/violence');
    await expect(page.locator('body')).not.toBeEmpty();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('Search page', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('input#searchInput, input[placeholder*="search" i]')).toBeVisible();
  });

  test('Data / downloads page', async ({ page }) => {
    await page.goto('/data');
    await expect(page.getByRole('heading', { name: 'Open Data' })).toBeVisible();
    // Should have download links
    const downloadLinks = page.locator('a[href$=".zip"], a[href$=".csv"]');
    await expect(downloadLinks.first()).toBeVisible();
  });

  test('About page', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('Elites landing', async ({ page }) => {
    await page.goto('/elites');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('Elites profiles list', async ({ page }) => {
    await page.goto('/elites/profiles');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('Primary landing', async ({ page }) => {
    await page.goto('/primary');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('Reports page', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
