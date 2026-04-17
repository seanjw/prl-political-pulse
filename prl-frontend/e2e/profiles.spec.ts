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

test.describe('Elite profile pages', () => {
  test('Federal profile loads without crashing (N805)', async ({ page }) => {
    await page.goto('/elites/profile/N805');

    // Wait for the profile content to load
    await expect(page.locator('body')).not.toBeEmpty();

    // The profile page should render meaningful content (not blank/crashed)
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(100);

    // No uncaught JS errors (the null crash we previously fixed)
    const realErrors = consoleErrors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('the server responded with a status of 404')
    );
    expect(realErrors, 'Profile page should have no JS errors').toEqual([]);
  });

  test('Federal profile shows key elements', async ({ page }) => {
    await page.goto('/elites/profile/N805');
    await page.waitForLoadState('networkidle');

    // Should have visible text content — not a blank page
    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible();
  });

  test('Unknown profile ID does not crash', async ({ page }) => {
    // An invalid ID should show an error state, not a white screen / JS crash
    await page.goto('/elites/profile/INVALID999');
    await page.waitForLoadState('networkidle');

    // Page should still render (nav, layout, error message) — not be blank
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);

    // We expect a "not found" console error for invalid IDs — that's fine.
    // What matters is no unhandled exception / white screen.
  });

  test('Profiles list page loads with content', async ({ page }) => {
    await page.goto('/elites/profiles');
    await page.waitForLoadState('networkidle');

    // Should show multiple legislator entries
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(200);
  });
});
