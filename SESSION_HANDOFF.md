# Qwill: session handoff

## START HERE (updated 2026-09-24)

**State:** the editor was rebuilt and merged to `main` (PR #3, CI green on Ubuntu and Windows). Everything in README "What works" is implemented and verified: unit tests, a 9-test Playwright suite (stable over 3 repeats), and the real Tauri app on Windows driven over CDP (open from command line with a Unicode path, edit, Ctrl+S to the same file, close prompt → Save → exit, second launch forwarded to the running window).

**Verify before trusting anything:** `npm run check` (lint, unit, build, E2E) and `npm run test:rust`. Behaviour claims about editing must be checked in a browser, not only in unit tests. The old suite was green while the app deleted text.

**Driving the real desktop app:** build `npx tauri build --debug --no-bundle`, launch `src-tauri/target/debug/qwill.exe <file.docx>` with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, then `chromium.connectOverCDP('http://127.0.0.1:9333')` from Playwright. Opening via a command-line path avoids native dialogs. Close the window with `(Get-Process qwill).CloseMainWindow()` to exercise the close prompt. ⚠ This uses the real app-data folders (`%APPDATA%\com.qwill.app`, `%LOCALAPPDATA%\com.qwill.app`); back them up first. A pre-rebuild profile backup is in `Documents\qwill-backups\webview-profile-2026-09-24`.

In dev builds the active editor is on `window.__qwillEditor`.

## Next, in priority order

1. **Headers and footers**: editable header/footer text per document (currently only page numbers), imported and exported. This is the most common thing the importer warns about.
2. **Tables across pages**: a table taller than the remaining space moves whole to the next page, and one taller than a page overflows. Break between rows (repeat header rows), which needs row-level units in `measure.js` and a spacer strategy that works inside `<tbody>`.
3. **Footnotes / endnotes and comments**: import, show, edit, export.
4. **Real-world .docx corpus**: collect Word-authored files (resumes, reports, templates) into `e2e/fixtures/` and assert import warnings + round-trip stability. The current round-trip tests use `docx`-library-generated files.
5. **Direct PDF export** without the print dialog (WebView2 `PrintToPdf` on Windows via `with_webview`).
6. **Styles pane**: edit the document's Normal/Heading styles (the data model, `docStyles.js`, already supports it; there is no UI yet).
7. Widow/orphan control and "keep with next" for headings in `pagination/layout.js`.
8. macOS/Linux: build and smoke-test; printing depends on the platform webview.

## Decisions worth knowing

- One contenteditable + spacer widgets for pages (not one editor per page): the per-page design is what lost text.
- `.docx` is the only file format; drafts in app data are crash recovery, not a second format.
- Document I/O is through two Rust commands restricted to `.docx`, not the fs plugin (scopes don't survive restarts).
- Base styles live in the document (from the imported file), not in app CSS.
