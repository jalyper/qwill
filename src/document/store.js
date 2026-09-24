import { isTauri } from './platform';

// Small JSON store for Qwill's own state: the workspace index and one draft
// file per open document. Desktop: files under the app-data folder (no size
// cap, survives webview storage resets). Browser: localStorage.
//
// Writes report failure (returns false) instead of throwing, so autosave can
// tell the user their work is not being kept rather than failing silently.

const LS_PREFIX = 'qwill:';

async function fs() {
    return import('@tauri-apps/plugin-fs');
}

export async function readJson(rel) {
    try {
        if (isTauri()) {
            const { readTextFile, exists, BaseDirectory } = await fs();
            const opts = { baseDir: BaseDirectory.AppData };
            if (!(await exists(rel, opts))) return null;
            return JSON.parse(await readTextFile(rel, opts));
        }
        const raw = localStorage.getItem(LS_PREFIX + rel);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        console.error(`Could not read ${rel}:`, err);
        return null;
    }
}

export async function writeJson(rel, value) {
    const text = JSON.stringify(value);
    try {
        if (isTauri()) {
            const { writeTextFile, rename, mkdir, exists, BaseDirectory } = await fs();
            const baseDir = BaseDirectory.AppData;
            const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
            if (!(await exists(dir, { baseDir }))) await mkdir(dir, { baseDir, recursive: true });
            // Temp + rename: a crash mid-write keeps the previous draft.
            const tmp = `${rel}.tmp`;
            await writeTextFile(tmp, text, { baseDir });
            await rename(tmp, rel, { oldPathBaseDir: baseDir, newPathBaseDir: baseDir });
        } else {
            localStorage.setItem(LS_PREFIX + rel, text);
        }
        return true;
    } catch (err) {
        console.error(`Could not write ${rel}:`, err);
        return false;
    }
}

export async function removeJson(rel) {
    try {
        if (isTauri()) {
            const { remove, exists, BaseDirectory } = await fs();
            const opts = { baseDir: BaseDirectory.AppData };
            if (await exists(rel, opts)) await remove(rel, opts);
        } else {
            localStorage.removeItem(LS_PREFIX + rel);
        }
    } catch (err) {
        console.error(`Could not remove ${rel}:`, err);
    }
}
