// Page geometry. Everything on screen is laid out in CSS px at 96 per inch;
// .docx stores twips (1/1440 in), so conversions live here too.

export const PX_PER_IN = 96;
export const TWIPS_PER_IN = 1440;
export const PAGE_GAP_PX = 24;

export const PAPER_SIZES = {
    letter: { name: 'Letter (8.5 × 11 in)', width: 8.5, height: 11 },
    legal: { name: 'Legal (8.5 × 14 in)', width: 8.5, height: 14 },
    a4: { name: 'A4 (210 × 297 mm)', width: 8.27, height: 11.69 },
    a5: { name: 'A5 (148 × 210 mm)', width: 5.83, height: 8.27 },
};

export const DEFAULT_PAGE_SETUP = Object.freeze({
    paper: 'letter',
    orientation: 'portrait',
    // Margins in inches, matching Word's "Normal" preset.
    margins: Object.freeze({ top: 1, right: 1, bottom: 1, left: 1 }),
    pageNumbers: true,
});

export function normalizePageSetup(setup) {
    const s = setup || {};
    const margins = { ...DEFAULT_PAGE_SETUP.margins, ...(s.margins || {}) };
    for (const k of Object.keys(margins)) {
        const v = Number(margins[k]);
        margins[k] = Number.isFinite(v) ? Math.min(Math.max(v, 0), 4) : DEFAULT_PAGE_SETUP.margins[k];
    }
    const custom = s.paper === 'custom' && s.customSize;
    return {
        paper: PAPER_SIZES[s.paper] || custom ? s.paper : DEFAULT_PAGE_SETUP.paper,
        orientation: s.orientation === 'landscape' ? 'landscape' : 'portrait',
        margins,
        pageNumbers: s.pageNumbers !== undefined ? !!s.pageNumbers : DEFAULT_PAGE_SETUP.pageNumbers,
        // Only used when paper === 'custom' (e.g. an imported odd size).
        ...(custom ? { customSize: { width: +s.customSize.width, height: +s.customSize.height } } : {}),
    };
}

/** Page size in inches, orientation applied. */
export function pageSizeIn(setup) {
    const s = normalizePageSetup(setup);
    const { width, height } = s.paper === 'custom' ? s.customSize : PAPER_SIZES[s.paper];
    return s.orientation === 'landscape' ? { width: height, height: width } : { width, height };
}

/** Everything the page view needs, in CSS px. */
export function pageGeometry(setup) {
    const s = normalizePageSetup(setup);
    const size = pageSizeIn(s);
    const px = (inches) => Math.round(inches * PX_PER_IN * 100) / 100;
    const width = px(size.width);
    const height = px(size.height);
    const margins = {
        top: px(s.margins.top),
        right: px(s.margins.right),
        bottom: px(s.margins.bottom),
        left: px(s.margins.left),
    };
    return {
        width,
        height,
        margins,
        contentWidth: width - margins.left - margins.right,
        contentHeight: Math.max(height - margins.top - margins.bottom, PX_PER_IN),
        gap: PAGE_GAP_PX,
        stride: height + PAGE_GAP_PX,
        pageNumbers: s.pageNumbers,
    };
}

export const inToTwips = (inches) => Math.round(inches * TWIPS_PER_IN);
export const twipsToIn = (twips) => Number(twips) / TWIPS_PER_IN;

/** Match an imported page size (inches) to a named paper, else 'custom'. */
export function paperFromSize(widthIn, heightIn) {
    const w = Math.min(widthIn, heightIn);
    const h = Math.max(widthIn, heightIn);
    const orientation = widthIn > heightIn ? 'landscape' : 'portrait';
    for (const [key, p] of Object.entries(PAPER_SIZES)) {
        if (Math.abs(p.width - w) < 0.05 && Math.abs(p.height - h) < 0.05) {
            return { paper: key, orientation };
        }
    }
    return { paper: 'custom', orientation, customSize: { width: w, height: h } };
}
