// Pure page-break layout, kept free of the DOM so it can be unit tested.
//
// Input is the document measured as one continuous column with no page
// spacers ("logical" coordinates, px, 0 = top of page 1's content box):
//
//   units: [{ top, bottom, breakTop, pos, forced }]
//     top/bottom  vertical extent of one line (or one unbreakable block)
//     breakTop    where the next page would start if we break before this
//                 unit (a block's margin-box top; a line's top)
//     pos         document position a spacer widget goes at to break here
//     forced      an explicit page break: the next page starts at `bottom`
//
// Output is where to put spacer widgets. Spacers are block boxes inserted at
// line starts or between blocks, so they never change how text wraps; each one
// pushes everything after it down by exactly its height. That makes the
// layout additive: spacer k is sized so the first line after it lands on the
// content top of page k.

const EPS = 0.5;

export function computePageBreaks(units, { contentHeight, stride }) {
    const breaks = [];
    let pageStart = 0;
    let shifted = 0; // total spacer height inserted so far

    const addBreak = (pos, y) => {
        const pageIndex = breaks.length + 1;
        const height = pageIndex * stride - y - shifted;
        breaks.push({ pos, y, height: Math.max(0, Math.round(height * 100) / 100) });
        shifted += height;
        pageStart = y;
    };

    for (const unit of units) {
        if (unit.forced) {
            addBreak(unit.pos, unit.bottom);
            continue;
        }
        const overflows = unit.bottom - pageStart > contentHeight + EPS;
        // A unit that already starts the page cannot move anywhere better;
        // let it overflow instead of producing an empty page.
        const startsPage = unit.breakTop <= pageStart + EPS;
        if (overflows && !startsPage) addBreak(unit.pos, unit.breakTop);
    }

    return { breaks, pageCount: breaks.length + 1 };
}

export function sameBreaks(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].pos !== b[i].pos || Math.abs(a[i].height - b[i].height) > 0.5) return false;
    }
    return true;
}
