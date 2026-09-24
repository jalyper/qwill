import { describe, it, expect } from 'vitest';
import { computePageBreaks, sameBreaks } from '../editor/pagination/layout';
import { pageGeometry } from '../document/pageSetup';

const geo = pageGeometry(); // Letter, 1in margins: 864px content, 1080px stride
const lines = (n, h = 20, start = 0) =>
    Array.from({ length: n }, (_, i) => ({ top: start + i * h, bottom: start + (i + 1) * h, breakTop: start + i * h, pos: 100 + i }));

describe('computePageBreaks', () => {
    it('keeps a short document on one page', () => {
        expect(computePageBreaks(lines(10), geo)).toEqual({ breaks: [], pageCount: 1 });
    });

    it('breaks before the first line that would cross the bottom margin', () => {
        const { breaks, pageCount } = computePageBreaks(lines(50), geo); // 43.2 lines fit
        expect(pageCount).toBe(2);
        expect(breaks[0].pos).toBe(100 + 43);
        // The spacer lands line 44 exactly on page 2's content top.
        expect(breaks[0].y + breaks[0].height).toBeCloseTo(geo.stride);
    });

    it('lands every page start on its page content top', () => {
        const { breaks, pageCount } = computePageBreaks(lines(400), geo);
        expect(pageCount).toBe(Math.ceil(400 / 43));
        let shifted = 0;
        breaks.forEach((b, i) => {
            shifted += b.height;
            expect(b.y + shifted).toBeCloseTo((i + 1) * geo.stride);
        });
    });

    it('honours forced page breaks', () => {
        const units = [...lines(3), { top: 60, bottom: 60, breakTop: 60, pos: 500, forced: true }, ...lines(2, 20, 60)];
        const { breaks, pageCount } = computePageBreaks(units, geo);
        expect(pageCount).toBe(2);
        expect(breaks[0]).toMatchObject({ pos: 500, y: 60 });
    });

    it('lets a unit taller than a page overflow instead of looping', () => {
        const units = [{ top: 0, bottom: 2000, breakTop: 0, pos: 1 }, { top: 2000, bottom: 2020, breakTop: 2000, pos: 2 }];
        const { breaks } = computePageBreaks(units, geo);
        expect(breaks).toHaveLength(1);
        expect(breaks[0].pos).toBe(2);
    });

    it('breaks at a block margin top, not its border box', () => {
        const units = [...lines(40), { top: 830, bottom: 900, breakTop: 812, pos: 999 }];
        const { breaks } = computePageBreaks(units, geo);
        expect(breaks[0]).toMatchObject({ pos: 999, y: 812 });
    });
});

describe('sameBreaks', () => {
    it('ignores sub-pixel height noise', () => {
        expect(sameBreaks([{ pos: 1, height: 100 }], [{ pos: 1, height: 100.3 }])).toBe(true);
        expect(sameBreaks([{ pos: 1, height: 100 }], [{ pos: 2, height: 100 }])).toBe(false);
    });
});
