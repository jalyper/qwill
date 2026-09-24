import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { createExtensions } from '../editor/extensions';
import { pageGeometry } from '../document/pageSetup';
import { stylesToCssVars } from '../document/docStyles';
import '../styles/document.css';

/** A mutable cell the pagination plugin reads on every pass. */
class Cell {
    constructor(value) {
        this.value = value;
    }

    get() {
        return this.value;
    }

    set(value) {
        this.value = value;
    }
}

/**
 * One open document: the TipTap editor laid out as pages.
 * Mounted with key={docId}, so switching documents gets a fresh editor and a
 * fresh undo history.
 */
export default function DocumentView({ docId, draft, zoom, spellcheck, onEdit, onEditor, onStatus, registerLiveContent }) {
    const [pageCount, setPageCount] = useState(1);
    const geometry = useMemo(() => pageGeometry(draft.pageSetup), [draft.pageSetup]);
    const callbacks = useRef({ onEdit, onStatus });
    useEffect(() => {
        callbacks.current = { onEdit, onStatus };
    });

    // Built once per editor. Pagination reads the geometry through `holder`
    // on every pass, so page setup changes apply without a new editor.
    const [{ holder, extensions }] = useState(() => {
        const cell = new Cell(geometry);
        return {
            holder: cell,
            extensions: createExtensions({
                pagination: {
                    getGeometry: () => cell.get(),
                    onLayout: ({ pageCount: n }) => setPageCount(n),
                },
            }),
        };
    });

    const editor = useEditor({
        extensions,
        // Drafts migrated from the old HTML format carry `html` until their
        // first edit.
        content: draft.content || draft.html || '',
        autofocus: 'start',
        editorProps: {
            attributes: { class: 'qw-doc', spellcheck: String(spellcheck), 'aria-label': 'Document' },
        },
        onUpdate: () => callbacks.current.onEdit?.(),
        shouldRerenderOnTransaction: false,
        immediatelyRender: true,
    });

    // Page setup changes: new geometry, then repaginate.
    useEffect(() => {
        holder.set(geometry);
        editor?.commands.repaginate();
    }, [geometry, editor, holder]);

    // Base styles change line heights too.
    const cssVars = useMemo(() => stylesToCssVars(draft.styles), [draft.styles]);
    useEffect(() => {
        editor?.commands.repaginate();
    }, [cssVars, editor]);

    useEffect(() => {
        editor?.view.dom.setAttribute('spellcheck', String(spellcheck));
    }, [editor, spellcheck]);

    useEffect(() => {
        if (!editor) return undefined;
        onEditor?.(editor);
        registerLiveContent(() => ({ id: docId, content: editor.getJSON() }));
        return () => {
            onEditor?.(null);
            registerLiveContent(null);
        };
    }, [editor, docId, onEditor, registerLiveContent]);

    // Status: current page (from the caret) and word count, debounced.
    const pagesRef = useRef(null);
    useEffect(() => {
        if (!editor) return undefined;
        let timer = null;
        const report = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (editor.isDestroyed) return;
                let page = 1;
                const host = pagesRef.current;
                if (host) {
                    try {
                        const top = editor.view.coordsAtPos(editor.state.selection.head).top;
                        const rect = host.getBoundingClientRect();
                        const scale = rect.width / host.offsetWidth || 1;
                        page = Math.floor((top - rect.top) / (holder.get().stride * scale)) + 1;
                    } catch {
                        // Selection not rendered yet.
                    }
                }
                const storage = editor.storage.characterCount;
                callbacks.current.onStatus?.({
                    page: Math.max(1, page),
                    words: storage.words(),
                    characters: storage.characters(),
                });
            }, 150);
        };
        report();
        editor.on('transaction', report);
        return () => {
            clearTimeout(timer);
            editor.off('transaction', report);
        };
    }, [editor, holder]);

    useEffect(() => {
        callbacks.current.onStatus?.({ pages: pageCount });
    }, [pageCount]);

    const g = geometry;
    const style = {
        ...cssVars,
        '--page-w': `${g.width}px`,
        '--page-h': `${g.height}px`,
        '--page-mt': `${g.margins.top}px`,
        '--page-mr': `${g.margins.right}px`,
        '--page-mb': `${g.margins.bottom}px`,
        '--page-ml': `${g.margins.left}px`,
        '--pages-h': `${pageCount * g.stride - g.gap}px`,
    };

    return (
        <div className="qw-canvas" style={{ zoom }}>
            <div className="qw-pages" style={style} ref={pagesRef}>
                {Array.from({ length: pageCount }, (_, i) => (
                    <div key={i} className="qw-page" style={{ top: i * g.stride }} aria-hidden="true">
                        {g.pageNumbers && <span className="qw-page-number">{i + 1}</span>}
                    </div>
                ))}
                <EditorContent editor={editor} className="qw-editor-host" />
            </div>
        </div>
    );
}
