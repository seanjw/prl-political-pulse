import { test, expect } from '@playwright/test';

const BASE = 'https://americaspoliticalpulse.com';

// Key data files that must always be available on production.
// These are excluded from S3 --delete during deploys, but we verify they're still there.
const CRITICAL_DOWNLOADS = [
  { path: '/data/all-data.zip', label: 'All survey data' },
  { path: '/data/elite/rhetoric-all.zip', label: 'All rhetoric data' },
  { path: '/data/elite/profiles.zip', label: 'Legislator profiles' },
  { path: '/data/violence/events.csv', label: 'Violence events' },
];

test.describe('Download availability', () => {
  for (const { path, label } of CRITICAL_DOWNLOADS) {
    test(`${label} (${path}) is accessible`, async ({ request }) => {
      const response = await request.head(`${BASE}${path}`);
      expect(response.status(), `${path} should return 200`).toBe(200);
    });
  }

  test('Data page renders all download sections', async ({ page }) => {
    await page.goto('/data');

    // Each data section should be present as a tab
    await expect(page.getByRole('button', { name: 'U.S. Citizens' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'International' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Congressional Rhetoric' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Political Violence' })).toBeVisible();

    // Download buttons should be visible in the default tab
    const downloadButtons = page.locator('a:has-text("Download")');
    const count = await downloadButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
