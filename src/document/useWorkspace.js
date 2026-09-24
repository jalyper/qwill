import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { readJson, writeJson, removeJson } from './store';
import {
    baseName,
    browserDownload,
    isTauri,
    launchDocumentPath,
    pickAndReadDocx,
    pickSavePath,
    readDocx,
    showError,
    stripExt,
    writeDocx,
} from './platform';
import { DEFAULT_PAGE_SETUP } from './pageSetup';

// Open documents, their drafts, and the recent-files list.
//
// The source of truth for a saved document is its .docx on disk. Every open
// document also has a draft in app data, written a moment after each edit,
// so a crash or a closed window never loses work; the draft is what gets
// restored on the next launch. "dirty" means the draft has changes the file
// on disk does not.

const WORKSPACE = 'state/workspace.json';
const draftPath = (id) => `state/drafts/${id}.json`;
const DRAFT_DELAY_MS = 600;
const MAX_RECENT = 12;

const emptyDraft = () => ({ content: null, pageSetup: { ...DEFAULT_PAGE_SETUP }, styles: null });

function nextUntitledName(docs) {
    let n = 1;
    for (const d of docs) {
        const m = !d.path && d.name.match(/^Untitled (\d+)$/);
        if (m) n = Math.max(n, Number(m[1]) + 1);
    }
    return `Untitled ${n}`;
}

/** Documents from the pre-rebuild Qwill, which kept HTML in localStorage. */
function legacyDocuments() {
    try {
        const list = JSON.parse(localStorage.getItem('qwill-file-list') || '[]');
        return list
            .map((f) => ({ ...f, html: localStorage.getItem(`qwill-content-${f.id}`) || '' }))
            .filter((f) => f.html.replace(/<[^>]*>/g, '').trim());
    } catch {
        return [];
    }
}

export function useWorkspace() {
    const [ready, setReady] = useState(false);
    const [docs, setDocs] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [recent, setRecent] = useState([]);
    const [draftError, setDraftError] = useState(false);
    const [notice, setNotice] = useState(null); // { title, lines } shown after open

    // Latest values for async callbacks.
    const latest = useRef({ docs, activeId });
    useLayoutEffect(() => {
        latest.current = { docs, activeId };
    });
    const drafts = useRef(new Map()); // id -> latest draft (in memory)
    const timers = useRef(new Map());
    const liveContent = useRef(null); // () => { id, content } for the mounted editor

    // ---- persistence ----------------------------------------------------

    useEffect(() => {
        if (!ready) return;
        writeJson(WORKSPACE, {
            version: 1,
            docs: docs.map(({ id, name, path, dirty, updatedAt }) => ({ id, name, path, dirty, updatedAt })),
            activeId,
            recent,
        });
    }, [ready, docs, activeId, recent]);

    const writeDraft = useCallback(async (id) => {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        // The mounted editor holds the newest content; serialise it only now
        // (not on every keystroke).
        const live = liveContent.current?.();
        if (live && live.id === id) {
            drafts.current.set(id, { ...(drafts.current.get(id) || {}), content: live.content, html: undefined });
        }
        const draft = drafts.current.get(id);
        if (!draft) return true;
        const ok = await writeJson(draftPath(id), draft);
        setDraftError(!ok);
        return ok;
    }, []);

    const flushDrafts = useCallback(async () => {
        await Promise.all([...timers.current.keys()].map((id) => writeDraft(id)));
    }, [writeDraft]);

    const hasPendingWrites = useCallback(() => timers.current.size > 0, []);

    const updateDoc = useCallback((id, patch) => {
        setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    }, []);

    // ---- documents ------------------------------------------------------

    const addDocument = useCallback(async (meta, draft) => {
        const doc = { id: uuid(), updatedAt: Date.now(), dirty: false, ...meta };
        drafts.current.set(doc.id, draft);
        await writeJson(draftPath(doc.id), draft);
        setDocs((prev) => [...prev, doc]);
        setActiveId(doc.id);
        return doc.id;
    }, []);

    const newDocument = useCallback(
        () => addDocument({ name: nextUntitledName(latest.current.docs), path: null }, emptyDraft()),
        [addDocument],
    );

    const rememberRecent = useCallback((path, name) => {
        if (!path) return;
        setRecent((prev) => [{ path, name, openedAt: Date.now() }, ...prev.filter((r) => r.path !== path)].slice(0, MAX_RECENT));
    }, []);

    const openBytes = useCallback(async ({ path, name, bytes }) => {
        const { importDocx } = await import('../docx/importDocx');
        const imported = await importDocx(bytes);
        const id = await addDocument(
            { name, path },
            { content: imported.content, pageSetup: imported.pageSetup, styles: imported.styles },
        );
        rememberRecent(path, name);
        if (imported.warnings.length) setNotice({ title: `Opened “${name}” with some limits`, lines: imported.warnings });
        return id;
    }, [addDocument, rememberRecent]);

    const findOpen = (path) => latest.current.docs.find((d) => d.path && d.path.toLowerCase() === path.toLowerCase());

    const openPath = useCallback(async (path) => {
        const existing = findOpen(path);
        if (existing) {
            setActiveId(existing.id);
            return existing.id;
        }
        try {
            return await openBytes({ path, name: stripExt(baseName(path)), bytes: await readDocx(path) });
        } catch (err) {
            await showError(String(err?.message || err));
            return null;
        }
    }, [openBytes]);

    const openDialog = useCallback(async () => {
        try {
            const picked = await pickAndReadDocx();
            if (!picked) return null;
            const existing = picked.path && findOpen(picked.path);
            if (existing) {
                setActiveId(existing.id);
                return existing.id;
            }
            return await openBytes(picked);
        } catch (err) {
            await showError(String(err?.message || err));
            return null;
        }
    }, [openBytes]);

    const loadDraft = useCallback(async (id) => {
        if (drafts.current.has(id)) return drafts.current.get(id);
        const draft = (await readJson(draftPath(id))) || emptyDraft();
        drafts.current.set(id, draft);
        return draft;
    }, []);

    /**
     * Record an edit: merge `patch` (may be null for "content changed") into
     * the draft, mark the document dirty, and write the draft soon.
     */
    const updateDraft = useCallback((id, patch) => {
        if (patch) drafts.current.set(id, { ...(drafts.current.get(id) || {}), ...patch });
        const doc = latest.current.docs.find((d) => d.id === id);
        if (doc && !doc.dirty) updateDoc(id, { dirty: true, updatedAt: Date.now() });
        clearTimeout(timers.current.get(id));
        timers.current.set(id, setTimeout(() => writeDraft(id), DRAFT_DELAY_MS));
    }, [updateDoc, writeDraft]);

    const setLiveContentSource = useCallback((fn) => {
        liveContent.current = fn;
    }, []);

    /** The draft with the mounted editor's current content folded in. */
    const currentDraft = useCallback((id) => {
        const draft = drafts.current.get(id) || emptyDraft();
        const live = liveContent.current?.();
        return live && live.id === id ? { ...draft, content: live.content, html: undefined } : draft;
    }, []);

    /**
     * Save to the .docx on disk (Save As when there is no path yet or
     * `saveAs`). Returns true when the document is now saved.
     */
    const save = useCallback(async (id, { saveAs = false, suggestedName } = {}) => {
        const doc = latest.current.docs.find((d) => d.id === id);
        if (!doc) return false;
        const draft = currentDraft(id);
        try {
            const { exportDocx } = await import('../docx/exportDocx');
            const bytes = await exportDocx(draft.content || { type: 'doc', content: [] }, {
                pageSetup: draft.pageSetup,
                styles: draft.styles,
                title: doc.name,
            });
            if (!isTauri()) {
                browserDownload(bytes, `${doc.path ? doc.name : suggestedName || doc.name}.docx`);
                updateDoc(id, { dirty: false });
                return true;
            }
            let path = !saveAs && doc.path ? doc.path : null;
            if (!path) {
                path = await pickSavePath(doc.path ? doc.name : suggestedName || doc.name);
                if (!path) return false;
            }
            await writeDocx(path, bytes);
            const name = stripExt(baseName(path));
            updateDoc(id, { path, name, dirty: false, updatedAt: Date.now() });
            rememberRecent(path, name);
            drafts.current.set(id, draft);
            await writeDraft(id);
            return true;
        } catch (err) {
            await showError(String(err?.message || err));
            return false;
        }
    }, [currentDraft, rememberRecent, updateDoc, writeDraft]);

    /** Close without asking; callers handle the unsaved-changes prompt. */
    const closeDocument = useCallback(async (id) => {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        drafts.current.delete(id);
        await removeJson(draftPath(id));
        const { docs: all, activeId: active } = latest.current;
        const index = all.findIndex((d) => d.id === id);
        const remaining = all.filter((d) => d.id !== id);
        latest.current = { docs: remaining, activeId: active };
        setDocs(remaining);
        if (!remaining.length) {
            await newDocument();
        } else if (active === id) {
            setActiveId(remaining[Math.max(0, index - 1)].id);
        }
    }, [newDocument]);

    const forgetRecent = useCallback((path) => setRecent((prev) => prev.filter((r) => r.path !== path)), []);

    // ---- startup --------------------------------------------------------

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const saved = await readJson(WORKSPACE);
            if (cancelled) return;
            const restored = saved?.docs ? [...saved.docs] : [];
            if (!saved) {
                // First run of this version: bring over old documents.
                for (const legacy of legacyDocuments()) {
                    const id = uuid();
                    const draft = { ...emptyDraft(), html: legacy.html };
                    drafts.current.set(id, draft);
                    await writeJson(draftPath(id), draft);
                    restored.push({ id, name: legacy.name || 'Untitled', path: null, dirty: true, updatedAt: legacy.lastModified || Date.now() });
                }
            }
            latest.current = { docs: restored, activeId: null };
            setDocs(restored);
            setRecent(saved?.recent || []);
            setActiveId(restored.find((d) => d.id === saved?.activeId)?.id || restored[0]?.id || null);
            setReady(true);

            const launch = await launchDocumentPath();
            if (launch) await openPath(launch);
            else if (!restored.length) await newDocument();
        })();
        return () => {
            cancelled = true;
        };
        // Startup runs once; the callbacks it uses are stable.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        ready,
        docs,
        activeId,
        activeDoc: docs.find((d) => d.id === activeId) || null,
        recent,
        draftError,
        notice,
        setNotice,
        setActiveId,
        newDocument,
        openDialog,
        openPath,
        loadDraft,
        updateDraft,
        flushDrafts,
        hasPendingWrites,
        setLiveContentSource,
        save,
        closeDocument,
        forgetRecent,
    };
}
