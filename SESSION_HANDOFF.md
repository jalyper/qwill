# Qwill: session handoff

## START HERE (updated 2026-09-24, end of the rebuild session)

**State:** Qwill 2.0.0 is on `main`. The editor was rebuilt on TipTap (PR #3, merged, CI green on Ubuntu and Windows). What the app does is in README "What works"; how it works is in ARCHITECTURE.md; the release record is in CHANGELOG.md.

**Git:** `main` is the only live branch and matches GitHub. `wip/single-surface-editor` is an archive of the uncommitted April 2026 experiment (one contenteditable with lines drawn over it). Keep it for reference; don't merge it. Merged feature branches were deleted after merging (their commits and PRs #1–#3 hold the history).

**Verify before trusting anything:**
```bash
npm run check        # lint + 19 unit + build + 9 Playwright E2E
npm run test:rust    # 4 Rust tests
```
Check editing behaviour in a browser, not only in unit tests. The 1.x suite was green while the app deleted text.

**Setup gotchas**
- Use `npx npm@11 install`. npm 10.9 crashes resolving this dependency tree (`Cannot read properties of null (reading 'edgesOut')`). npm 11 skips esbuild's postinstall, which is harmless.
- The Rust `tauri` crate and `@tauri-apps/api` must be on the same minor version or `tauri build` refuses (both 2.11 now). After bumping one, `cargo update -p tauri` in `src-tauri`.

## What was verified, and what was not

Verified this session:
- Browser build: the Playwright suite (typing across pages, page geometry, cross-page selection, drafts across reload, .docx open → edit → save, find/replace, page setup, migration, close prompt). It passed 3 repeated runs.
- Real Windows desktop app, driven over CDP: opening a .docx from the command line (non-ASCII path), editing, Ctrl+S to the same file (atomic write, no temp file left), the close prompt → Save → exit, a second launch forwarding its file to the running window, and drafts written under app data.
- CI: the same tests plus a full Tauri build on a clean Windows runner.

Not verified:
- Printed or PDF output (the print dialog can't be driven automatically). Open Print / Save as PDF by hand once and check the page breaks match the screen.
- The installer, and the `.docx` file association it registers (`tauri build` bundles were not built or run).
- Convert PDF to Word in 2.0 (the Rust command is unchanged from 1.x; the new flow opens the result in a tab).
- macOS and Linux.
- Real Word-authored files. The round-trip tests use files generated with the `docx` library.

## Driving the real desktop app

1. `npx tauri build --debug --no-bundle`
2. Launch `src-tauri/target/debug/qwill.exe <file.docx>` with the env var `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`. Opening a file via the command line avoids native dialogs.
3. From Node: `chromium.connectOverCDP('http://127.0.0.1:9333')` (Playwright), then use `contexts()[0].pages()[0]`.
4. To test the close prompt: `(Get-Process qwill).CloseMainWindow()` in PowerShell.

⚠ This uses the real app-data folders `%APPDATA%\com.qwill.app` (drafts, workspace) and `%LOCALAPPDATA%\com.qwill.app` (WebView profile). Back them up first and restore afterwards. A backup of the pre-2.0 profile is in `Documents\qwill-backups\webview-profile-2026-09-24`. Its old documents were written under the dev server's origin (`localhost:5173`), which built apps don't read, so they are not migrated. They look like test data ("asdf").

## Next, in priority order

1. **Hand-check printing** (see "Not verified"). It's cheap and could surface a real bug.
2. **Headers and footers:** editable header/footer text per document (currently only page numbers), imported and exported. This is the importer's most common warning.
3. **Real-world .docx corpus:** Word-authored files (resumes, reports, templates) in `e2e/fixtures/`, with tests asserting import warnings and round-trip stability.
4. **Tables across pages:** break between rows and repeat header rows. This needs row-level units in `pagination/measure.js` and a spacer that works inside `<tbody>`.
5. **Footnotes, endnotes, comments:** import, show, edit, export.
6. **Build and test the installer**, including the file association and signing.
7. **Direct PDF export** without the print dialog (WebView2 `PrintToPdf` via `with_webview` on Windows).
8. **Styles pane** to edit the document's Normal and Heading styles (`docStyles.js` supports it; there's no UI yet).
9. Widow/orphan control and "keep with next" for headings in `pagination/layout.js`.
10. macOS and Linux builds.

## Decisions worth knowing

- One contenteditable plus spacer widgets for pages, not one editor per page. The per-page design is what lost text.
- `.docx` is the only file format. Drafts in app data are crash recovery, not a second format.
- Document I/O goes through two Rust commands restricted to `.docx`, not the fs plugin, because dialog-granted scopes don't survive a restart.
- Base styles live in each document (from the imported file), not in app CSS.
