import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { computePageBreaks, sameBreaks } from './layout';
import { measureUnits } from './measure';

// Page view for a single ProseMirror document.
//
// The document is one continuous contentEditable (so selection, undo and
// find all span pages for free). Page breaks are widget decorations: blank
// block "spacers" placed at a line start or between blocks, tall enough to
// push the next line onto the next page. The page rectangles behind the text
// are drawn by React from the page count this extension reports.
//
// Each pass: hide spacers (CSS class on the host), measure the true
// continuous layout, compute breaks, show spacers. All in one frame, so the
// user never sees the unspaced layout.

export const paginationKey = new PluginKey('qwPagination');
const MEASURING_CLASS = 'qw-measuring';

function spacerWidget(pos, height, index) {
    return Decoration.widget(
        pos,
        () => {
            const el = document.createElement('div');
            el.className = 'qw-page-spacer';
            el.contentEditable = 'false';
            el.style.height = `${height}px`;
            el.setAttribute('aria-hidden', 'true');
            return el;
        },
        { side: -1, key: `pb${index}:${height}`, ignoreSelection: true },
    );
}

export const Pagination = Extension.create({
    name: 'pagination',

    addOptions() {
        return {
            // Returns a pageGeometry() result; read on every pass so page
            // setup changes apply without recreating the editor.
            getGeometry: null,
            onLayout: () => {},
        };
    },

    addCommands() {
        return {
            repaginate: () => ({ tr, dispatch }) => {
                if (dispatch) tr.setMeta(paginationKey, { remeasure: true }).setMeta('addToHistory', false);
                return true;
            },
        };
    },

    addProseMirrorPlugins() {
        const { getGeometry, onLayout } = this.options;

        return [
            new Plugin({
                key: paginationKey,
                state: {
                    init: () => ({ breaks: [], decos: DecorationSet.empty, requests: 0 }),
                    apply(tr, value, _old, newState) {
                        const meta = tr.getMeta(paginationKey);
                        if (meta?.breaks) {
                            const decos = DecorationSet.create(
                                newState.doc,
                                meta.breaks.map((b, i) => spacerWidget(b.pos, b.height, i)),
                            );
                            return { ...value, breaks: meta.breaks, decos };
                        }
                        if (meta?.remeasure) return { ...value, requests: value.requests + 1 };
                        if (!tr.docChanged) return value;
                        return { ...value, decos: value.decos.map(tr.mapping, tr.doc) };
                    },
                },
                props: {
                    decorations(state) {
                        return paginationKey.getState(state).decos;
                    },
                },
                view(view) {
                    let frame = null;
                    let timer = null;
                    let lastPages = 0;
                    let destroyed = false;

                    const run = () => {
                        cancelAnimationFrame(frame);
                        clearTimeout(timer);
                        frame = timer = null;
                        if (destroyed || !view.dom.isConnected) return;
                        const geo = getGeometry?.();
                        if (!geo) return;

                        const host = view.dom.parentElement;
                        host.classList.add(MEASURING_CLASS);
                        const rect = view.dom.getBoundingClientRect();
                        const scale = view.dom.offsetWidth ? rect.width / view.dom.offsetWidth : 1;
                        const origin = rect.top + geo.margins.top * scale;
                        const units = measureUnits(view, origin, scale);
                        host.classList.remove(MEASURING_CLASS);

                        const { breaks, pageCount } = computePageBreaks(units, geo);
                        if (!sameBreaks(breaks, paginationKey.getState(view.state).breaks)) {
                            view.dispatch(
                                view.state.tr.setMeta(paginationKey, { breaks }).setMeta('addToHistory', false),
                            );
                        }
                        if (pageCount !== lastPages) {
                            lastPages = pageCount;
                            onLayout({ pageCount });
                        }
                    };

                    // rAF keeps the pass inside the frame that shows the
                    // edit; the timer covers hidden windows where rAF stalls.
                    const schedule = () => {
                        if (frame === null) frame = requestAnimationFrame(run);
                        if (timer === null) timer = setTimeout(run, 100);
                    };

                    const ro = new ResizeObserver(schedule);
                    ro.observe(view.dom);
                    const fonts = document.fonts;
                    fonts?.ready.then(schedule);
                    fonts?.addEventListener?.('loadingdone', schedule);
                    schedule();

                    return {
                        update(v, prev) {
                            const a = paginationKey.getState(v.state);
                            const b = paginationKey.getState(prev);
                            if (v.state.doc !== prev.doc || a.requests !== b.requests) schedule();
                        },
                        destroy() {
                            destroyed = true;
                            cancelAnimationFrame(frame);
                            clearTimeout(timer);
                            ro.disconnect();
                            fonts?.removeEventListener?.('loadingdone', schedule);
                        },
                    };
                },
            }),
        ];
    },
});
