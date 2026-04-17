const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Take screenshot of Citizens page - Partisan Hatred (default)
  await page.goto('http://localhost:5173/citizens');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'screenshot-hatred.png', fullPage: true });

  // Click on Political Violence tab
  try {
    const violenceTab = page.locator('button:has-text("Political Violence")');
    if (await violenceTab.isVisible({ timeout: 2000 })) {
      await violenceTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshot-violence.png', fullPage: true });
    }
  } catch (e) {
    console.log('Could not click violence tab:', e.message);
  }

  // Click on Democratic Norms tab
  try {
    const normsTab = page.locator('button:has-text("Democratic Norms")');
    if (await normsTab.isVisible({ timeout: 2000 })) {
      await normsTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshot-norms.png', fullPage: true });
    }
  } catch (e) {
    console.log('Could not click norms tab:', e.message);
  }

  await browser.close();
  console.log('Screenshots saved!');
})();
