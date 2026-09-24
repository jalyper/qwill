// Everything that differs between the Tauri desktop app and a plain browser
// (npm run dev, tests). The desktop path is the product; the browser path
// exists so the UI can be developed and tested without Rust.

export const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

const DOCX_FILTER = { name: 'Word Document', extensions: ['docx'] };
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const baseName = (path) => String(path).split(/[\\/]/).pop();
export const stripExt = (name) => name.replace(/\.docx$/i, '');

async function invoke(cmd, args, options) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    return tauriInvoke(cmd, args, options);
}

const toBytes = (data) => (data instanceof Uint8Array ? data : new Uint8Array(data));

/** Ask for a .docx to open. Returns { path, name, bytes } or null. */
export async function pickAndReadDocx() {
    if (isTauri()) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const picked = await open({ multiple: false, filters: [DOCX_FILTER] });
        if (!picked) return null;
        const path = typeof picked === 'string' ? picked : picked.path;
        return { path, name: stripExt(baseName(path)), bytes: await readDocx(path) };
    }
    const file = await browserPickFile('.docx');
    if (!file) return null;
    return { path: null, name: stripExt(file.name), bytes: new Uint8Array(await file.arrayBuffer()) };
}

export async function readDocx(path) {
    return toBytes(await invoke('read_document', { path }));
}

/** Ask where to save. Returns an absolute path or null (cancelled). */
export async function pickSavePath(suggestedName) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const safe = (suggestedName || 'Document').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Document';
    const path = await save({ defaultPath: `${safe}.docx`, filters: [DOCX_FILTER] });
    if (!path) return null;
    return /\.docx$/i.test(path) ? path : `${path}.docx`;
}

export async function writeDocx(path, bytes) {
    await invoke('write_document', toBytes(bytes), {
        headers: { 'x-path': encodeURIComponent(path) },
    });
}

/** Browser-only: hand the bytes to the user as a download. */
export function browserDownload(bytes, fileName, mime = DOCX_MIME) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function browserPickFile(accept) {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = () => resolve(input.files?.[0] || null);
        input.addEventListener('cancel', () => resolve(null));
        input.click();
    });
}

export async function launchDocumentPath() {
    if (!isTauri()) return null;
    try {
        return await invoke('launch_document');
    } catch {
        return null;
    }
}

export async function showError(message) {
    if (isTauri()) {
        try {
            const { message: show } = await import('@tauri-apps/plugin-dialog');
            await show(message, { title: 'Qwill', kind: 'error' });
            return;
        } catch {
            // fall through to the console
        }
    }
    console.error(message);
}

export async function setWindowTitle(title) {
    document.title = title;
    if (!isTauri()) return;
    try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().setTitle(title);
    } catch {
        // Title is cosmetic; never block on it.
    }
}

/**
 * Intercept window close so unsaved work can be handled first.
 * `shouldBlock()` says whether to stop and ask; `ask()` resolves true when
 * the window may close. Returns an unlisten function.
 */
export async function onCloseRequested({ shouldBlock, ask }) {
    if (!isTauri()) {
        const onBeforeUnload = (e) => {
            if (shouldBlock()) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    return win.onCloseRequested(async (event) => {
        if (!shouldBlock()) return;
        event.preventDefault();
        if (await ask()) await win.destroy();
    });
}
