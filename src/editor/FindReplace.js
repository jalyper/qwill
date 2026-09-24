import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Find & replace over the ProseMirror document. Matches never cross a
// paragraph boundary (same as Word). Inline atoms (images, line breaks)
// count as one placeholder character so positions stay exact.

export const findKey = new PluginKey('qwFind');
const ATOM = '￼';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function findMatches(doc, query, { caseSensitive = false, wholeWord = false } = {}) {
    if (!query) return [];
    let source = escapeRegExp(query);
    if (wholeWord) source = `(?<![\\p{L}\\p{N}_])${source}(?![\\p{L}\\p{N}_])`;
    const re = new RegExp(source, `gu${caseSensitive ? '' : 'i'}`);
    const matches = [];
    doc.descendants((node, pos) => {
        if (!node.isTextblock) return true;
        let text = '';
        const starts = []; // text offset -> doc pos, per UTF-16 unit
        node.forEach((child, offset) => {
            const s = child.isText ? child.text : ATOM;
            for (let i = 0; i < s.length; i++) starts.push(pos + 1 + offset + i);
            text += s;
        });
        for (const m of text.matchAll(re)) {
            if (!m[0].length) continue;
            matches.push({ from: starts[m.index], to: starts[m.index + m[0].length - 1] + 1 });
        }
        return false;
    });
    return matches;
}

const emptyState = { query: '', options: {}, matches: [], index: -1, decos: DecorationSet.empty };

function build(doc, query, options, index) {
    const matches = findMatches(doc, query, options);
    const i = matches.length ? Math.min(Math.max(index, 0), matches.length - 1) : -1;
    const decos = DecorationSet.create(
        doc,
        matches.map((m, k) =>
            Decoration.inline(m.from, m.to, { class: k === i ? 'qw-find-hit qw-find-current' : 'qw-find-hit' }),
        ),
    );
    return { query, options, matches, index: i, decos };
}

function replacementNode(state, match, text) {
    const marks = state.doc.resolve(match.from + 1).marks();
    return state.schema.text(text, marks);
}

export const FindReplace = Extension.create({
    name: 'findReplace',

    addCommands() {
        const reveal = (editor) => {
            const s = findKey.getState(editor.state);
            const m = s.matches[s.index];
            if (m) editor.chain().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
        };
        const step = (dir) => ({ editor, state, dispatch }) => {
            const s = findKey.getState(state);
            if (!s.matches.length) return false;
            if (dispatch) {
                // Start from the match at/after the cursor on first use.
                const index = (s.index + dir + s.matches.length) % s.matches.length;
                editor.view.dispatch(state.tr.setMeta(findKey, { index }).setMeta('addToHistory', false));
                reveal(editor);
            }
            return true;
        };

        return {
            setFindQuery: (query, options = {}) => ({ tr, dispatch }) => {
                if (dispatch) tr.setMeta(findKey, { query, options }).setMeta('addToHistory', false);
                return true;
            },
            clearFind: () => ({ tr, dispatch }) => {
                if (dispatch) tr.setMeta(findKey, { query: '' }).setMeta('addToHistory', false);
                return true;
            },
            findNext: () => step(1),
            findPrevious: () => step(-1),
            replaceCurrent: (replacement) => ({ editor, state, dispatch }) => {
                const s = findKey.getState(state);
                const m = s.matches[s.index];
                if (!m) return false;
                if (dispatch) {
                    const tr = replacement
                        ? state.tr.replaceWith(m.from, m.to, replacementNode(state, m, replacement))
                        : state.tr.delete(m.from, m.to);
                    editor.view.dispatch(tr);
                    reveal(editor);
                }
                return true;
            },
            replaceAll: (replacement) => ({ state, tr, dispatch }) => {
                const s = findKey.getState(state);
                if (!s.matches.length) return false;
                if (dispatch) {
                    // Back to front so earlier positions stay valid.
                    for (const m of [...s.matches].reverse()) {
                        if (replacement) tr.replaceWith(m.from, m.to, replacementNode(state, m, replacement));
                        else tr.delete(m.from, m.to);
                    }
                }
                return true;
            },
        };
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: findKey,
                state: {
                    init: () => emptyState,
                    apply(tr, value) {
                        const meta = tr.getMeta(findKey);
                        if (meta && 'query' in meta) {
                            if (!meta.query) return emptyState;
                            return build(tr.doc, meta.query, meta.options || {}, 0);
                        }
                        if (meta && 'index' in meta) return build(tr.doc, value.query, value.options, meta.index);
                        if (tr.docChanged && value.query) return build(tr.doc, value.query, value.options, value.index);
                        return value;
                    },
                },
                props: {
                    decorations: (state) => findKey.getState(state).decos,
                },
            }),
        ];
    },
});
