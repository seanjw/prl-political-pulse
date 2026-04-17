import { test, expect } from '@playwright/test';

test.describe('Search page interactions', () => {
  test('Search form is functional', async ({ page }) => {
    await page.goto('/search');

    // Search input should be visible
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeVisible();

    // Type a search term
    await searchInput.fill('healthcare');

    // Click the search button (use id to avoid matching "Advanced Search")
    await page.locator('#searchButton').click();

    // Wait for results to appear (or loading indicator to finish)
    await page.waitForLoadState('networkidle');

    // Results area should have content
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('healthcare');
  });

  test('Search returns results with statement text', async ({ page }) => {
    await page.goto('/search');

    await page.locator('#searchInput').fill('economy');
    await page.locator('#searchButton').click();

    // Should show result count (e.g. "123 results from 45 legislators")
    await expect(
      page.getByText('results from')
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Export button is visible after search', async ({ page }) => {
    await page.goto('/search');

    await page.locator('#searchInput').fill('immigration');
    await page.locator('#searchButton').click();

    await page.waitForLoadState('networkidle');

    // Export button should become visible once results are loaded
    const exportButton = page.locator('button:has-text("Export"), a:has-text("Export")');
    await expect(exportButton.first()).toBeVisible({ timeout: 15_000 });
  });
});
