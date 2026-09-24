import JSZip from 'jszip';
import { DEFAULT_STYLES } from '../document/docStyles';
import { paperFromSize, twipsToIn, DEFAULT_PAGE_SETUP } from '../document/pageSetup';
import { familyToCss } from '../editor/extensions';
import { bytesToBase64, EMU_PER_PX, HIGHLIGHT_COLORS, LIST_INDENT, mimeForExt, normalizeColor, STYLE_IDS } from './shared';

// .docx bytes -> { content: ProseMirror JSON, pageSetup, styles, warnings }.
//
// Word formatting is inherited: document defaults -> Normal -> paragraph
// style chain -> character style chain -> direct formatting. We resolve the
// full chain, then express whatever differs from the document's base style
// (see docStyles.js) as node attributes / marks. That keeps the editor's
// JSON small while the page looks the way it did in Word.
//
// Anything Qwill cannot represent yet is reported in `warnings` instead of
// vanishing silently.

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// ---- tiny XML helpers (by localName, so prefixes don't matter) ----------

const kids = (el, name) => (el ? Array.from(el.children).filter((c) => c.localName === name) : []);
const kid = (el, name) => (el ? Array.from(el.children).find((c) => c.localName === name) || null : null);
const find = (el, name) => {
    if (!el) return null;
    const stack = [...el.children];
    while (stack.length) {
        const n = stack.shift();
        if (n.localName === name) return n;
        stack.unshift(...n.children);
    }
    return null;
};
const attr = (el, name) => {
    if (!el) return null;
    for (const a of el.attributes) if (a.localName === name) return a.value;
    return null;
};
const val = (el) => attr(el, 'val');
const rid = (el, name = 'id') => (el ? el.getAttributeNS(R_NS, name) || attr(el, name) : null);
const onOff = (el) => {
    if (!el) return undefined;
    const v = val(el);
    return !(v === '0' || v === 'false' || v === 'off' || v === 'none');
};
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const round2 = (n) => Math.round(n * 100) / 100;

async function readXml(zip, path) {
    const file = zip.file(path);
    return file ? new DOMParser().parseFromString(await file.async('text'), 'application/xml') : null;
}

function resolvePath(dir, target) {
    if (target.startsWith('/')) return target.slice(1);
    const out = [];
    for (const p of (dir + target).split('/')) {
        if (p === '..') out.pop();
        else if (p !== '.' && p !== '') out.push(p);
    }
    return out.join('/');
}

async function readRels(zip, partPath) {
    const cut = partPath.lastIndexOf('/') + 1;
    const dir = partPath.slice(0, cut);
    const xml = await readXml(zip, `${dir}_rels/${partPath.slice(cut)}.rels`);
    const rels = new Map();
    if (!xml) return rels;
    for (const r of xml.documentElement.children) {
        const target = r.getAttribute('Target');
        const external = r.getAttribute('TargetMode') === 'External';
        rels.set(r.getAttribute('Id'), {
            type: r.getAttribute('Type') || '',
            target: external ? target : resolvePath(dir, target),
            external,
        });
    }
    return rels;
}

// ---- property readers ---------------------------------------------------

function readRunProps(rPr, theme) {
    const p = {};
    if (!rPr) return p;
    const b = onOff(kid(rPr, 'b'));
    if (b !== undefined) p.bold = b;
    const i = onOff(kid(rPr, 'i'));
    if (i !== undefined) p.italic = i;
    const u = kid(rPr, 'u');
    if (u) p.underline = val(u) !== 'none' && val(u) !== '0';
    const strike = onOff(kid(rPr, 'strike')) ?? onOff(kid(rPr, 'dstrike'));
    if (strike !== undefined) p.strike = strike;
    const color = kid(rPr, 'color');
    if (color && val(color)) p.color = normalizeColor(val(color)); // 'auto' -> null
    const sz = num(val(kid(rPr, 'sz')));
    if (sz) p.size = sz / 2;
    const fonts = kid(rPr, 'rFonts');
    if (fonts) {
        const themeRef = attr(fonts, 'asciiTheme') || attr(fonts, 'hAnsiTheme');
        const name = attr(fonts, 'ascii') || attr(fonts, 'hAnsi') || (themeRef ? (themeRef.startsWith('major') ? theme.major : theme.minor) : null);
        if (name) p.font = name;
    }
    const hl = val(kid(rPr, 'highlight'));
    if (hl && hl !== 'none') p.highlight = HIGHLIGHT_COLORS[hl] || null;
    const shd = kid(rPr, 'shd');
    const fill = shd && attr(shd, 'fill');
    if (fill && fill !== 'auto') p.shading = normalizeColor(fill);
    const va = val(kid(rPr, 'vertAlign'));
    if (va) p.vertAlign = va; // superscript | subscript | baseline
    const rStyle = val(kid(rPr, 'rStyle'));
    if (rStyle) p.rStyle = rStyle;
    return p;
}

function readParaProps(pPr) {
    const p = {};
    if (!pPr) return p;
    const style = val(kid(pPr, 'pStyle'));
    if (style) p.styleId = style;
    const jc = val(kid(pPr, 'jc'));
    if (jc) p.align = { both: 'justify', distribute: 'justify', start: 'left', end: 'right' }[jc] || jc;
    const sp = kid(pPr, 'spacing');
    if (sp) {
        const before = num(attr(sp, 'before'));
        const after = num(attr(sp, 'after'));
        const line = num(attr(sp, 'line'));
        const rule = attr(sp, 'lineRule') || 'auto';
        if (before != null && attr(sp, 'beforeAutospacing') !== '1') p.spaceBefore = before / 20;
        if (after != null && attr(sp, 'afterAutospacing') !== '1') p.spaceAfter = after / 20;
        if (line != null && rule === 'auto') p.lineHeight = round2(line / 240);
    }
    const ind = kid(pPr, 'ind');
    if (ind) {
        const left = num(attr(ind, 'left') ?? attr(ind, 'start'));
        if (left != null) p.indent = left / 20;
        const first = num(attr(ind, 'firstLine'));
        const hanging = num(attr(ind, 'hanging'));
        if (hanging) p.firstLine = -hanging / 20;
        else if (first != null) p.firstLine = first / 20;
    }
    const numPr = kid(pPr, 'numPr');
    if (numPr) {
        p.numId = val(kid(numPr, 'numId'));
        p.ilvl = num(val(kid(numPr, 'ilvl'))) || 0;
    }
    if (onOff(kid(pPr, 'pageBreakBefore'))) p.pageBreakBefore = true;
    const outline = num(val(kid(pPr, 'outlineLvl')));
    if (outline != null) p.outlineLvl = outline;
    const bottom = kid(kid(pPr, 'pBdr'), 'bottom');
    if (bottom && val(bottom) !== 'nil' && val(bottom) !== 'none') p.borderBottom = true;
    return p;
}

const merge = (...objs) =>
    Object.assign({}, ...objs.map((o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined))));

// ---- reader -------------------------------------------------------------

class Reader {
    constructor(zip) {
        this.zip = zip;
        this.warnings = new Set();
        this.styleCache = new Map();
    }

    async load() {
        const zip = this.zip;
        const docPath = (await this.mainDocumentPath()) || 'word/document.xml';
        this.doc = await readXml(zip, docPath);
        if (!this.doc) throw new Error('This file is not a Word document (word/document.xml is missing).');
        this.rels = await readRels(zip, docPath);
        const relOfType = (suffix) => [...this.rels.values()].find((r) => r.type.endsWith(suffix));

        this.theme = { minor: 'Calibri', major: 'Calibri Light' };
        const themeRel = relOfType('/theme');
        const themeXml = themeRel && (await readXml(zip, themeRel.target));
        if (themeXml) {
            const minor = attr(find(find(themeXml.documentElement, 'minorFont'), 'latin'), 'typeface');
            const major = attr(find(find(themeXml.documentElement, 'majorFont'), 'latin'), 'typeface');
            if (minor) this.theme.minor = minor;
            if (major) this.theme.major = major;
        }

        const stylesRel = relOfType('/styles');
        this.loadStyles(stylesRel && (await readXml(zip, stylesRel.target)));
        const numberingRel = relOfType('/numbering');
        this.loadNumbering(numberingRel && (await readXml(zip, numberingRel.target)));
        this.headerFooters = new Map();
        for (const [id, r] of this.rels) {
            if (r.type.endsWith('/footer') || r.type.endsWith('/header')) {
                const f = zip.file(r.target);
                if (f) this.headerFooters.set(id, await f.async('text'));
            }
        }
        const commentsRel = relOfType('/comments');
        const comments = commentsRel && (await readXml(zip, commentsRel.target));
        if (comments && kids(comments.documentElement, 'comment').length) {
            this.warnings.add('Comments are not shown or saved yet.');
        }
    }

    async mainDocumentPath() {
        const rels = await readXml(this.zip, '_rels/.rels');
        if (!rels) return null;
        for (const r of rels.documentElement.children) {
            if (r.getAttribute('Type')?.endsWith('/officeDocument')) return r.getAttribute('Target').replace(/^\//, '');
        }
        return null;
    }

    loadStyles(xml) {
        this.styles = new Map();
        this.defaultParaStyle = null;
        this.docDefaults = { rPr: {}, pPr: {} };
        if (!xml) return;
        const root = xml.documentElement;
        const dd = kid(root, 'docDefaults');
        if (dd) {
            this.docDefaults.rPr = readRunProps(kid(kid(dd, 'rPrDefault'), 'rPr'), this.theme);
            this.docDefaults.pPr = readParaProps(kid(kid(dd, 'pPrDefault'), 'pPr'));
        }
        for (const s of kids(root, 'style')) {
            const id = attr(s, 'styleId');
            const type = attr(s, 'type');
            this.styles.set(id, {
                id,
                type,
                name: (val(kid(s, 'name')) || id || '').toLowerCase(),
                basedOn: val(kid(s, 'basedOn')),
                pPr: readParaProps(kid(s, 'pPr')),
                rPr: readRunProps(kid(s, 'rPr'), this.theme),
            });
            if (type === 'paragraph' && attr(s, 'default') === '1') this.defaultParaStyle = id;
        }
    }

    /** Style props with the basedOn chain applied (base first). */
    resolveStyle(id, depth = 0) {
        if (!id || !this.styles.has(id) || depth > 20) return { pPr: {}, rPr: {}, name: '' };
        if (this.styleCache.has(id)) return this.styleCache.get(id);
        const s = this.styles.get(id);
        const base = this.resolveStyle(s.basedOn, depth + 1);
        const out = { pPr: merge(base.pPr, s.pPr, { styleId: undefined }), rPr: merge(base.rPr, s.rPr), name: s.name };
        delete out.pPr.styleId;
        this.styleCache.set(id, out);
        return out;
    }

    /** Effective props of a paragraph style, including document defaults. */
    paragraphStyle(id) {
        const s = this.resolveStyle(id && this.styles.has(id) ? id : this.defaultParaStyle);
        return { pPr: merge(this.docDefaults.pPr, s.pPr), rPr: merge(this.docDefaults.rPr, s.rPr), name: s.name || '' };
    }

    loadNumbering(xml) {
        this.abstracts = new Map();
        this.nums = new Map();
        if (!xml) return;
        const root = xml.documentElement;
        for (const a of kids(root, 'abstractNum')) {
            const levels = {};
            for (const l of kids(a, 'lvl')) {
                levels[num(attr(l, 'ilvl')) || 0] = {
                    format: val(kid(l, 'numFmt')) || 'decimal',
                    start: num(val(kid(l, 'start'))) ?? 1,
                };
            }
            this.abstracts.set(attr(a, 'abstractNumId'), levels);
        }
        for (const n of kids(root, 'num')) {
            const overrides = {};
            for (const o of kids(n, 'lvlOverride')) {
                const start = num(val(kid(o, 'startOverride')));
                if (start != null) overrides[num(attr(o, 'ilvl')) || 0] = start;
            }
            this.nums.set(attr(n, 'numId'), { abstractId: val(kid(n, 'abstractNumId')), overrides });
        }
    }

    listInfo(numId, ilvl) {
        const n = this.nums.get(numId);
        const lvl = (n && this.abstracts.get(n.abstractId)?.[ilvl]) || { format: 'bullet', start: 1 };
        return {
            ordered: lvl.format !== 'bullet' && lvl.format !== 'none',
            start: n?.overrides[ilvl] ?? lvl.start ?? 1,
        };
    }

    // ---- document-level settings ---------------------------------------

    headingStyleId(level) {
        for (const [id, s] of this.styles) {
            if (s.type === 'paragraph' && (s.name === `heading ${level}` || id === `Heading${level}`)) return id;
        }
        return null;
    }

    headingLevel(styleId, props) {
        const s = styleId && this.styles.get(styleId);
        if (!s) return null;
        const m = s.name.match(/^heading ([1-6])$/) || styleId.match(/^Heading([1-6])$/);
        if (m) return Number(m[1]);
        if (s.name === 'title') return 1;
        if (props.outlineLvl != null && props.outlineLvl < 6) return props.outlineLvl + 1;
        return null;
    }

    baseStyles() {
        const normal = this.paragraphStyle(null);
        const styles = {
            normal: {
                font: normal.rPr.font || 'Calibri',
                size: normal.rPr.size || 10, // Word's built-in default
                color: normal.rPr.color || null,
                lineHeight: normal.pPr.lineHeight || 1,
                spaceBefore: normal.pPr.spaceBefore || 0,
                spaceAfter: normal.pPr.spaceAfter || 0,
            },
            headings: {},
        };
        this.headingBase = {};
        for (let level = 1; level <= 6; level++) {
            const id = this.headingStyleId(level);
            if (!id) {
                styles.headings[level] = { ...DEFAULT_STYLES.headings[level] };
                const d = styles.headings[level];
                this.headingBase[level] = {
                    pPr: { spaceBefore: d.spaceBefore, spaceAfter: d.spaceAfter },
                    rPr: { font: d.font, size: d.size, color: d.color, bold: d.bold, italic: d.italic },
                };
                continue;
            }
            const h = this.paragraphStyle(id);
            this.headingBase[level] = h;
            styles.headings[level] = {
                font: h.rPr.font || styles.normal.font,
                size: h.rPr.size || styles.normal.size,
                color: h.rPr.color || null,
                bold: !!h.rPr.bold,
                italic: !!h.rPr.italic,
                spaceBefore: h.pPr.spaceBefore ?? 0,
                spaceAfter: h.pPr.spaceAfter ?? 0,
            };
        }
        return styles;
    }

    pageSetup(body) {
        const sect = kid(body, 'sectPr');
        const setup = { ...DEFAULT_PAGE_SETUP, margins: { ...DEFAULT_PAGE_SETUP.margins }, pageNumbers: false };
        if (!sect) return setup;
        const sz = kid(sect, 'pgSz');
        const w = num(attr(sz, 'w'));
        const h = num(attr(sz, 'h'));
        if (w && h) Object.assign(setup, paperFromSize(twipsToIn(w), twipsToIn(h)));
        const mar = kid(sect, 'pgMar');
        if (mar) {
            for (const k of ['top', 'right', 'bottom', 'left']) {
                const v = num(attr(mar, k));
                if (v != null) setup.margins[k] = round2(twipsToIn(Math.abs(v)));
            }
        }
        let otherContent = false;
        for (const ref of [...kids(sect, 'footerReference'), ...kids(sect, 'headerReference')]) {
            const xml = this.headerFooters.get(rid(ref));
            if (!xml) continue;
            if (/\bPAGE\b/.test(xml)) setup.pageNumbers = true;
            // Anything beyond a bare page number is not shown yet.
            const text = xml.replace(/<w:instrText[^>]*>.*?<\/w:instrText>/g, '').replace(/<[^>]+>/g, '').replace(/\d+/g, '').trim();
            if (text) otherContent = true;
        }
        if (otherContent) this.warnings.add('Header and footer text is not shown or saved yet (page numbers are).');
        return setup;
    }

    // ---- body -----------------------------------------------------------

    /** Flatten block-level elements into a stream of items, then group. */
    blocks(container) {
        const items = [];
        const visit = (el) => {
            for (const child of el.children) {
                switch (child.localName) {
                    case 'p':
                        items.push(...this.paragraphItems(child));
                        break;
                    case 'tbl':
                        items.push({ block: this.table(child) });
                        break;
                    case 'sdt':
                        visit(kid(child, 'sdtContent') || child);
                        break;
                    case 'customXml':
                    case 'ins':
                    case 'moveTo':
                        visit(child);
                        break;
                    default:
                        break;
                }
            }
        };
        visit(container);
        return this.group(items);
    }

    paragraphItems(p) {
        const direct = readParaProps(kid(p, 'pPr'));
        const style = this.paragraphStyle(direct.styleId);
        const eff = merge(style.pPr, direct);
        const level = this.headingLevel(direct.styleId, eff);
        const isCode = direct.styleId === STYLE_IDS.code || /^(code|html preformatted|plain text)$/.test(style.name);
        const isQuote = !isCode && /quote/.test(style.name);
        // Styles that become their own node (heading, quote, code) are that
        // node's look, so compare against the style, not Normal.
        const base = level ? this.headingBase[level] : isQuote || isCode ? style : this.paragraphStyle(null);

        const attrs = {};
        // Alignment is never part of our base styles, so any non-left
        // alignment (even one that came from a paragraph style) is explicit.
        if (eff.align && eff.align !== 'left') attrs.textAlign = eff.align;
        for (const k of ['lineHeight', 'spaceBefore', 'spaceAfter']) {
            if (eff[k] != null && eff[k] !== base.pPr[k]) attrs[k] = eff[k];
        }
        const numbered = eff.numId && eff.numId !== '0' && this.nums.has(eff.numId);
        // List indentation comes from the list level; keep indents only on
        // ordinary paragraphs.
        if (!numbered) {
            if (eff.indent && eff.indent !== (base.pPr.indent || 0)) attrs.indent = eff.indent;
            if (eff.firstLine && eff.firstLine !== (base.pPr.firstLine || 0)) attrs.firstLine = eff.firstLine;
        }

        const segments = this.inlineSegments(p, style.rPr, base.rPr);
        const type = level ? 'heading' : 'paragraph';
        const nodeAttrs = level ? { ...attrs, level } : attrs;
        const out = [];
        if (eff.pageBreakBefore) out.push({ block: { type: 'pageBreak' } });

        const isRule = direct.styleId === STYLE_IDS.rule || (eff.borderBottom && segments.every((s) => !s.length));
        segments.forEach((content, i) => {
            if (i > 0) out.push({ block: { type: 'pageBreak' } });
            // Empty pieces around a page break are the break itself.
            if (segments.length > 1 && !content.length && (i === 0 || i === segments.length - 1)) return;
            if (isRule) {
                out.push({ block: { type: 'horizontalRule' } });
                return;
            }
            const node = { type, ...(Object.keys(nodeAttrs).length ? { attrs: nodeAttrs } : {}), ...(content.length ? { content } : {}) };
            if (numbered) {
                out.push({ li: { numId: eff.numId, ilvl: eff.ilvl || 0, ...this.listInfo(eff.numId, eff.ilvl || 0) }, block: node });
            } else if (isCode) {
                out.push({ code: content.map((c) => (c.type === 'text' ? c.text : '\n')).join('') });
            } else if (isQuote) {
                out.push({ quote: node });
            } else {
                out.push({ block: node, indent: eff.indent || 0 });
            }
        });
        return out;
    }

    /** Inline content of a paragraph, split at page breaks. */
    inlineSegments(p, styleRPr, baseRPr) {
        const segments = [[]];
        const push = (node) => {
            const seg = segments[segments.length - 1];
            const prev = seg[seg.length - 1];
            if (node.type === 'text' && prev?.type === 'text' && JSON.stringify(prev.marks || []) === JSON.stringify(node.marks || [])) {
                prev.text += node.text;
            } else {
                seg.push(node);
            }
        };
        const breakPage = () => segments.push([]);

        const walk = (el, link) => {
            for (const child of el.children) {
                switch (child.localName) {
                    case 'r':
                        this.run(child, styleRPr, baseRPr, link, push, breakPage);
                        break;
                    case 'hyperlink': {
                        const rel = rid(child) && this.rels.get(rid(child));
                        const anchor = attr(child, 'anchor');
                        walk(child, rel?.target || (anchor ? `#${anchor}` : link));
                        break;
                    }
                    case 'ins':
                    case 'moveTo':
                    case 'smartTag':
                    case 'customXml':
                    case 'fldSimple':
                    case 'bdo':
                    case 'dir':
                        walk(child, link);
                        break;
                    case 'sdt':
                        walk(kid(child, 'sdtContent') || child, link);
                        break;
                    case 'del':
                    case 'moveFrom':
                        this.warnings.add('Tracked changes were accepted when opening.');
                        break;
                    default:
                        break;
                }
            }
        };
        walk(p, null);
        return segments;
    }

    run(r, styleRPr, baseRPr, link, push, breakPage) {
        const direct = readRunProps(kid(r, 'rPr'), this.theme);
        let charStyle = direct.rStyle ? this.resolveStyle(direct.rStyle).rPr : {};
        // Inside a hyperlink the link style's blue underline is implied by
        // the link itself, so only direct color/underline count.
        if (link) charStyle = { ...charStyle, color: undefined, underline: undefined };
        const marks = this.marks(merge(styleRPr, charStyle, direct), baseRPr, link);
        const text = (t) => push({ type: 'text', text: t, ...(marks.length ? { marks } : {}) });

        for (const c of r.children) {
            switch (c.localName) {
                case 't':
                    if (c.textContent) text(c.textContent);
                    break;
                case 'tab':
                case 'ptab':
                    text('\t');
                    break;
                case 'noBreakHyphen':
                    text('‑');
                    break;
                case 'sym': {
                    const code = parseInt(attr(c, 'char') || '', 16);
                    if (code) text(String.fromCodePoint(code >= 0xf000 ? code - 0xf000 : code));
                    break;
                }
                case 'br':
                    if (attr(c, 'type') === 'page') breakPage();
                    else if (attr(c, 'type') !== 'column') push({ type: 'hardBreak' });
                    break;
                case 'cr':
                    push({ type: 'hardBreak' });
                    break;
                case 'drawing':
                case 'pict':
                case 'object': {
                    const img = this.image(c);
                    if (img) push(link ? { ...img, marks: [{ type: 'link', attrs: { href: link } }] } : img);
                    break;
                }
                case 'footnoteReference':
                case 'endnoteReference':
                    this.warnings.add('Footnotes and endnotes are not shown or saved yet.');
                    break;
                default:
                    break;
            }
        }
    }

    marks(eff, base, link) {
        const marks = [];
        if (eff.bold && !base.bold) marks.push({ type: 'bold' });
        if (eff.italic && !base.italic) marks.push({ type: 'italic' });
        if (eff.underline && !base.underline) marks.push({ type: 'underline' });
        if (eff.strike) marks.push({ type: 'strike' });
        if (eff.vertAlign === 'superscript') marks.push({ type: 'superscript' });
        if (eff.vertAlign === 'subscript') marks.push({ type: 'subscript' });
        const hl = eff.highlight || eff.shading;
        if (hl) marks.push({ type: 'highlight', attrs: { color: hl } });
        const ts = {};
        if (eff.color && eff.color !== (base.color || null)) ts.color = eff.color;
        if (eff.size && eff.size !== base.size) ts.fontSize = `${eff.size}pt`;
        if (eff.font && eff.font !== base.font) ts.fontFamily = familyToCss(eff.font);
        if (Object.keys(ts).length) marks.push({ type: 'textStyle', attrs: ts });
        if (link) marks.push({ type: 'link', attrs: { href: link } });
        return marks;
    }

    image(el) {
        const blip = find(el, 'blip');
        const imagedata = find(el, 'imagedata');
        const embed = blip ? rid(blip, 'embed') : rid(imagedata);
        const rel = embed && this.rels.get(embed);
        if (!rel || rel.external) {
            if (blip || imagedata) this.warnings.add('Linked (external) images were skipped.');
            return null;
        }
        const ext = rel.target.split('.').pop();
        const mime = mimeForExt(ext);
        const file = this.zip.file(rel.target);
        if (!mime || !file) {
            this.warnings.add(`Some images (${ext.toUpperCase()}) are in a format Qwill cannot show yet and were skipped.`);
            return null;
        }
        const extent = find(el, 'extent');
        const docPr = find(el, 'docPr');
        const attrs = { src: null, alt: attr(docPr, 'descr') || null };
        if (extent) {
            attrs.width = Math.round(num(attr(extent, 'cx')) / EMU_PER_PX);
            attrs.height = Math.round(num(attr(extent, 'cy')) / EMU_PER_PX);
        }
        if (find(el, 'anchor')) this.warnings.add('Floating images were placed in line with the text.');
        return { type: 'image', attrs, _file: file, _mime: mime };
    }

    table(tbl) {
        const grid = kids(kid(tbl, 'tblGrid'), 'gridCol').map((g) => Math.round((num(attr(g, 'w')) || 0) / 15));
        const rows = [];
        const origins = []; // grid column -> cell a vertical merge started in
        for (const tr of kids(tbl, 'tr')) {
            const trPr = kid(tr, 'trPr');
            const header = !!onOff(kid(trPr, 'tblHeader'));
            const cells = [];
            let col = num(val(kid(trPr, 'gridBefore'))) || 0;
            for (const tc of kids(tr, 'tc')) {
                const tcPr = kid(tc, 'tcPr');
                const span = num(val(kid(tcPr, 'gridSpan'))) || 1;
                const vMerge = kid(tcPr, 'vMerge');
                const mergeVal = vMerge ? val(vMerge) || 'continue' : null;
                if (mergeVal === 'continue' && origins[col]) {
                    origins[col].attrs.rowspan += 1;
                    col += span;
                    continue;
                }
                const content = this.blocks(tc);
                const widths = grid.slice(col, col + span);
                const cell = {
                    type: header ? 'tableHeader' : 'tableCell',
                    attrs: { colspan: span, rowspan: 1, colwidth: widths.length === span && widths.every(Boolean) ? widths : null },
                    content: content.length ? content : [{ type: 'paragraph' }],
                };
                for (let c = col; c < col + span; c++) origins[c] = mergeVal === 'restart' ? cell : null;
                cells.push(cell);
                col += span;
            }
            if (cells.length) rows.push({ type: 'tableRow', content: cells });
        }
        return rows.length ? { type: 'table', content: rows } : { type: 'paragraph' };
    }

    /** Turn the item stream into nested lists, quotes and code blocks. */
    group(items) {
        const out = [];
        let stack = []; // open lists, outermost first: { node, ilvl, ordered, numId }
        let quote = null;
        let code = null;
        const lastItem = () => {
            const top = stack[stack.length - 1];
            return top?.node.content[top.node.content.length - 1];
        };

        for (const item of items) {
            if (!item.quote) quote = null;
            if (item.code === undefined) code = null;

            if (item.li) {
                const { ilvl, ordered, start, numId } = item.li;
                while (stack.length && stack[stack.length - 1].ilvl > ilvl) stack.pop();
                let top = stack[stack.length - 1];
                // Same level but a different list (other numbering, or bullets
                // vs numbers): close it and start a sibling list.
                if (top && top.ilvl === ilvl && (top.ordered !== ordered || (stack.length === 1 && top.numId !== numId))) {
                    stack.pop();
                    top = stack[stack.length - 1];
                }
                if (!top || top.ilvl < ilvl) {
                    const list = { type: ordered ? 'orderedList' : 'bulletList', content: [] };
                    if (ordered && start !== 1) list.attrs = { start };
                    const parent = lastItem();
                    if (parent) parent.content.push(list);
                    else out.push(list);
                    top = { node: list, ilvl, ordered, numId };
                    stack.push(top);
                }
                top.node.content.push({ type: 'listItem', content: [item.block] });
                continue;
            }

            // An indented plain paragraph right after a list item continues it.
            if (item.block?.type === 'paragraph' && stack.length && item.indent >= LIST_INDENT / 20 - 1) {
                const block = { ...item.block };
                if (block.attrs) {
                    const rest = { ...block.attrs };
                    delete rest.indent;
                    if (Object.keys(rest).length) block.attrs = rest;
                    else delete block.attrs;
                }
                lastItem().content.push(block);
                continue;
            }
            stack = [];

            if (item.quote) {
                if (!quote) {
                    quote = { type: 'blockquote', content: [] };
                    out.push(quote);
                }
                quote.content.push(item.quote);
            } else if (item.code !== undefined) {
                if (!code) {
                    code = { type: 'codeBlock', content: item.code ? [{ type: 'text', text: item.code }] : [] };
                    out.push(code);
                } else if (code.content[0]) {
                    code.content[0].text += `\n${item.code}`;
                } else {
                    code.content.push({ type: 'text', text: `\n${item.code}` });
                }
            } else if (item.block) {
                out.push(item.block);
            }
        }
        return out;
    }

    /** Replace image placeholders with data URLs (async zip reads). */
    async inlineImages(node) {
        if (node._file) {
            const bytes = await node._file.async('uint8array');
            node.attrs.src = `data:${node._mime};base64,${bytesToBase64(bytes)}`;
            delete node._file;
            delete node._mime;
        }
        if (node.content) for (const c of node.content) await this.inlineImages(c);
    }
}

export async function importDocx(bytes) {
    let zip;
    try {
        zip = await JSZip.loadAsync(bytes);
    } catch {
        throw new Error('This file is not a valid .docx (it could not be unzipped). Older .doc files are not supported.');
    }
    const reader = new Reader(zip);
    await reader.load();
    const styles = reader.baseStyles();
    const body = kid(reader.doc.documentElement, 'body');
    if (!body) throw new Error('This Word document has no body.');
    const content = reader.blocks(body);
    const doc = { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
    await reader.inlineImages(doc);
    return { content: doc, pageSetup: reader.pageSetup(body), styles, warnings: [...reader.warnings] };
}
