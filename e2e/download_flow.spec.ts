import { test, expect } from '@playwright/test';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';

test.describe('Low Tide E2E', () => {
  let dummyServer;
  const dummyPort = 9999;
  const dummyUrl = `http://127.0.0.1:${dummyPort}/page.html`;
  const customTitle = `My Awesome Test Page Title ${Date.now()}`;
  const tmpDir = 'e2e/tmp';
  const screenshotDir = path.join(tmpDir, 'screenshots');

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    dummyServer = createServer((req, res) => {
      if (req.url === '/page.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><head><title>${customTitle}</title></head><body>This is a test page.</body></html>`);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    }).listen(dummyPort);
  });

  test.afterAll(async () => {
    dummyServer.close();
  });

  test('full download, archive, and cleanup flow with title generation', async ({ page }) => {
    page.on('console', msg => {
        if (msg.type() === 'error') console.log(`PAGE ERROR: "${msg.text()}"`);
    });
    page.on('pageerror', err => console.log('PAGE UNHANDLED ERROR:', err.message));

    await page.setViewportSize({ width: 1280, height: 400 });

    await page.goto('/');
    await expect(page).toHaveTitle(/Low Tide/);

    // Disable all animations/transitions to ensure screenshots are stable
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          animation-duration: 0s !important;
          animation-delay: 0s !important;
        }
      `
    });
    // Ensure fonts are loaded before taking screenshots
    await page.evaluate(() => document.fonts.ready);

    // Wait for any running jobs from previous tests to finish
    // This prevents the auto-navigation and "don't navigate away from running job" logic from interfering
    const runningJobItem = page.locator('.lt-job-item .lt-pill:has-text("RUNNING")');
    if (await runningJobItem.count() > 0) {
      // Wait for running jobs to complete
      await expect(runningJobItem).toHaveCount(0, { timeout: 15000 });
    }

    // Navigate to root to clear any selection
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // --- 1. Queue Job ---
    await page.waitForSelector('option[value="test-curl"]', { state: 'attached', timeout: 10000 });
    await page.selectOption('select#app', 'test-curl');
    await page.fill('textarea#urls', dummyUrl);

    const createJobPromise = page.waitForResponse(resp => resp.url().includes('/api/jobs') && resp.request().method() === 'POST');

    await page.click('button:has-text("Queue Job")');
    // // Submit the form programmatically to avoid click interception from overlaying panes
    // await page.evaluate(() => {
    //   const form = document.querySelector('form') as HTMLFormElement;
    //   if (form) form.requestSubmit();
    // });

    const createJobResp = await createJobPromise;
    expect(createJobResp.status()).toBe(200);
    const result = await createJobResp.json();
    const jobId = result.ids[0];

    console.log(`Created Job ID: ${jobId}`);

    // --- 1.5. Verify we're seeing the job with the console open after queueing ---
    await expect(page).toHaveURL(new RegExp(`/job/${jobId}/logs$`));

    // --- 2. Wait for job to appear and succeed ---
    const jobItem = page.locator('.lt-job-item', { hasText: customTitle });
    await expect(jobItem).toBeVisible({ timeout: 15000 });

    // Wait for success status
    await expect(jobItem.locator('.lt-pill')).toHaveText('SUCCESS', { timeout: 20000 });
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(screenshotDir, '01-job-success.png'), fullPage: true });

    // --- 3. View Details ---
    const selectedPane = page.locator('section.lt-card', { hasText: customTitle });
    await expect(selectedPane).toBeVisible();

    // Wait for artifacts to appear
    const manifest = selectedPane.locator('.lt-file-manifest');
    await expect(manifest.locator('.lt-file-hero')).toBeVisible({ timeout: 10000 });
    await expect(manifest.locator('div', { hasText: /^testfile\.txt$/ }).first()).toBeVisible();
    await expect(manifest.locator('button:has-text("Download")')).toBeVisible();

    // --- 4. View Logs ---
    const showLogsBtn = selectedPane.getByRole('button', { name: 'SHOW LOGS' });
    if (await showLogsBtn.isVisible()) {
        await showLogsBtn.click();
    }
    await expect(page).toHaveURL(new RegExp(`/job/${jobId}/logs$`));
    await expect(selectedPane.locator('.lt-terminal')).toBeVisible();
    // Wait for logs to fully load
    await page.waitForTimeout(500);
    await expect(selectedPane.locator('.lt-terminal')).toContainText('Job finished: Success', { timeout: 10000 });
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(screenshotDir, '02-logs-visible.png'), fullPage: true });

    // --- 4.5. Unpin and Repin ---
    // Click the job item in the list to unpin (hide details)
    const activeList = page.locator('div.lt-card', { has: page.locator('.lt-label', { hasText: 'Active' }) });
    await jobItem.click();
    await expect(selectedPane).not.toBeVisible();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(screenshotDir, '02b-unpinned.png'), fullPage: true });

    // Click it again to repin (show details)
    await jobItem.click();
    await expect(selectedPane).toBeVisible();
    // Ensure that the console is collapsed (button says "SHOW LOGS") when re-pinned
    await expect(selectedPane.locator('button:has-text("SHOW LOGS")')).toBeVisible();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(screenshotDir, '02c-pinned-collapsed.png'), fullPage: true });

    // --- 5. Archive ---
    await selectedPane.locator('button:has-text("Archive")').click();

    await expect(activeList.locator('.lt-job-item', { hasText: customTitle })).not.toBeVisible();

    // --- 6. View Archived ---
    const expandBtn = activeList.locator('button', { hasText: /^[▸▾]$/ });
    if (await expandBtn.isVisible()) {
        const text = await expandBtn.innerText();
        if (text === '▸') {
            await expandBtn.click();
        }
    }

    const archivedJobItem = page.locator('section >> .lt-job-item', { hasText: customTitle });
    await expect(archivedJobItem).toBeVisible();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(screenshotDir, '03-archived.png'), fullPage: true });

    // --- 7. Cleanup ---
    page.on('dialog', dialog => dialog.accept());

    if (!(await selectedPane.isVisible())) {
        await archivedJobItem.click();
    }

    const cleanupBtn = selectedPane.locator('button:has-text("Cleanup")');
    await expect(cleanupBtn).toBeVisible({ timeout: 10000 });
    await cleanupBtn.click();

    await expect(archivedJobItem.locator('.lt-pill')).toHaveText('CLEANED', { timeout: 10000 });
    await expect(manifest.locator('button:has-text("Download")')).not.toBeVisible();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(screenshotDir, '04-cleaned.png'), fullPage: true });

    // --- 8. Download again (Retry) ---
    const downloadAgainBtn = selectedPane.locator('button:has-text("Download again")');
    await expect(downloadAgainBtn).toBeVisible();
    await downloadAgainBtn.click();

    await expect(activeList.locator('.lt-job-item', { hasText: customTitle })).toBeVisible({ timeout: 10000 });
    await expect(activeList.locator('.lt-job-item', { hasText: customTitle }).locator('.lt-pill')).toHaveText('SUCCESS', { timeout: 20000 });

    await expect(manifest.locator('.lt-file-hero')).toBeVisible();
    await expect(manifest.locator('button:has-text("Download")')).toBeVisible();
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(screenshotDir, '05-retried-success.png'), fullPage: true });

    // --- 9. Reload and Persistence ---
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/job/${jobId}$`));
    await expect(page.locator('section.lt-card', { hasText: customTitle })).toBeVisible();
    // Manifest should be populated after reload (requires fetchJobDetails)
    await expect(page.locator('.lt-file-hero')).toBeVisible({ timeout: 10000 });
  });
});
