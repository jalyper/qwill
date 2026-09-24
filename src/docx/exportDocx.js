import {
    AlignmentType,
    BorderStyle,
    Document,
    ExternalHyperlink,
    Footer,
    HeadingLevel,
    ImageRun,
    LevelFormat,
    LineRuleType,
    Packer,
    PageBreak,
    PageNumber,
    PageOrientation,
    Paragraph,
    ShadingType,
    Tab,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';
import { normalizePageSetup, pageSizeIn, PAPER_SIZES, inToTwips } from '../document/pageSetup';
import { normalizeStyles } from '../document/docStyles';
import { decodeDataUrl, highlightName, imageSize, LIST_INDENT, normalizeColor, STYLE_IDS, toPoints } from './shared';

// ProseMirror JSON (see editor/extensions.js) -> .docx bytes.
// Every construct the editor can produce has a mapping here, and
// importDocx.js reads each one back to the same node/mark, so a document
// survives open -> save -> open unchanged (see docxRoundTrip.test.js).

const pt = (v) => Math.round(v * 20); // points -> twips
const halfPt = (v) => Math.round(v * 2);
const hex = (c) => normalizeColor(c)?.slice(1).toUpperCase();
const PX_TO_TWIPS = 15;

const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.BOTH };
const HEADING = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
};

const ORDERED_FORMATS = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];
const BULLETS = ['•', '◦', '▪'];

function listLevels(ordered, start = 1) {
    return Array.from({ length: 9 }, (_, level) => ({
        level,
        format: ordered ? ORDERED_FORMATS[level % 3] : LevelFormat.BULLET,
        text: ordered ? `%${level + 1}.` : BULLETS[level % 3],
        start: level === 0 ? start : 1,
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: LIST_INDENT * (level + 1), hanging: 360 } } },
    }));
}

class Writer {
    constructor(pageSetup, styles) {
        this.page = normalizePageSetup(pageSetup);
        this.styles = normalizeStyles(styles);
        const size = pageSizeIn(this.page);
        this.contentWidthPx = (size.width - this.page.margins.left - this.page.margins.right) * 96;
        this.numbering = new Map(); // reference -> config
        this.instances = 0;
    }

    listReference(ordered, start) {
        const ref = ordered ? `qw-ordered-${start}` : 'qw-bullet';
        if (!this.numbering.has(ref)) this.numbering.set(ref, { reference: ref, levels: listLevels(ordered, start) });
        return ref;
    }

    // ---- inline content -------------------------------------------------

    runOptions(marks = []) {
        const o = {};
        for (const m of marks) {
            const a = m.attrs || {};
            switch (m.type) {
                case 'bold': o.bold = true; break;
                case 'italic': o.italics = true; break;
                case 'underline': o.underline = {}; break;
                case 'strike': o.strike = true; break;
                case 'subscript': o.subScript = true; break;
                case 'superscript': o.superScript = true; break;
                case 'code': o.font = 'Consolas'; break;
                case 'highlight': {
                    const name = highlightName(a.color || '#ffff00');
                    if (name) o.highlight = name;
                    else if (hex(a.color)) o.shading = { type: ShadingType.CLEAR, color: 'auto', fill: hex(a.color) };
                    break;
                }
                case 'textStyle': {
                    if (hex(a.color)) o.color = hex(a.color);
                    const size = toPoints(a.fontSize);
                    if (size) o.size = halfPt(size);
                    if (a.fontFamily) o.font = a.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
                    if (hex(a.backgroundColor) && !o.highlight) {
                        o.shading = { type: ShadingType.CLEAR, color: 'auto', fill: hex(a.backgroundColor) };
                    }
                    break;
                }
                default:
                    break;
            }
        }
        return o;
    }

    textRun(text, marks, extra = {}) {
        const opts = { ...this.runOptions(marks), ...extra };
        if (!text.includes('\t')) return new TextRun({ ...opts, text });
        const children = [];
        text.split('\t').forEach((part, i) => {
            if (i) children.push(new Tab());
            if (part) children.push(part);
        });
        return new TextRun({ ...opts, children });
    }

    imageRun(node) {
        const img = decodeDataUrl(node.attrs?.src);
        if (!img) return new TextRun({ text: node.attrs?.alt ? `[${node.attrs.alt}]` : '' });
        const natural = imageSize(img.bytes) || { width: 300, height: 200 };
        let width = Number(node.attrs.width) || natural.width;
        let height = Number(node.attrs.height) || Math.round((width * natural.height) / natural.width);
        const max = this.contentWidthPx;
        if (width > max) {
            height = Math.round((height * max) / width);
            width = Math.round(max);
        }
        const alt = node.attrs.alt || '';
        return new ImageRun({
            type: img.type,
            data: img.bytes,
            transformation: { width, height },
            altText: { name: alt || 'Picture', description: alt, title: node.attrs.title || '' },
        });
    }

    inlines(content = []) {
        const out = [];
        let link = null; // { href, runs } while inside consecutive linked text
        const flush = () => {
            if (link) out.push(new ExternalHyperlink({ link: link.href, children: link.runs }));
            link = null;
        };
        for (const node of content) {
            const marks = node.marks || [];
            const href = marks.find((m) => m.type === 'link')?.attrs?.href;
            let run;
            // Hyperlink character style gives the blue underline; the run's
            // own marks still apply on top.
            if (node.type === 'text') run = this.textRun(node.text, marks, href ? { style: 'Hyperlink' } : {});
            else if (node.type === 'hardBreak') run = new TextRun({ break: 1 });
            else if (node.type === 'image') run = this.imageRun(node);
            else continue;

            if (href) {
                if (!link || link.href !== href) {
                    flush();
                    link = { href, runs: [] };
                }
                link.runs.push(run);
            } else {
                flush();
                out.push(run);
            }
        }
        flush();
        return out;
    }

    // ---- blocks ---------------------------------------------------------

    paragraphOptions(node) {
        const a = node.attrs || {};
        const o = {};
        if (ALIGN[a.textAlign]) o.alignment = ALIGN[a.textAlign];
        const spacing = {};
        if (a.spaceBefore != null) spacing.before = pt(a.spaceBefore);
        if (a.spaceAfter != null) spacing.after = pt(a.spaceAfter);
        if (a.lineHeight) {
            spacing.line = Math.round(a.lineHeight * 240);
            spacing.lineRule = LineRuleType.AUTO;
        }
        if (Object.keys(spacing).length) o.spacing = spacing;
        const indent = {};
        if (a.indent) indent.left = pt(a.indent);
        if (a.firstLine > 0) indent.firstLine = pt(a.firstLine);
        if (a.firstLine < 0) indent.hanging = pt(-a.firstLine);
        if (Object.keys(indent).length) o.indent = indent;
        return o;
    }

    paragraph(node, extra = {}) {
        const o = this.paragraphOptions(node);
        if (node.type === 'heading') o.heading = HEADING[node.attrs?.level] || HeadingLevel.HEADING_1;
        if (extra.indentLeft) o.indent = { ...(o.indent || {}), left: (o.indent?.left || 0) + extra.indentLeft };
        return new Paragraph({ ...o, ...extra.options, children: this.inlines(node.content) });
    }

    blocks(nodes = [], ctx = {}) {
        const out = [];
        for (const node of nodes) out.push(...this.block(node, ctx));
        return out;
    }

    block(node, ctx) {
        switch (node.type) {
            case 'paragraph':
            case 'heading':
                return [this.paragraph(node, ctx.paragraph || {})];
            case 'bulletList':
            case 'orderedList':
                return this.list(node, ctx);
            case 'blockquote':
                return this.blocks(node.content, {
                    ...ctx,
                    paragraph: { ...(ctx.paragraph || {}), options: { style: STYLE_IDS.quote } },
                });
            case 'codeBlock': {
                const text = (node.content || []).map((t) => t.text || '').join('');
                return text.split('\n').map((line) => new Paragraph({
                    style: STYLE_IDS.code,
                    children: line ? [this.textRun(line, [])] : [],
                }));
            }
            case 'horizontalRule':
                return [new Paragraph({ style: STYLE_IDS.rule, children: [] })];
            case 'pageBreak':
                return [new Paragraph({ children: [new PageBreak()] })];
            case 'table':
                return [this.table(node)];
            default:
                // Unknown block: keep its text rather than dropping it.
                return node.content ? this.blocks(node.content, ctx) : [];
        }
    }

    list(node, ctx) {
        const ordered = node.type === 'orderedList';
        // A nested list of the same kind continues its parent's numbering
        // instance one level deeper; a different kind starts its own.
        const sameKind = ctx.list && ctx.list.ordered === ordered;
        const level = ctx.list ? Math.min(ctx.list.level + 1, 8) : 0;
        const reference = sameKind ? ctx.list.reference : this.listReference(ordered, node.attrs?.start || 1);
        const instance = sameKind ? ctx.list.instance : ++this.instances;
        const listCtx = { ordered, level, instance, reference };
        const out = [];
        for (const item of node.content || []) {
            let first = true;
            for (const child of item.content || []) {
                if (child.type === 'paragraph' || child.type === 'heading') {
                    out.push(first
                        ? this.paragraph(child, { options: { numbering: { reference, level, instance } } })
                        : this.paragraph(child, { indentLeft: LIST_INDENT * (level + 1) }));
                } else {
                    out.push(...this.block(child, { ...ctx, list: listCtx }));
                }
                first = false;
            }
        }
        return out;
    }

    table(node) {
        const rows = node.content || [];
        const firstRow = rows[0]?.content || [];
        const widths = [];
        for (const cell of firstRow) {
            const span = cell.attrs?.colspan || 1;
            for (let i = 0; i < span; i++) widths.push(cell.attrs?.colwidth?.[i] || null);
        }
        const known = widths.filter(Boolean);
        const unknown = widths.length - known.length;
        const fallback = unknown ? (this.contentWidthPx - known.reduce((a, b) => a + b, 0)) / unknown : 0;
        const columnWidths = widths.map((w) => Math.round((w || Math.max(fallback, 24)) * PX_TO_TWIPS));

        const tableRows = rows.map((row) => {
            const cells = row.content || [];
            let col = 0;
            return new TableRow({
                tableHeader: cells.length > 0 && cells.every((c) => c.type === 'tableHeader'),
                children: cells.map((cell) => {
                    const span = cell.attrs?.colspan || 1;
                    const width = columnWidths.slice(col, col + span).reduce((a, b) => a + b, 0);
                    col += span;
                    const children = this.blocks(cell.content);
                    return new TableCell({
                        children: children.length ? children : [new Paragraph({})],
                        columnSpan: span > 1 ? span : undefined,
                        rowSpan: (cell.attrs?.rowspan || 1) > 1 ? cell.attrs.rowspan : undefined,
                        width: width ? { size: width, type: WidthType.DXA } : undefined,
                    });
                }),
            });
        });
        return new Table({
            rows: tableRows,
            columnWidths,
            width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        });
    }

    // ---- document -------------------------------------------------------

    documentStyles() {
        const { normal, headings } = this.styles;
        const run = (s) => ({
            font: s.font,
            size: halfPt(s.size),
            ...(hex(s.color) ? { color: hex(s.color) } : {}),
        });
        const defaults = {
            document: {
                run: run(normal),
                paragraph: {
                    spacing: {
                        before: pt(normal.spaceBefore),
                        after: pt(normal.spaceAfter),
                        line: Math.round(normal.lineHeight * 240),
                        lineRule: LineRuleType.AUTO,
                    },
                },
            },
            hyperlink: { run: { color: '0563C1', underline: {} } },
        };
        for (let level = 1; level <= 6; level++) {
            const h = headings[level];
            defaults[`heading${level}`] = {
                run: { ...run(h), bold: h.bold, italics: h.italic },
                paragraph: { spacing: { before: pt(h.spaceBefore), after: pt(h.spaceAfter) }, keepNext: true, keepLines: true },
            };
        }
        return {
            default: defaults,
            paragraphStyles: [
                {
                    id: STYLE_IDS.quote, name: 'Quote', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                    run: { italics: true, color: '404040' },
                    paragraph: { indent: { left: 864, right: 864 }, spacing: { before: 200, after: 160 } },
                },
                {
                    id: STYLE_IDS.code, name: 'Code', basedOn: 'Normal', next: 'Normal',
                    run: { font: 'Consolas', size: 20 },
                    paragraph: { spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO } },
                },
                {
                    id: STYLE_IDS.rule, name: 'Horizontal Line', basedOn: 'Normal', next: 'Normal',
                    paragraph: {
                        spacing: { before: 120, after: 120 },
                        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'A0A0A0', space: 1 } },
                    },
                },
            ],
        };
    }

    section(children) {
        const p = this.page;
        const base = p.paper === 'custom' ? p.customSize : PAPER_SIZES[p.paper];
        const properties = {
            page: {
                // docx swaps width/height itself for landscape.
                size: {
                    width: inToTwips(Math.min(base.width, base.height)),
                    height: inToTwips(Math.max(base.width, base.height)),
                    orientation: p.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
                },
                margin: {
                    top: inToTwips(p.margins.top),
                    right: inToTwips(p.margins.right),
                    bottom: inToTwips(p.margins.bottom),
                    left: inToTwips(p.margins.left),
                    header: 708,
                    footer: 708,
                },
            },
        };
        const section = { properties, children: children.length ? children : [new Paragraph({})] };
        if (p.pageNumbers) {
            section.footers = {
                default: new Footer({
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT] })] })],
                }),
            };
        }
        return section;
    }
}

/**
 * @param {object} json      ProseMirror doc JSON
 * @param {object} settings  { pageSetup, styles, title }
 * @returns {Promise<Uint8Array>}
 */
export async function exportDocx(json, { pageSetup, styles, title } = {}) {
    const w = new Writer(pageSetup, styles);
    const children = w.blocks(json?.content || []);
    const doc = new Document({
        creator: 'Qwill',
        title: title || undefined,
        styles: w.documentStyles(),
        numbering: { config: [...w.numbering.values()] },
        sections: [w.section(children)],
    });
    const blob = await Packer.toBlob(doc);
    return new Uint8Array(await blob.arrayBuffer());
}
