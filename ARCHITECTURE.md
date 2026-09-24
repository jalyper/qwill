# Qwill architecture

```
┌──────────────────────────── React (src/) ────────────────────────────┐
│ components/AppShell   tabs, File menu, shortcuts, close prompt        │
│ components/Toolbar    formatting controls (reads editor state)        │
│ components/DocumentView   pages + the TipTap editor for one document  │
│                                                                       │
│ editor/        schema + behaviour (TipTap extensions)                 │
│   pagination/  page breaks as spacer widgets (see below)              │
│ document/      workspace (open docs, drafts, recent), page setup,     │
│                base styles, platform layer (Tauri vs browser)         │
│ docx/          .docx reader and writer                                │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ invoke() / plugins
┌───────────────────────── Rust (src-tauri/) ───────────────────────────┐
│ read_document / write_document   user files, .docx only, atomic save  │
│ launch_document + single-instance   "Open with Qwill" / double-click  │
│ convert_pdf_to_docx              PDF text → .docx                     │
│ plugins: dialog (open/save/ask), fs (app-data folder only)            │
└───────────────────────────────────────────────────────────────────────┘
```

## The document model

A document is ProseMirror JSON produced by the extensions in `src/editor/extensions.js`. The same list builds the schema headlessly (`getSchema(createExtensions())`) for the `.docx` converters and tests; only the pagination extension needs a DOM.

Beyond TipTap's stock nodes and marks, Qwill adds:

| Extension | What it adds |
|---|---|
| `ParagraphFormat.js` | `lineHeight` (multiple), `spaceBefore`/`spaceAfter` (pt), `indent`/`firstLine` (pt, negative = hanging) on paragraphs and headings |
| `PageBreak.js` | `pageBreak` block node (Ctrl+Enter) |
| `FindReplace.js` | find/replace plugin with match decorations |
| `pagination/` | page layout |

Each document also carries **page setup** (`document/pageSetup.js`: paper, orientation, margins in inches, page numbers) and **base styles** (`document/docStyles.js`: what Normal and Heading 1–6 look like). Base styles are per document because Word documents bring their own (Times 12pt single-spaced, say); the page renders them as CSS variables.

## Pagination

The document is one `contenteditable`, so selection, undo and find span pages with no special cases. Pages are drawn behind it by React, and page breaks are **spacer widgets**: blank block elements inserted at a line start (inside a paragraph) or between blocks, sized so the next line lands on the next page's top margin.

Each pass (`pagination/Pagination.js`, scheduled per animation frame after any change, resize or font load):

1. Hide the spacers (`.qw-measuring` on the editor host) so the DOM shows the true continuous layout.
2. Measure every line (`measure.js`: text-fragment rects grouped into lines; tables and images as single units).
3. Compute breaks (`layout.js`, pure and unit-tested): break before the first line whose bottom crosses the page's content height.
4. Show the spacers. If the breaks changed, dispatch new decorations (never added to undo history).

This works because spacers are placed where lines already wrap, so they never change wrapping, and because the editor root is a flex column, so margins never collapse and every spacer shifts content by exactly its height. Print reuses the same breaks: in print CSS each spacer becomes `break-before: page`.

## Files, drafts and the workspace

`document/useWorkspace.js` owns the open documents.

- The **source of truth** for a saved document is its `.docx`. Save exports the current editor content and writes it with `write_document` (Rust: temp file + rename).
- Every open document also has a **draft** (`state/drafts/<id>.json` in the app-data folder: content, page setup, styles), written 600 ms after the last edit and flushed when the window hides or closes. `dirty` means the draft has changes the file lacks. Drafts are what get restored after a crash.
- `state/workspace.json` holds the open-document list, the active document and recent files.
- In the browser build (`npm run dev`) the same store uses localStorage, Open uses a file input and Save downloads.

Document files go through Rust commands rather than the fs plugin because a recent file must reopen after a restart, when the file-dialog scope is gone; the commands only accept absolute paths ending in `.docx`. The fs plugin is limited to the app-data folder (`src-tauri/capabilities/default.json`).

## .docx

`docx/exportDocx.js` maps every node and mark to the [`docx`](https://www.npmjs.com/package/docx) library: paragraph properties, run properties, numbering (one instance per list, nested lists share it), tables with spans and widths, inline images, hyperlinks, page breaks, section page size and margins, a page-number footer, and the document's base styles as Word's default and heading styles.

`docx/importDocx.js` reads OOXML directly with JSZip and DOMParser. It resolves Word's formatting inheritance (document defaults → Normal → paragraph style chain → character style → direct formatting) and records whatever differs from the document's base styles as attributes and marks. Anything it cannot represent is reported as a warning in the app.

`src/__tests__/docxRoundTrip.test.js` builds a document with every construct the editor supports, exports it, imports it, and requires an identical result.

## Themes

`constants/themes.js` colors the app chrome and the page background. Dark themes set `data-dark` on the root, and `styles/document.css` then lightens the document's own heading and link colors on screen only (like Word's dark mode). The file keeps its real colors, and print CSS ignores the adjustment. Highlighted text is always drawn dark.

## Debugging

In dev builds (`npm run dev` / `tauri dev`) the active editor is exposed as `window.__qwillEditor`, so scripts and the console can inspect or drive it. Production builds don't expose it.

## Tests

| Command | What it covers |
|---|---|
| `npm test` | `.docx` round trip and Word-authored structure; pagination layout math |
| `npm run test:e2e` | Playwright against the dev server: typing across pages never loses text, lines stay inside page margins, cross-page selection and copy, drafts survive reload, open → edit → save `.docx`, find & replace, page setup, migration of pre-rebuild documents, close prompt |
| `npm run test:rust` | atomic save, path decoding, argument parsing |

## History

Qwill started as an Electron app, moved to Tauri 2 in April 2026, and was rebuilt in September 2026. The original editor used one `contenteditable` per page with a "snake" rebalancing hook; it lost and reordered text once a document reached a second page, and its `.docx` round trip (mammoth + a small writer) kept only bold, italic and headings. The rebuild replaced the editing core with TipTap, pagination with spacer widgets, localStorage documents with files on disk, and mammoth with the reader above.
