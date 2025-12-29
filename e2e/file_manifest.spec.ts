import { test, expect } from '@playwright/test';
import { createServer } from 'http';

test.describe('File Manifest E2E - Multiple Files', () => {
  let dummyServer;
  const dummyPort = 9998;

  test.beforeAll(async () => {
    dummyServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>Multiple Files Test</body></html>');
    }).listen(dummyPort);
  });

  test.afterAll(async () => {
    dummyServer.close();
  });

  test('should show grid for multiple files', async ({ page }) => {
    await page.goto('/');

    // Multiple Files Test using test-multi app
    await page.waitForSelector('option[value="test-multi"]', { state: 'attached' });
    await page.selectOption('select#app', 'test-multi');
    await page.fill('textarea#urls', `http://127.0.0.1:${dummyPort}/multi.html`); 
    await page.click('button:has-text("Queue Job")');

    // The new job should be at the top and succeed
    const jobItem = page.locator('.lt-job-item').first();
    await expect(jobItem.locator('.lt-pill')).toHaveText('SUCCESS', { timeout: 15000 });

    // Select it to view details (NewJobForm auto-selects, but we make sure)
    const detailsPane = page.locator('.lt-selected-job-pane');

    await expect(detailsPane).toContainText('multi.html', { timeout: 10000 });

    const manifest = detailsPane.locator('.lt-file-manifest');

    // Assert it uses the grid layout instead of the hero layout
    await expect(manifest.locator('.lt-file-grid')).toBeVisible({ timeout: 10000 });
    await expect(manifest.locator('.lt-file-hero')).not.toBeVisible();
    await expect(manifest.locator('button:has-text("Download All")')).toBeVisible();

    // Verify files are listed in the grid
    await expect(manifest.locator('div', { hasText: 'file1.txt' }).first()).toBeVisible();
    await expect(manifest.locator('div', { hasText: 'file2.txt' }).first()).toBeVisible();
  });
});
