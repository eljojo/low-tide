import { test, expect } from '@playwright/test';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';

test.describe('Job Images E2E', () => {
  let dummyServer;
  const dummyPort = 9998;
  const customTitle = `Test Page with Image ${Date.now()}`;
  const tmpDir = 'e2e/tmp';
  const screenshotDir = path.join(tmpDir, 'screenshots');

  // Create a simple test image (1x1 PNG)
  const testImageData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk start
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // image specs
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0x99, 0x01, 0x01, 0x01, 0x00, 0x00,
    0xFE, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
    0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, // IEND chunk
    0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
  ]);

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    dummyServer = createServer((req, res) => {
      if (req.url === '/page-with-image.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html>
          <head>
            <title>${customTitle}</title>
            <meta property="og:title" content="${customTitle}" />
            <meta property="og:image" content="http://127.0.0.1:${dummyPort}/test-image.png" />
          </head>
          <body>This is a test page with an OpenGraph image.</body>
        </html>`);
      } else if (req.url === '/test-image.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(testImageData);
      } else if (req.url === '/page-without-image.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html>
          <head>
            <title>Page Without Image</title>
            <meta property="og:title" content="Page Without Image" />
          </head>
          <body>This page has no image.</body>
        </html>`);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    }).listen(dummyPort);
  });

  test.afterAll(async () => {
    dummyServer.close();
  });

  test('displays job image from OpenGraph metadata', async ({ page }) => {
    page.on('console', msg => {
        if (msg.type() === 'error') console.log(`PAGE ERROR: "${msg.text()}"`);
    });
    page.on('pageerror', err => console.log('PAGE UNHANDLED ERROR:', err.message));

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page).toHaveTitle(/Low Tide/);

    // Disable animations for stable screenshots
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
    await page.evaluate(() => document.fonts.ready);

    // --- 1. Create job with OpenGraph image ---
    const imageUrl = `http://127.0.0.1:${dummyPort}/page-with-image.html`;
    
    await page.waitForSelector('option[value="test-curl"]', { state: 'attached', timeout: 10000 });
    await page.selectOption('select#app', 'test-curl');
    await page.fill('textarea#urls', imageUrl);
    
    const createJobPromise = page.waitForResponse(resp => resp.url().includes('/api/jobs') && resp.request().method() === 'POST');
    await page.click('button:has-text("Queue Job")');
    const createJobResp = await createJobPromise;
    expect(createJobResp.status()).toBe(200);

    // --- 2. Wait for job to complete and metadata to be fetched ---
    const jobItem = page.locator('.lt-job-item', { hasText: customTitle });
    await expect(jobItem).toBeVisible({ timeout: 15000 });
    await expect(jobItem.locator('.lt-pill')).toHaveText('SUCCESS', { timeout: 20000 });

    // Wait a bit more for metadata processing
    await page.waitForTimeout(3000);

    // --- 3. Verify image is displayed in job header ---
    const selectedPane = page.locator('section.lt-card', { hasText: customTitle });
    await expect(selectedPane).toBeVisible();

    // Check that the job image is present and visible in the job header
    const jobHeaderImage = selectedPane.locator('img[alt="' + customTitle + '"]');
    await expect(jobHeaderImage).toBeVisible({ timeout: 10000 });

    // Verify the image source uses the secure job ID endpoint format
    const headerImageSrc = await jobHeaderImage.getAttribute('src');
    expect(headerImageSrc).toMatch(/^\/thumbnails\/\d+\..+\?\d+$/);

    // Wait for image to load (check that it's not hidden due to error)
    await expect(jobHeaderImage).not.toHaveCSS('display', 'none');

    // --- 4. Verify thumbnail is also displayed in job list ---
    const jobListItem = page.locator('.lt-job-item', { hasText: customTitle });
    await expect(jobListItem).toBeVisible();

    // Check for thumbnail in job list (32x32 small thumbnail)
    const jobListThumbnail = jobListItem.locator('img[alt="' + customTitle + '"]');
    await expect(jobListThumbnail).toBeVisible();

    const listThumbnailSrc = await jobListThumbnail.getAttribute('src');
    expect(listThumbnailSrc).toMatch(/^\/thumbnails\/\d+\..+\?\d+$/);

    await page.screenshot({ path: path.join(screenshotDir, '01-job-with-image.png'), fullPage: true });
  });

  test('shows placeholder for job without image', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Disable animations
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

    // --- 1. Create job without OpenGraph image ---
    const noImageUrl = `http://127.0.0.1:${dummyPort}/page-without-image.html`;

    await page.waitForSelector('option[value="test-curl"]', { state: 'attached' });
    await page.selectOption('select#app', 'test-curl');
    await page.fill('textarea#urls', noImageUrl);

    await page.click('button:has-text("Queue Job")');

    // --- 2. Wait for job to complete ---
    const jobItem = page.locator('.lt-job-item', { hasText: 'Page Without Image' });
    await expect(jobItem).toBeVisible({ timeout: 15000 });
    await expect(jobItem.locator('.lt-pill')).toHaveText('SUCCESS', { timeout: 20000 });

    // --- 3. Verify placeholder is shown instead of image in job header ---
    const selectedPane = page.locator('section.lt-card', { hasText: 'Page Without Image' });
    await expect(selectedPane).toBeVisible();

    // Check that the placeholder is present - look for the ImagePlaceholder component
    // We know from the component structure that it should be in the HeaderContent area
    const headerContent = selectedPane.locator('div').first(); // HeaderContent wrapper
    const placeholder = headerContent.locator('div:has-text("No Image")').first();
    await expect(placeholder).toBeVisible();

    // Verify no actual image is present in header
    const jobImage = selectedPane.locator('img[alt="Page Without Image"]');
    await expect(jobImage).not.toBeVisible();

    // --- 4. Verify placeholder is also shown in job list ---
    const jobListItem = page.locator('.lt-job-item', { hasText: 'Page Without Image' });
    await expect(jobListItem).toBeVisible();

    // Job list should have placeholder div but no actual image
    const listImage = jobListItem.locator('img[alt="Page Without Image"]');
    await expect(listImage).not.toBeVisible();

    // Should have placeholder div in the job item
    const listPlaceholder = jobListItem.locator('div').first(); // ThumbnailPlaceholder
    await expect(listPlaceholder).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, '02-job-without-image.png'), fullPage: true });
  });
});
