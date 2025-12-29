import { test, expect } from '@playwright/test';
import { createServer } from 'http';

test.describe('UI Behavior and Navigation', () => {
  let dummyServer;
  const dummyPort = 9997;

  test.beforeAll(async () => {
    dummyServer = createServer((req, res) => {
      if (req.url === '/fail') {
        res.writeHead(500);
        res.end('Failure');
      } else if (req.url === '/slow') {
        // Don't end the response immediately to simulate running
        res.writeHead(200);
        setTimeout(() => res.end('Done'), 2000);
      } else {
        res.writeHead(200);
        res.end('OK');
      }
    }).listen(dummyPort);
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
  });

  test('1. Job Failure UX - should stay on logs and show retry', async ({ page }) => {
    await page.goto('/');

    // Queue a job that will fail
    await page.selectOption('select#app', 'test-curl');
    await page.fill('textarea#urls', `http://127.0.0.1:1/nonexistent`);

    const createJobPromise = page.waitForResponse(resp => resp.url().includes('/api/jobs') && resp.request().method() === 'POST');
    await page.click('button:has-text("Queue Job")');
    const createJobResp = await createJobPromise;
    const result = await createJobResp.json();
    const jobId = result.ids[0];

    // Should auto-navigate to logs
    await expect(page).toHaveURL(new RegExp(`/job/${jobId}/logs$`));

    // Wait for failure
    const jobItem = page.locator('.lt-job-item', { hasText: 'nonexistent' });
    await expect(jobItem.locator('.lt-pill')).toHaveText('FAILED', { timeout: 15000 });

    // Should STILL be on logs URL
    await expect(page).toHaveURL(new RegExp(`/job/${jobId}/logs$`));

    // Retry button should be visible in the pane
    const selectedPane = page.locator('section.lt-selected-job-pane');
    const retryBtn = selectedPane.locator('button:has-text("Retry")');
    await expect(retryBtn).toBeVisible();
  });

  test('2. Intelligent Log Toggling - JobsList navigation', async ({ page }) => {
    await page.goto('/');

    // Queue a slow job
    await page.selectOption('select#app', 'test-sleep'); // test-sleep is usually slow
    await page.fill('textarea#urls', 'http://example.com/sleep-nav');

    const createJobPromise = page.waitForResponse(resp => resp.url().includes('/api/jobs') && resp.request().method() === 'POST');
    await page.click('button:has-text("Queue Job")');
    const createJobResp = await createJobPromise;
    const result = await createJobResp.json();
    const jobId = result.ids[0];

    // 1. While running, clicking it in the list (or just having it selected) should be /logs
    await expect(page).toHaveURL(new RegExp(`/job/${jobId}/logs$`));

    // Unselect by clicking root or another job (if exists) or just click the item again to unselect
    await page.locator('.lt-job-item', { hasText: 'example.com/sleep-nav' }).click();
    await expect(page).toHaveURL('/');

    // Re-select while running -> should go to /logs
    await page.locator('.lt-job-item', { hasText: 'example.com/sleep-nav' }).click();
    await expect(page).toHaveURL(new RegExp(`/job/${jobId}/logs$`));

    // 2. Wait for it to finish
    await expect(page.locator('.lt-job-item', { hasText: 'example.com/sleep-nav' }).locator('.lt-pill')).toHaveText('SUCCESS', { timeout: 15000 });

    // Unselect
    await page.locator('.lt-job-item', { hasText: 'example.com/sleep-nav' }).click();
    await expect(page).toHaveURL('/');

    // Re-select while finished -> should go to root job URL (collapsed)
    await page.locator('.lt-job-item', { hasText: 'example.com/sleep-nav' }).click();
    await expect(page).toHaveURL(new RegExp(`/job/${jobId}$`));
    await expect(page).not.toHaveURL(new RegExp(`/job/${jobId}/logs$`));
  });

  test('4. Deep Linking and Auto-Selection', async ({ page }) => {
    // 4a. Direct link to a job
    // First we need a job to exist. Let's create one.
    await page.goto('/');
    await page.selectOption('select#app', 'test-curl');
    await page.fill('textarea#urls', 'http://127.0.0.1:9997/ok');
    await page.click('button:has-text("Queue Job")');

    const createJobPromise = page.waitForResponse(resp => resp.url().includes('/api/jobs') && resp.request().method() === 'POST');
    await page.click('button:has-text("Queue Job")'); // Just to be sure we have one
    const createJobResp = await createJobPromise;
    const result = await createJobResp.json();
    const jobId = result.ids[0];

    // Navigate away
    await page.goto('about:blank');

    // Direct link
    await page.goto(`http://127.0.0.1:8081/job/${jobId}`);
    await expect(page.locator('section.lt-selected-job-pane')).toContainText(`Entry #${jobId}`);

    // 4b. Root auto-select running job
    // Queue a very slow job
    await page.goto('/');
    await page.selectOption('select#app', 'test-sleep');
    await page.fill('textarea#urls', 'http://example.com/slow-auto');
    await page.click('button:has-text("Queue Job")');

    // Wait for it to be running
    await expect(page.locator('.lt-job-item', { hasText: 'example.com/slow-auto' }).locator('.lt-pill')).toHaveText('RUNNING', { timeout: 10000 });
    const slowJobId = page.url().match(/\/job\/(\d+)/)[1];

    // Navigate to root
    await page.goto('/');

    // Should auto-redirect to the running job
    await expect(page).toHaveURL(new RegExp(`/job/${slowJobId}/logs$`));
  });

  test('3. Log Streaming and Auto-scroll', async ({ page }) => {
    await page.goto('/');

    // Queue a job that outputs many lines slowly
    await page.selectOption('select#app', 'test-long-output');
    await page.fill('textarea#urls', 'http://example.com/autoscroll-test');
    await page.click('button:has-text("Queue Job")');

    await expect(page).toHaveURL(/\/job\/\d+\/logs$/);
    const terminal = page.locator('.lt-terminal');
    const logView = page.locator('.lt-log-view');
    
    // Wait for initial logs to appear
    await expect(terminal).toContainText('Line 1 of long output', { timeout: 10000 });
    
    // Part 1: Verify auto-scroll when at bottom
    // Ensure we start at the bottom
    await page.evaluate(() => {
      const el = document.querySelector('.lt-log-view');
      el.scrollTop = el.scrollHeight;
    });

    // Wait for more output (Line 20 should appear after some time)
    await expect(terminal).toContainText('Line 20 of long output', { timeout: 5000 });

    // Check that we're still at the bottom (auto-scrolled)
    const isAtBottomAfterNewOutput = await page.evaluate(() => {
      const el = document.querySelector('.lt-log-view');
      return Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 5;
    });
    expect(isAtBottomAfterNewOutput).toBe(true);

    // Part 2: Verify NO auto-scroll when manually scrolled up
    // Scroll to the top
    await page.evaluate(() => {
      const el = document.querySelector('.lt-log-view');
      el.scrollTop = 0;
    });

    // Get the current scroll position
    const scrollTopBeforeNewOutput = await page.evaluate(() => {
      const el = document.querySelector('.lt-log-view');
      return el.scrollTop;
    });

    // Wait for significantly more output (Line 50)
    await expect(terminal).toContainText('Line 50 of long output', { timeout: 5000 });

    // Verify scroll position hasn't changed (stayed at top)
    const scrollTopAfterNewOutput = await page.evaluate(() => {
      const el = document.querySelector('.lt-log-view');
      return el.scrollTop;
    });

    // Should still be at or very close to the same position (accounting for tiny browser variations)
    expect(Math.abs(scrollTopAfterNewOutput - scrollTopBeforeNewOutput)).toBeLessThan(5);

    // Specifically verify we're NOT at the bottom
    const isStillAtTop = await page.evaluate(() => {
      const el = document.querySelector('.lt-log-view');
      return el.scrollTop < 100; // Still near the top
    });
    expect(isStillAtTop).toBe(true);
  });
});
