import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Concurrency and Navigation', () => {
  test('should not navigate to new job if current job is still running', async ({ page }) => {
    await page.goto('/');

    // 1. Queue a long running job
    await page.selectOption('select#app', 'test-sleep');
    await page.fill('textarea#urls', 'http://example.com/sleep1');

    const firstJobPromise = page.waitForResponse(resp => resp.url().includes('/api/jobs') && resp.request().method() === 'POST');
    await page.click('button:has-text("Queue Job")');
    const firstJobResp = await firstJobPromise;
    const firstJobResult = await firstJobResp.json();
    const firstJobId = firstJobResult.ids[0];

    // Verify we are on the first job
    await expect(page).toHaveURL(new RegExp(`/job/${firstJobId}/logs`));
    // The job item text might be the URL initially
    const firstJobItem = page.locator('.lt-job-item', { hasText: 'example.com/sleep1' }).first();
    await expect(firstJobItem.locator('.lt-pill')).toHaveText('RUNNING', { timeout: 10000 });

    // 2. Queue a second job while the first is running
    await page.selectOption('select#app', 'test-sleep');
    await page.fill('textarea#urls', 'http://example.com/sleep2');

    const secondJobPromise = page.waitForResponse(resp => resp.url().includes('/api/jobs') && resp.request().method() === 'POST');
    await page.click('button:has-text("Queue Job")');
    const secondJobResp = await secondJobPromise;
    const secondJobResult = await secondJobResp.json();
    const secondJobId = secondJobResult.ids[0];

    // We should still be on the first job because it's still running
    await expect(page).toHaveURL(new RegExp(`/job/${firstJobId}/logs`));

    // 3. Wait for first job to finish
    await expect(firstJobItem.locator('.lt-pill')).toHaveText('SUCCESS', { timeout: 10000 });

    // After it finishes, it should move to the next one
    await expect(page).toHaveURL(new RegExp(`/job/${secondJobId}/logs`), { timeout: 15000 });
  });
});
