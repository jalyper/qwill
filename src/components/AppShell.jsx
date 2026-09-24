import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Plus, X } from 'lucide-react';
import { useWorkspace } from '../document/useWorkspace';
import { isTauri, onCloseRequested, setWindowTitle, showError } from '../document/platform';
import { normalizePageSetup, pageSizeIn } from '../document/pageSetup';
import { themes } from '../constants/themes';
import DocumentView from './DocumentView';
import Toolbar from './Toolbar';
import FindBar from './FindBar';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from './Menu';
import { LinkDialog, PageSetupDialog, UnsavedDialog } from './Dialogs';

const PREFS_KEY = 'qwill:prefs';
const DEFAULT_PREFS = { zoom: 1, theme: 'light', spellcheck: true };
const ZOOM = { min: 0.5, max: 2, step: 0.1 };

function loadPrefs() {
    try {
        return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    } catch {
        return DEFAULT_PREFS;
    }
}

/** First line of the document, as Word suggests it for "Save As". */
function suggestName(editor) {
    if (!editor) return null;
    const { doc } = editor.state;
    const text = doc.textBetween(0, Math.min(doc.content.size, 2000), '\n', ' ');
    const first = text.split('\n').map((l) => l.trim()).find(Boolean) || '';
    return first.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60).trim() || null;
}

export default function AppShell() {
    const ws = useWorkspace();
    const [prefs, setPrefs] = useState(loadPrefs);
    const [editor, setEditor] = useState(null);
    const [active, setActive] = useState(null); // { id, draft }
    const [status, setStatus] = useState({ page: 1, pages: 1, words: 0 });
    const [find, setFind] = useState(null); // null | 'find' | 'replace'
    const [linkDialog, setLinkDialog] = useState(null);
    const [pageSetupOpen, setPageSetupOpen] = useState(false);
    const [unsaved, setUnsaved] = useState(null); // { names, resolve }

    const { activeId, activeDoc, docs } = ws;

    useEffect(() => {
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        } catch {
            // Preferences are a convenience; ignore storage errors.
        }
    }, [prefs]);

    useEffect(() => {
        const theme = themes.find((t) => t.id === prefs.theme) || themes[0];
        for (const [k, v] of Object.entries(theme.colors)) document.documentElement.style.setProperty(k, v);
    }, [prefs.theme]);

    // Load the active document's draft.
    const { loadDraft } = ws;
    useEffect(() => {
        if (!activeId) return undefined;
        let cancelled = false;
        loadDraft(activeId).then((draft) => {
            if (!cancelled) setActive({ id: activeId, draft });
        });
        return () => {
            cancelled = true;
        };
    }, [activeId, loadDraft]);

    useEffect(() => {
        if (activeDoc) setWindowTitle(`${activeDoc.dirty ? '• ' : ''}${activeDoc.name} — Qwill`);
    }, [activeDoc]);

    // ---- unsaved-changes prompt ----------------------------------------

    const askUnsaved = useCallback((names) => new Promise((resolve) => setUnsaved({ names, resolve })), []);
    const answer = (choice) => {
        unsaved?.resolve(choice);
        setUnsaved(null);
    };

    const save = useCallback(
        (id, opts = {}) => ws.save(id, { ...opts, suggestedName: id === activeId ? suggestName(editor) : undefined }),
        [ws, activeId, editor],
    );

    const closeDoc = useCallback(async (id) => {
        const doc = docs.find((d) => d.id === id);
        if (!doc) return;
        if (doc.dirty) {
            const choice = await askUnsaved([doc.name]);
            if (choice === 'cancel') return;
            if (choice === 'save' && !(await save(id))) return;
        }
        await ws.closeDocument(id);
    }, [docs, askUnsaved, save, ws]);

    // Window close: flush drafts, then ask about unsaved documents.
    const latest = useRef(null);
    useEffect(() => {
        latest.current = { docs, save, ws, askUnsaved };
    });
    useEffect(() => {
        let unlisten = null;
        let disposed = false;
        onCloseRequested({
            shouldBlock: () => latest.current.docs.some((d) => d.dirty) || latest.current.ws.hasPendingWrites(),
            ask: async () => {
                const { docs: all, save: saveDoc, ws: w, askUnsaved: ask } = latest.current;
                await w.flushDrafts();
                const dirty = all.filter((d) => d.dirty);
                if (!dirty.length) return true;
                const choice = await ask(dirty.map((d) => d.name));
                if (choice === 'cancel') return false;
                if (choice === 'discard') {
                    for (const d of dirty) await w.closeDocument(d.id);
                    await w.flushDrafts();
                    return true;
                }
                for (const d of dirty) {
                    if (!(await saveDoc(d.id))) return false;
                }
                return true;
            },
        }).then((fn) => {
            if (disposed) fn();
            else unlisten = fn;
        });
        const onHide = () => {
            if (document.visibilityState === 'hidden') latest.current.ws.flushDrafts();
        };
        document.addEventListener('visibilitychange', onHide);
        return () => {
            disposed = true;
            unlisten?.();
            document.removeEventListener('visibilitychange', onHide);
        };
    }, []);

    // ---- commands -------------------------------------------------------

    const print = useCallback(() => {
        const setup = normalizePageSetup(active?.draft.pageSetup);
        const size = pageSizeIn(setup);
        const m = setup.margins;
        const numbers = setup.pageNumbers ? ' @bottom-right { content: counter(page); font-size: 9pt; }' : '';
        const style = document.createElement('style');
        style.textContent = `@page { size: ${size.width}in ${size.height}in; margin: ${m.top}in ${m.right}in ${m.bottom}in ${m.left}in;${numbers} }`;
        document.head.appendChild(style);
        const cleanup = () => {
            style.remove();
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        window.print();
    }, [active]);

    const openLinkDialog = useCallback(() => {
        if (!editor) return;
        const { empty } = editor.state.selection;
        setLinkDialog({ initialHref: editor.getAttributes('link').href || '', hasSelection: !empty || editor.isActive('link') });
    }, [editor]);

    const applyPageSetup = (pageSetup) => {
        setPageSetupOpen(false);
        if (!active) return;
        setActive({ id: active.id, draft: { ...active.draft, pageSetup } });
        ws.updateDraft(active.id, { pageSetup });
    };

    const convertPdf = async () => {
        try {
            const { open, save: saveDialog } = await import('@tauri-apps/plugin-dialog');
            const { invoke } = await import('@tauri-apps/api/core');
            const pdfPath = await open({ filters: [{ name: 'PDF', extensions: ['pdf'] }] });
            if (!pdfPath) return;
            const docxPath = await saveDialog({
                defaultPath: String(pdfPath).replace(/\.pdf$/i, '.docx'),
                filters: [{ name: 'Word Document', extensions: ['docx'] }],
            });
            if (!docxPath) return;
            const written = await invoke('convert_pdf_to_docx', { pdfPath: String(pdfPath), docxPath });
            await ws.openPath(written);
            ws.setNotice({ title: 'PDF converted', lines: ['Only the text was extracted: images, tables and formatting are not recovered.'] });
        } catch (err) {
            await showError(`PDF conversion failed: ${err?.message || err}`);
        }
    };

    const zoomBy = useCallback((delta) => {
        setPrefs((p) => ({ ...p, zoom: Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, p.zoom + delta)) * 100) / 100 }));
    }, []);

    // ---- keyboard shortcuts --------------------------------------------

    const handlers = useRef({});
    useEffect(() => {
        handlers.current = {
            s: (e) => activeId && save(activeId, { saveAs: e.shiftKey }),
            o: () => ws.openDialog(),
            n: () => ws.newDocument(),
            p: () => print(),
            f: () => setFind('find'),
            h: () => setFind('replace'),
            k: () => openLinkDialog(),
            w: () => activeId && closeDoc(activeId),
            '=': () => zoomBy(ZOOM.step),
            '+': () => zoomBy(ZOOM.step),
            '-': () => zoomBy(-ZOOM.step),
            0: () => setPrefs((p) => ({ ...p, zoom: 1 })),
        };
    });
    useEffect(() => {
        const onKey = (e) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
            const handler = handlers.current[e.key.toLowerCase()];
            if (!handler) return;
            e.preventDefault();
            e.stopPropagation();
            handler(e);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    // ---- render ---------------------------------------------------------

    const fileMenu = (
        <Menu title="File" label={<><FileText size={16} /> File</>}>
            <MenuItem shortcut="Ctrl+N" onClick={ws.newDocument}>New</MenuItem>
            <MenuItem shortcut="Ctrl+O" onClick={ws.openDialog}>Open…</MenuItem>
            {ws.recent.length > 0 && <MenuLabel>Recent</MenuLabel>}
            {ws.recent.slice(0, 8).map((r) => (
                <MenuItem key={r.path} title={r.path} onClick={() => ws.openPath(r.path)}>{r.name}</MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem shortcut="Ctrl+S" disabled={!activeDoc} onClick={() => save(activeId)}>Save</MenuItem>
            <MenuItem shortcut="Ctrl+Shift+S" disabled={!activeDoc} onClick={() => save(activeId, { saveAs: true })}>
                {isTauri() ? 'Save As…' : 'Download as .docx'}
            </MenuItem>
            <MenuItem shortcut="Ctrl+P" disabled={!editor} onClick={print}>Print / Save as PDF…</MenuItem>
            <MenuItem disabled={!active} onClick={() => setPageSetupOpen(true)}>Page setup…</MenuItem>
            {isTauri() && (
                <>
                    <MenuSeparator />
                    <MenuItem onClick={convertPdf}>Convert PDF to Word…</MenuItem>
                </>
            )}
            <MenuSeparator />
            <MenuLabel>Theme</MenuLabel>
            {themes.map((t) => (
                <MenuItem key={t.id} checked={prefs.theme === t.id} onClick={() => setPrefs((p) => ({ ...p, theme: t.id }))}>{t.name}</MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem checked={prefs.spellcheck} onClick={() => setPrefs((p) => ({ ...p, spellcheck: !p.spellcheck }))}>Check spelling as you type</MenuItem>
            <MenuSeparator />
            <MenuItem shortcut="Ctrl+W" disabled={!activeDoc} onClick={() => closeDoc(activeId)}>Close document</MenuItem>
        </Menu>
    );

    const ready = active && active.id === activeId;

    return (
        <div className="qw-app">
            <header className="qw-titlebar">
                <span className="qw-brand">Qwill</span>
                <nav className="qw-tabs" aria-label="Open documents" role="tablist">
                    {docs.map((d) => (
                        <div
                            key={d.id}
                            className={`qw-tab${d.id === activeId ? ' is-active' : ''}`}
                            title={d.path || 'Not saved yet'}
                            onClick={() => ws.setActiveId(d.id)}
                            onAuxClick={(e) => e.button === 1 && closeDoc(d.id)}
                            role="tab"
                            aria-selected={d.id === activeId}
                        >
                            <span className="qw-tab-name">{d.name}</span>
                            {d.dirty && <span className="qw-tab-dirty" title="Unsaved changes" />}
                            <span
                                className="qw-tab-close"
                                role="button"
                                aria-label={`Close ${d.name}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeDoc(d.id);
                                }}
                            >
                                <X size={13} />
                            </span>
                        </div>
                    ))}
                </nav>
                <button type="button" className="qw-btn" title="New document (Ctrl+N)" onClick={ws.newDocument}><Plus size={16} /></button>
            </header>

            <Toolbar
                editor={ready ? editor : null}
                docStyles={active?.draft.styles}
                onFind={() => setFind('replace')}
                onLink={openLinkDialog}
                fileMenu={fileMenu}
            />

            <main className="qw-main">
                {find && editor && <FindBar key={find} editor={editor} showReplace={find === 'replace'} onClose={() => setFind(null)} />}
                {ready ? (
                    <DocumentView
                        key={active.id}
                        docId={active.id}
                        draft={active.draft}
                        zoom={prefs.zoom}
                        spellcheck={prefs.spellcheck}
                        onEdit={() => ws.updateDraft(active.id, null)}
                        onEditor={setEditor}
                        onStatus={(s) => setStatus((prev) => ({ ...prev, ...s }))}
                        registerLiveContent={ws.setLiveContentSource}
                    />
                ) : (
                    <div className="qw-loading">{ws.ready ? '' : 'Loading…'}</div>
                )}
            </main>

            <footer className="qw-status">
                <span>Page {Math.min(status.page, status.pages)} of {status.pages}</span>
                <span>{status.words.toLocaleString()} {status.words === 1 ? 'word' : 'words'}</span>
                {ws.draftError && <span className="warn">Autosave is failing: save your work to disk.</span>}
                <span className="spacer" />
                {activeDoc && (
                    <span title={activeDoc.path || ''}>
                        {activeDoc.dirty ? 'Unsaved changes' : activeDoc.path ? 'Saved' : 'Not saved yet'}
                    </span>
                )}
                <span className="qw-zoom">
                    <button type="button" className="qw-btn" title="Zoom out (Ctrl+-)" onClick={() => zoomBy(-ZOOM.step)}>−</button>
                    <input
                        type="range"
                        min={ZOOM.min * 100}
                        max={ZOOM.max * 100}
                        step={10}
                        value={Math.round(prefs.zoom * 100)}
                        onChange={(e) => setPrefs((p) => ({ ...p, zoom: Number(e.target.value) / 100 }))}
                        aria-label="Zoom"
                    />
                    <button type="button" className="qw-btn" title="Zoom in (Ctrl+=)" onClick={() => zoomBy(ZOOM.step)}>+</button>
                    <button type="button" className="qw-btn" title="Reset zoom (Ctrl+0)" onClick={() => setPrefs((p) => ({ ...p, zoom: 1 }))}>
                        {Math.round(prefs.zoom * 100)}%
                    </button>
                </span>
            </footer>

            {ws.notice && (
                <div className="qw-toast" role="status">
                    <strong>{ws.notice.title}</strong>
                    <ul>{ws.notice.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                    <button type="button" className="qw-btn" onClick={() => ws.setNotice(null)}>OK</button>
                </div>
            )}

            {unsaved && (
                <UnsavedDialog names={unsaved.names} onSave={() => answer('save')} onDiscard={() => answer('discard')} onCancel={() => answer('cancel')} />
            )}

            {linkDialog && editor && (
                <LinkDialog
                    {...linkDialog}
                    onCancel={() => {
                        setLinkDialog(null);
                        editor.commands.focus();
                    }}
                    onRemove={() => {
                        setLinkDialog(null);
                        editor.chain().focus().extendMarkRange('link').unsetLink().run();
                    }}
                    onApply={(href, text) => {
                        setLinkDialog(null);
                        const c = editor.chain().focus();
                        if (text) c.insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }).run();
                        else c.extendMarkRange('link').setLink({ href }).run();
                    }}
                />
            )}

            {pageSetupOpen && active && (
                <PageSetupDialog pageSetup={active.draft.pageSetup} onApply={applyPageSetup} onCancel={() => setPageSetupOpen(false)} />
            )}
        </div>
    );
}
