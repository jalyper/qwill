import { describe, it, expect } from 'vitest';
import { getSchema } from '@tiptap/core';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat } from 'docx';
import { createExtensions, FONT_FAMILIES } from '../editor/extensions';
import { exportDocx } from '../docx/exportDocx';
import { importDocx } from '../docx/importDocx';

const schema = getSchema(createExtensions());
// Normalise through the real schema so defaults and mark order match.
const norm = (json) => schema.nodeFromJSON(json).toJSON();

const PNG_1PX =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const t = (text, ...marks) => ({ type: 'text', text, ...(marks.length ? { marks } : {}) });
const p = (content, attrs) => ({ type: 'paragraph', ...(attrs ? { attrs } : {}), ...(content ? { content } : {}) });
const li = (...content) => ({ type: 'listItem', content });
const cell = (text, attrs = {}, type = 'tableCell') => ({ type, attrs: { colspan: 1, rowspan: 1, colwidth: [150], ...attrs }, content: [p([t(text)])] });

const richDoc = {
    type: 'doc',
    content: [
        { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [t('Quarterly Report')] },
        { type: 'heading', attrs: { level: 2 }, content: [t('Summary')] },
        { type: 'heading', attrs: { level: 3 }, content: [t('Details')] },
        p([
            t('bold', { type: 'bold' }),
            t(' '),
            t('italic', { type: 'italic' }),
            t(' '),
            t('under', { type: 'underline' }),
            t(' '),
            t('strike', { type: 'strike' }),
            t(' '),
            t('both', { type: 'bold' }, { type: 'italic' }),
            t(' E=mc'),
            t('2', { type: 'superscript' }),
            t(' H'),
            t('2', { type: 'subscript' }),
            t('O'),
        ]),
        p([
            t('red', { type: 'textStyle', attrs: { color: '#ff0000' } }),
            t(' big', { type: 'textStyle', attrs: { fontSize: '18pt' } }),
            t(' georgia', { type: 'textStyle', attrs: { fontFamily: FONT_FAMILIES.find((f) => f.name === 'Georgia').value } }),
            t(' marked', { type: 'highlight', attrs: { color: '#ffff00' } }),
            t(' tinted', { type: 'highlight', attrs: { color: '#ffd6e0' } }),
        ]),
        p([t('Visit '), t('the site', { type: 'link', attrs: { href: 'https://example.com/' } }), t(' today.')]),
        p([t('line one'), { type: 'hardBreak' }, t('line two\twith a tab')]),
        p([t('Spaced and indented')], { lineHeight: 1.5, spaceBefore: 6, spaceAfter: 12, indent: 36, firstLine: -18 }),
        p([t('Justified')], { textAlign: 'justify' }),
        p([t('Right')], { textAlign: 'right' }),
        p(),
        {
            type: 'bulletList',
            content: [
                li(p([t('apple')])),
                li(p([t('banana')]), { type: 'bulletList', content: [li(p([t('ripe')])), li(p([t('green')]))] }),
                li(p([t('cherry')]), p([t('a second paragraph in the item')])),
            ],
        },
        {
            type: 'orderedList',
            attrs: { start: 3 },
            content: [li(p([t('third')])), li(p([t('fourth')]), { type: 'orderedList', content: [li(p([t('four-a')]))] })],
        },
        { type: 'blockquote', content: [p([t('To be, or not to be.')]), p([t('That is the question.')])] },
        { type: 'codeBlock', content: [t('const a = 1;\nconst b = 2;')] },
        { type: 'horizontalRule' },
        p([t('Picture: '), { type: 'image', attrs: { src: PNG_1PX, alt: 'a dot', width: 40, height: 40 } }]),
        { type: 'pageBreak' },
        {
            type: 'table',
            content: [
                { type: 'tableRow', content: [cell('Name', {}, 'tableHeader'), cell('Qty', {}, 'tableHeader'), cell('Note', {}, 'tableHeader')] },
                { type: 'tableRow', content: [cell('Wide', { colspan: 2, colwidth: [150, 150] }), cell('Tall', { rowspan: 2 })] },
                { type: 'tableRow', content: [cell('a'), cell('b')] },
            ],
        },
        p([t('The end.')]),
    ],
};

const settings = {
    pageSetup: { paper: 'a4', orientation: 'landscape', margins: { top: 0.75, right: 0.5, bottom: 0.75, left: 0.5 }, pageNumbers: true },
    styles: {
        normal: { font: 'Times New Roman', size: 12, color: null, lineHeight: 1.15, spaceBefore: 0, spaceAfter: 6 },
        headings: { 1: { font: 'Georgia', size: 20, color: '#003366', bold: true, italic: false, spaceBefore: 18, spaceAfter: 6 } },
    },
};

describe('.docx round trip', () => {
    it('every editor construct survives export -> import unchanged', async () => {
        const bytes = await exportDocx(richDoc, settings);
        const back = await importDocx(bytes);
        expect(norm(back.content)).toEqual(norm(richDoc));
        expect(back.warnings).toEqual([]);
    });

    it('page setup and base styles survive', async () => {
        const back = await importDocx(await exportDocx(richDoc, settings));
        expect(back.pageSetup).toMatchObject(settings.pageSetup);
        expect(back.styles.normal).toEqual(settings.styles.normal);
        expect(back.styles.headings[1]).toEqual(settings.styles.headings[1]);
    });

    it('a second round trip is stable', async () => {
        const once = await importDocx(await exportDocx(richDoc, settings));
        const twice = await importDocx(await exportDocx(once.content, once));
        expect(norm(twice.content)).toEqual(norm(once.content));
    });

    it('the formatting the old converter dropped now survives', async () => {
        // The exact probe from the 2026-09-23 audit: alignment, underline,
        // color, size, lists, links, tables and line breaks were all lost.
        const doc = {
            type: 'doc',
            content: [
                p([t('Centered')], { textAlign: 'center' }),
                p([t('under', { type: 'underline' }), t(' red', { type: 'textStyle', attrs: { color: '#ff0000' } }), t(' big', { type: 'textStyle', attrs: { fontSize: '24pt' } })]),
                { type: 'bulletList', content: [li(p([t('one')])), li(p([t('two')]))] },
                p([t('link', { type: 'link', attrs: { href: 'https://x.com' } })]),
                { type: 'table', content: [{ type: 'tableRow', content: [cell('A'), cell('B')] }] },
                p([t('line1'), { type: 'hardBreak' }, t('line2')]),
                p(),
                p([t('after blank')]),
            ],
        };
        const back = await importDocx(await exportDocx(doc));
        expect(norm(back.content)).toEqual(norm(doc));
    });
});

describe('.docx import of Word-authored structure', () => {
    it('reads styles, defaults, numbering and direct formatting', async () => {
        const doc = new Document({
            styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
            numbering: {
                config: [{ reference: 'n', levels: [{ level: 0, format: LevelFormat.UPPER_ROMAN, text: '%1.', alignment: AlignmentType.LEFT }] }],
            },
            sections: [{
                children: [
                    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('The Title')] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'centered bold', bold: true })] }),
                    new Paragraph({ numbering: { reference: 'n', level: 0 }, children: [new TextRun('first')] }),
                    new Paragraph({ numbering: { reference: 'n', level: 0 }, children: [new TextRun('second')] }),
                    new Paragraph({ children: [new TextRun({ text: 'Arial is the base, so no font mark', font: 'Arial' })] }),
                ],
            }],
        });
        const bytes = new Uint8Array(await (await Packer.toBlob(doc)).arrayBuffer());
        const back = await importDocx(bytes);
        const c = back.content.content;
        expect(back.styles.normal.font).toBe('Arial');
        expect(back.styles.normal.size).toBe(12);
        expect(c[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } });
        expect(c[1]).toMatchObject({ type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ text: 'centered bold', marks: [{ type: 'bold' }] }] });
        expect(c[2].type).toBe('orderedList');
        expect(c[2].content).toHaveLength(2);
        expect(c[3].content[0].marks).toBeUndefined();
    });

    it('rejects files that are not .docx with a readable message', async () => {
        await expect(importDocx(new Uint8Array([1, 2, 3]))).rejects.toThrow(/not a valid \.docx/);
    });
});
