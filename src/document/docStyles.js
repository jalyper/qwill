// Per-document base styles: what "Normal" and "Heading 1-6" look like.
// A .docx carries its own (Times 12pt single-spaced, say), so these travel
// with the document instead of being fixed in CSS. Units: font sizes and
// spacing in points, lineHeight as a multiple, colors as #rrggbb.

export const DEFAULT_STYLES = Object.freeze({
    normal: { font: 'Calibri', size: 11, color: null, lineHeight: 1.08, spaceBefore: 0, spaceAfter: 8 },
    headings: {
        1: { font: 'Calibri Light', size: 16, color: '#2f5496', bold: false, italic: false, spaceBefore: 12, spaceAfter: 0 },
        2: { font: 'Calibri Light', size: 13, color: '#2f5496', bold: false, italic: false, spaceBefore: 2, spaceAfter: 0 },
        3: { font: 'Calibri Light', size: 12, color: '#1f3763', bold: false, italic: false, spaceBefore: 2, spaceAfter: 0 },
        4: { font: 'Calibri Light', size: 11, color: '#2f5496', bold: false, italic: true, spaceBefore: 2, spaceAfter: 0 },
        5: { font: 'Calibri Light', size: 11, color: '#2f5496', bold: false, italic: false, spaceBefore: 2, spaceAfter: 0 },
        6: { font: 'Calibri Light', size: 11, color: '#1f3763', bold: false, italic: false, spaceBefore: 2, spaceAfter: 0 },
    },
});

const numOr = (v, d) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

export function normalizeStyles(styles) {
    const s = styles || {};
    const n = { ...DEFAULT_STYLES.normal, ...(s.normal || {}) };
    const normal = {
        font: n.font || DEFAULT_STYLES.normal.font,
        size: numOr(n.size, 11),
        color: n.color || null,
        lineHeight: numOr(n.lineHeight, 1.08),
        spaceBefore: numOr(n.spaceBefore, 0),
        spaceAfter: numOr(n.spaceAfter, 8),
    };
    const headings = {};
    for (let level = 1; level <= 6; level++) {
        const d = DEFAULT_STYLES.headings[level];
        const h = { ...d, ...(s.headings?.[level] || {}) };
        headings[level] = {
            font: h.font || normal.font,
            size: numOr(h.size, d.size),
            color: h.color || null,
            bold: !!h.bold,
            italic: !!h.italic,
            spaceBefore: numOr(h.spaceBefore, d.spaceBefore),
            spaceAfter: numOr(h.spaceAfter, d.spaceAfter),
        };
    }
    return { normal, headings };
}

const cssFont = (name) => {
    const quoted = /[\s,]/.test(name) ? `"${name}"` : name;
    // Metric-compatible fallbacks so layout is close when a font is missing.
    const fallback = {
        calibri: 'Carlito, "Segoe UI", sans-serif',
        'calibri light': 'Calibri, Carlito, "Segoe UI Light", sans-serif',
        cambria: 'Caladea, Georgia, serif',
        'times new roman': '"Liberation Serif", Times, serif',
        arial: '"Liberation Sans", Helvetica, sans-serif',
        'courier new': '"Liberation Mono", monospace',
    }[name.toLowerCase()];
    return fallback ? `${quoted}, ${fallback}` : `${quoted}, sans-serif`;
};

/** CSS custom properties for the page element. */
export function stylesToCssVars(styles) {
    const { normal, headings } = normalizeStyles(styles);
    const vars = {
        '--doc-font': cssFont(normal.font),
        '--doc-size': `${normal.size}pt`,
        '--doc-color': normal.color || 'inherit',
        '--doc-line': String(normal.lineHeight),
        '--doc-before': `${normal.spaceBefore}pt`,
        '--doc-after': `${normal.spaceAfter}pt`,
    };
    for (let level = 1; level <= 6; level++) {
        const h = headings[level];
        vars[`--h${level}-font`] = cssFont(h.font);
        vars[`--h${level}-size`] = `${h.size}pt`;
        vars[`--h${level}-color`] = h.color || 'inherit';
        vars[`--h${level}-weight`] = h.bold ? '700' : '400';
        vars[`--h${level}-style`] = h.italic ? 'italic' : 'normal';
        vars[`--h${level}-before`] = `${h.spaceBefore}pt`;
        vars[`--h${level}-after`] = `${h.spaceAfter}pt`;
    }
    return vars;
}
