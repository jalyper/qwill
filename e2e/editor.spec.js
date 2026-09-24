import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';

// These run against the Vite dev server in Chromium (the browser build of
// Qwill: localStorage drafts, file input / download instead of native
// dialogs). The editing core is identical to the desktop app.

const PARA = 'The quick brown fox jumps over the lazy dog while the committee deliberates about the budget. ';
const doc = (page) => page.locator('.ProseMirror');

async function typeParagraphs(page, count) {
    await doc(page).click();
    await page.evaluate(
        async ({ count, para }) => {
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            for (let i = 0; i < count; i++) {
                for (const chunk of `P${i} ${para.repeat(4)}`.match(/.{1,40}/g)) {
                    document.execCommand('insertText', false, chunk);
                }
                document.execCommand('insertParagraph');
                if (i % 5 === 4) await wait(20);
            }
        },
        { count, para: PARA },
    );
    await page.waitForTimeout(400);
}

const paragraphIds = (text) => [...text.matchAll(/P(\d+) /g)].map((m) => Number(m[1]));

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/');
    await expect(doc(page)).toBeVisible();
});

test('typing across many pages never loses or reorders text', async ({ page }) => {
    await typeParagraphs(page, 40);
    // Push text across every page boundary by inserting at the very top.
    await page.keyboard.press('Control+Home');
    for (let i = 0; i < 20; i++) await page.keyboard.type('INSERTED ');
    await page.waitForTimeout(300);

    const text = await doc(page).innerText();
    const ids = paragraphIds(text);
    expect(new Set(ids).size).toBe(40);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(text.match(/INSERTED/g)).toHaveLength(20);
    expect(await page.locator('.qw-page').count()).toBeGreaterThanOrEqual(4);
    await expect(page.locator('.qw-status')).toContainText(/of [4-9]/);
});

test('every line sits inside a page, and paragraphs split across pages', async ({ page }) => {
    await typeParagraphs(page, 30);
    const report = await page.evaluate(() => {
        const pages = document.querySelector('.qw-pages');
        const cs = getComputedStyle(pages);
        const h = parseFloat(cs.getPropertyValue('--page-h'));
        const mt = parseFloat(cs.getPropertyValue('--page-mt'));
        const mb = parseFloat(cs.getPropertyValue('--page-mb'));
        const stride = h + 24;
        const base = pages.getBoundingClientRect().top;
        const range = document.createRange();
        const walker = document.createTreeWalker(document.querySelector('.ProseMirror'), NodeFilter.SHOW_TEXT);
        let outside = 0;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            range.selectNodeContents(n);
            for (const r of range.getClientRects()) {
                const y = r.top - base;
                const page = Math.floor(y / stride);
                // Glyph boxes may poke a couple of px above the line box.
                if (y < page * stride + mt - 4 || r.bottom - base > page * stride + h - mb + 1) outside++;
            }
        }
        const splitInsideParagraph = [...document.querySelectorAll('.qw-page-spacer')].some((s) => s.parentElement.tagName === 'P');
        return { outside, splitInsideParagraph };
    });
    expect(report.outside).toBe(0);
    expect(report.splitInsideParagraph).toBe(true);
});

test('selection and copy span pages', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await typeParagraphs(page, 25);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(new Set(paragraphIds(copied)).size).toBe(25);

    // Mouse drag from page 1 into page 2 (both on screen).
    await page.setViewportSize({ width: 1400, height: 2600 });
    await page.locator('.qw-main').evaluate((el) => el.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const pages = page.locator('.qw-page');
    const p1 = await pages.nth(0).boundingBox();
    const p2 = await pages.nth(1).boundingBox();
    await page.mouse.move(p1.x + 97, p1.y + 104);
    await page.mouse.down();
    await page.mouse.move(p2.x + 300, p2.y + 200, { steps: 25 });
    await page.mouse.up();
    const ids = paragraphIds(await page.evaluate(() => getSelection().toString()));
    const lastOnPage1 = await page.evaluate(() => {
        const spacer = document.querySelector('.qw-page-spacer');
        const before = spacer.parentElement.tagName === 'P' ? spacer.parentElement : spacer.previousElementSibling;
        return Number(before.textContent.match(/P(\d+) /)[1]);
    });
    expect(ids[0]).toBe(0);
    expect(Math.max(...ids)).toBeGreaterThan(lastOnPage1);
});

test('unsaved work survives a reload', async ({ page }) => {
    await doc(page).click();
    await page.keyboard.type('Remember me across reloads.');
    await expect(page.locator('.qw-tab-dirty')).toBeVisible();
    await page.waitForTimeout(900); // draft write delay
    await page.reload();
    await expect(doc(page)).toContainText('Remember me across reloads.');
    await expect(page.locator('.qw-tab-dirty')).toBeVisible();
});

test('opens a .docx with its formatting and saves it back', async ({ page }, testInfo) => {
    const source = new Document({
        styles: { default: { document: { run: { font: 'Georgia', size: 24 } } } },
        sections: [{
            children: [
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Imported heading')] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'centered and red', color: 'FF0000' })] }),
                new Paragraph({ children: [new TextRun({ text: 'underlined', underline: {} })] }),
            ],
        }],
    });
    const path = testInfo.outputPath('source.docx');
    writeFileSync(path, await Packer.toBuffer(source));

    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Control+o');
    await (await chooser).setFiles(path);

    await expect(page.locator('.qw-tab.is-active')).toContainText('source');
    await expect(doc(page).locator('h1')).toHaveText('Imported heading');
    const centered = doc(page).locator('p', { hasText: 'centered and red' });
    await expect(centered).toHaveCSS('text-align', 'center');
    await expect(centered.locator('span')).toHaveCSS('color', 'rgb(255, 0, 0)');
    await expect(doc(page).locator('u')).toHaveText('underlined');
    await expect(doc(page)).toHaveCSS('font-family', /Georgia/);

    await doc(page).locator('p', { hasText: 'underlined' }).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' plus an edit');

    const download = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    const saved = await (await download).path();
    const bytes = [...readFileSync(saved)];
    const reopened = await page.evaluate(async (data) => {
        const { importDocx } = await import('/src/docx/importDocx.js');
        return (await importDocx(new Uint8Array(data))).content;
    }, bytes);
    const json = JSON.stringify(reopened);
    expect(json).toContain('underlined plus an edit');
    expect(json).toContain('"textAlign":"center"');
    expect(json).toContain('"color":"#ff0000"');
});

test('find and replace works across pages', async ({ page }) => {
    await typeParagraphs(page, 30);
    await page.keyboard.press('Control+h');
    await page.getByLabel('Find', { exact: true }).fill('committee');
    await expect(page.locator('.qw-find-count')).toHaveText('1 of 120');
    await page.getByLabel('Replace with').fill('panel');
    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.locator('.qw-find-count')).toHaveText('No results');
    const text = await doc(page).innerText();
    expect(text.match(/panel/g)).toHaveLength(120);
    expect(new Set(paragraphIds(text)).size).toBe(30);
});

test('page setup changes the page and repaginates', async ({ page }) => {
    await typeParagraphs(page, 20);
    const portraitPages = await page.locator('.qw-page').count();
    await page.getByRole('button', { name: 'File' }).click();
    await page.getByRole('menuitem', { name: 'Page setup…' }).click();
    await page.getByLabel('Orientation').selectOption('landscape');
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('.qw-page').first()).toHaveCSS('width', '1056px');
    await expect(page.locator('.qw-page').first()).toHaveCSS('height', '816px');

    // Smaller paper must need more pages.
    await page.getByRole('button', { name: 'File' }).click();
    await page.getByRole('menuitem', { name: 'Page setup…' }).click();
    await page.getByLabel('Paper size').selectOption('a5');
    await page.getByLabel('Orientation').selectOption('portrait');
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('.qw-page').first()).toHaveCSS('width', /^559.6/);
    await expect.poll(() => page.locator('.qw-page').count()).toBeGreaterThan(portraitPages);
});

test('documents from the old Qwill are migrated', async ({ page }) => {
    await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('qwill-file-list', JSON.stringify([{ id: 'old1', name: 'My old essay', lastModified: 1, preview: '' }]));
        localStorage.setItem('qwill-content-old1', '<div><b>Legacy</b> text from before the rebuild</div>');
    });
    await page.reload();
    await expect(page.locator('.qw-tab')).toContainText('My old essay');
    await expect(doc(page).locator('strong')).toHaveText('Legacy');
});

test('closing a document with changes asks first', async ({ page }) => {
    await doc(page).click();
    await page.keyboard.type('Unsaved words');
    await page.getByRole('button', { name: /Close Untitled 1/ }).click();
    await expect(page.getByRole('dialog')).toContainText('Save changes to “Untitled 1”?');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(doc(page)).toContainText('Unsaved words');
    await page.getByRole('button', { name: /Close Untitled 1/ }).click();
    await page.getByRole('button', { name: 'Don’t save' }).click();
    await expect(doc(page)).not.toContainText('Unsaved words');
});
