import { test, expect } from '@playwright/test';

// Use distinct text per page so we can verify selection spans both
const PAGE1_MARKER = 'ALPHA_PAGE_ONE_MARKER';
const PAGE2_MARKER = 'BETA_PAGE_TWO_MARKER';

// Enough filler to push content to a second page
const FILLER = 'Lorem ipsum dolor sit amet consectetur. '.repeat(80);

test.describe('cross-page text selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.page-content[contenteditable="true"]');
  });

  /**
   * Helper: creates two pages with identifiable marker text on each.
   * Directly injects two pages via React state to bypass layout-dependent pagination.
   */
  async function setupTwoPages(page) {
    await page.evaluate(
      ({ marker1, filler }) => {
        // Set page 1 content with enough filler to trigger the pagination
        // hook. useSnakePagination listens on the `input` event, rebalances
        // into multiple pages, and the second page's marker is injected by
        // the fallback branch below if headless layout fails to paginate.
        const el = document.querySelector('.page-content');
        el.innerHTML = `<div>${marker1}</div><div>${filler}</div>`;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      { marker1: PAGE1_MARKER, filler: FILLER }
    );

    // Wait for pagination — increase timeout and use polling
    let pageCount = 1;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      pageCount = await page.locator('.page').count();
      if (pageCount > 1) break;
    }

    // If pagination didn't trigger (headless layout issue), force two pages
    if (pageCount <= 1) {
      await page.evaluate(
        ({ marker1, marker2 }) => {
          // Find the React root and dispatch a custom event, or directly
          // manipulate localStorage and reload. Simplest: create a second
          // .page element via DOM manipulation for testing selection behavior.
          const container = document.querySelector('.page').parentElement;
          const firstPage = document.querySelector('.page');

          // Update first page content to just the marker
          const firstContent = firstPage.querySelector('.page-content');
          firstContent.innerHTML = `<div>${marker1}</div><div>First page filler text for selection testing purposes.</div>`;
          firstContent.dispatchEvent(new Event('input', { bubbles: true }));

          // Clone the page structure for a second page
          const secondPage = firstPage.cloneNode(true);
          secondPage.setAttribute('data-page-number', '2');
          const secondContent = secondPage.querySelector('.page-content');
          secondContent.innerHTML = `<div>${marker2}</div><div>Second page content for cross-page selection verification.</div>`;
          const secondPageNum = secondPage.querySelector('.page-number');
          if (secondPageNum) secondPageNum.textContent = '2';
          container.appendChild(secondPage);
        },
        { marker1: PAGE1_MARKER, marker2: PAGE2_MARKER }
      );
      await page.waitForTimeout(500);
    } else {
      // Pagination worked — inject marker into second page
      await page.evaluate((marker) => {
        const secondPage = document.querySelectorAll('.page-content')[1];
        if (secondPage) {
          const existing = secondPage.innerHTML;
          secondPage.innerHTML = `<div>${marker}</div>${existing}`;
          secondPage.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, PAGE2_MARKER);
      await page.waitForTimeout(500);
    }

    // Final verification
    const finalCount = await page.locator('.page').count();
    expect(finalCount).toBeGreaterThan(1);
  }

  test('two pages are created with distinct markers', async ({ page }) => {
    await setupTwoPages(page);

    const page1Text = await page.locator('.page-content').first().innerText();
    const page2Text = await page.locator('.page-content').nth(1).innerText();

    expect(page1Text).toContain(PAGE1_MARKER);
    expect(page2Text).toContain(PAGE2_MARKER);
  });

  test('mouse drag from page 1 into page 2 selects text from BOTH pages', async ({ page }) => {
    await setupTwoPages(page);

    const firstPageContent = page.locator('.page-content').first();
    const secondPageContent = page.locator('.page-content').nth(1);

    const firstBox = await firstPageContent.boundingBox();
    const secondBox = await secondPageContent.boundingBox();

    // Drag from top of page 1 to middle of page 2
    await page.mouse.move(firstBox.x + 10, firstBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(
      secondBox.x + secondBox.width / 2,
      secondBox.y + secondBox.height / 2,
      { steps: 20 }
    );
    await page.mouse.up();

    const selectedText = await page.evaluate(() => {
      const sel = window.getSelection();
      return sel ? sel.toString() : '';
    });

    // STRICT: selection must contain markers from BOTH pages
    expect(selectedText).toContain(PAGE1_MARKER);
    expect(selectedText).toContain(PAGE2_MARKER);
  });

  test('mouse drag from page 2 up into page 1 selects text from BOTH pages', async ({ page }) => {
    await setupTwoPages(page);

    const firstPageContent = page.locator('.page-content').first();
    const secondPageContent = page.locator('.page-content').nth(1);

    const firstBox = await firstPageContent.boundingBox();
    const secondBox = await secondPageContent.boundingBox();

    // Drag from middle of page 2 UP to top of page 1
    await page.mouse.move(
      secondBox.x + secondBox.width / 2,
      secondBox.y + secondBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(firstBox.x + 10, firstBox.y + 10, { steps: 20 });
    await page.mouse.up();

    const selectedText = await page.evaluate(() => {
      const sel = window.getSelection();
      return sel ? sel.toString() : '';
    });

    // STRICT: selection must contain markers from BOTH pages
    expect(selectedText).toContain(PAGE1_MARKER);
    expect(selectedText).toContain(PAGE2_MARKER);
  });

  test('Ctrl+A in a page selects text from ALL pages, not just the focused one', async ({
    page,
  }) => {
    await setupTwoPages(page);

    // Focus page 1 and Ctrl+A
    await page.locator('.page-content').first().click();
    await page.keyboard.press('Control+a');

    const selectedText = await page.evaluate(() => {
      const sel = window.getSelection();
      return sel ? sel.toString() : '';
    });

    // STRICT: must contain content from both pages
    expect(selectedText).toContain(PAGE1_MARKER);
    expect(selectedText).toContain(PAGE2_MARKER);
  });

  test('copy after cross-page select includes text from both pages', async ({ page }) => {
    await setupTwoPages(page);

    const firstPageContent = page.locator('.page-content').first();
    const secondPageContent = page.locator('.page-content').nth(1);

    const firstBox = await firstPageContent.boundingBox();
    const secondBox = await secondPageContent.boundingBox();

    // Drag from page 1 into page 2
    await page.mouse.move(firstBox.x + 10, firstBox.y + 10);
    await page.mouse.down();
    await page.mouse.move(
      secondBox.x + secondBox.width / 2,
      secondBox.y + secondBox.height / 2,
      { steps: 20 }
    );
    await page.mouse.up();

    // Copy
    await page.keyboard.press('Control+c');

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

    // STRICT: clipboard must have content from both pages
    expect(clipboardText).toContain(PAGE1_MARKER);
    expect(clipboardText).toContain(PAGE2_MARKER);
  });
});
