// Measure the rendered document as a list of lines for computePageBreaks().
// Call only while spacers are hidden (the host carries `qw-measuring`), so the
// DOM shows the true continuous layout.

const SPACER_CLASS = 'qw-page-spacer';

/** Text fragments of one textblock, in document order, as client rects. */
function fragmentRects(el) {
    const rects = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList?.contains(SPACER_CLASS)) return NodeFilter.FILTER_REJECT;
                return node.tagName === 'IMG' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
            return node.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
    });
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        let list;
        if (node.nodeType === Node.TEXT_NODE) {
            range.selectNodeContents(node);
            list = range.getClientRects();
        } else {
            list = [node.getBoundingClientRect()];
        }
        for (const r of list) {
            if (r.height > 0) rects.push({ top: r.top, bottom: r.bottom, left: r.left });
        }
    }
    return rects;
}

/** Group fragments into visual lines: a new line starts below the current one. */
function groupLines(rects) {
    const lines = [];
    let cur = null;
    for (const r of rects) {
        const h = Math.min(r.bottom - r.top, cur ? cur.bottom - cur.top : Infinity);
        if (cur && r.top < cur.bottom - h * 0.5) {
            cur.top = Math.min(cur.top, r.top);
            cur.bottom = Math.max(cur.bottom, r.bottom);
        } else {
            cur = { top: r.top, bottom: r.bottom, left: r.left };
            lines.push(cur);
        }
    }
    return lines;
}

/**
 * Walk the ProseMirror doc and return break units in logical px.
 * `origin` is the client y of page 1's content top; `scale` undoes CSS zoom.
 */
export function measureUnits(view, origin, scale) {
    const units = [];
    const toLogical = (clientY) => (clientY - origin) / scale;

    const blockUnit = (el, pos) => {
        const rect = el.getBoundingClientRect();
        const mt = parseFloat(getComputedStyle(el).marginTop) || 0;
        const top = toLogical(rect.top);
        return { top, bottom: toLogical(rect.bottom), breakTop: top - mt, pos };
    };

    view.state.doc.descendants((node, pos) => {
        const dom = view.nodeDOM(pos);
        if (!(dom instanceof HTMLElement)) return false;

        if (node.type.name === 'pageBreak') {
            units.push({ ...blockUnit(dom, pos + node.nodeSize), forced: true });
            return false;
        }

        if (node.isTextblock) {
            const first = blockUnit(dom, pos);
            const lines = groupLines(fragmentRects(dom));
            if (lines.length <= 1) {
                units.push(first);
                return false;
            }
            const rect = dom.getBoundingClientRect();
            lines.forEach((line, i) => {
                const top = i === 0 ? rect.top : (lines[i - 1].bottom + line.top) / 2;
                const bottom = i === lines.length - 1 ? rect.bottom : (line.bottom + lines[i + 1].top) / 2;
                if (i === 0) {
                    units.push({ ...first, bottom: toLogical(bottom) });
                    return;
                }
                const hit = view.posAtCoords({ left: line.left + 1, top: (line.top + line.bottom) / 2 });
                // Fall back to breaking before the whole block if the line
                // start can't be resolved to a position inside it.
                const inside = hit && hit.pos > pos + 1 && hit.pos < pos + node.nodeSize - 1;
                units.push({
                    top: toLogical(top),
                    bottom: toLogical(bottom),
                    breakTop: inside ? toLogical(top) : first.breakTop,
                    pos: inside ? hit.pos : pos,
                });
            });
            return false;
        }

        // Tables, images, rules: one unbreakable unit. Lists, quotes and
        // list items are containers, so descend into their children.
        if (node.type.name === 'table' || node.isAtom || node.isLeaf) {
            units.push(blockUnit(dom, pos));
            return false;
        }
        return true;
    });

    return units;
}
