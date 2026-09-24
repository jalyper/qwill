# Qwill

**An open-source desktop word processor that edits `.docx` files directly, on real pages, fully offline.**

Built with React 19, [TipTap](https://tiptap.dev) / ProseMirror, and Tauri 2. The goal is a Microsoft Word replacement for everyday writing: open a Word file, edit it on pages that break like Word's, save it back as a Word file.

![Qwill](Qwill.png)

## What works

**Writing and formatting**
- Paragraph styles (Normal, Heading 1–4, Quote, Code), fonts and point sizes per selection
- Bold, italic, underline, strikethrough, superscript, subscript, text color, highlight, clear formatting
- Alignment (left, center, right, justify), line spacing, space before/after, indent/outdent, hanging indents
- Bulleted and numbered lists (nested, custom start number)
- Tables (insert, add/remove rows and columns, merge/split cells, header rows, resizable columns)
- Pictures (PNG, JPEG, GIF, BMP; resizable), links, horizontal lines, page breaks (Ctrl+Enter)
- Find and replace (match case, whole words) across the whole document
- Undo/redo, word count, spell check as you type, zoom

**Pages**
- One continuous document laid out on pages: text flows onto the next page mid-paragraph the way Word does it; selection, copy, undo and find work across pages
- Page setup per document: Letter, Legal, A4, A5, or the document's own size; portrait or landscape; margins; page numbers
- Print / Save as PDF uses the same page breaks you see on screen

**Files**
- `.docx` is the file format; there is no hidden internal copy. **Save** writes the file you opened; **Save As** picks a new one
- Imported documents keep their fonts, sizes, colors, alignment, spacing, indents, lists, tables, pictures, links, page size and margins. Qwill resolves Word's style inheritance and tells you when a document uses something it cannot show yet (see below)
- Saving is atomic (temp file + rename), so a crash mid-save never corrupts the document
- Every open document is also autosaved as a draft; after a crash or a closed window, your work is restored on the next launch
- Tabs for open documents, recent files, a Word-style "Save changes?" prompt when closing
- Open a `.docx` from Explorer ("Open with", or double-click once Qwill is the default app): if Qwill is already running, the file opens in a new tab of that window
- Convert PDF to Word (text only)

## Known limitations

These are reported in the app when you open a document that uses them:
- Header and footer text (page numbers work), footnotes and endnotes, comments
- Tracked changes are accepted when opening
- Floating pictures are placed in line with the text; linked pictures and EMF/WMF/SVG pictures are skipped
- Multiple sections with different page setups (the last section's setup is used)

Also: tables taller than a page do not split across pages yet, and older `.doc` files are not supported. The desktop app has only been tested on Windows so far; macOS and Linux builds should work but are unverified (printing in particular depends on the platform webview).

## Running

Requires Node.js 22+ and, for the desktop app, the [Rust toolchain](https://rustup.rs) plus the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri:dev      # the desktop app (first run compiles the Rust side)
npm run dev            # browser-only UI development at http://localhost:5173
npm run tauri:build    # installers in src-tauri/target/release/bundle/
```

The browser mode is for developing the UI: documents are kept in localStorage, Open uses a file picker, and Save downloads a `.docx`.

## Testing

```bash
npm test               # unit tests: .docx round trip, pagination layout math
npm run test:e2e       # Playwright: typing across pages, selection, open/save, find, page setup, ...
npm run test:rust      # Rust: atomic save, path handling
npm run check          # lint + unit + build + E2E
```

CI runs all of these on every push and pull request (`.github/workflows/ci.yml`).

## How it fits together

See [ARCHITECTURE.md](ARCHITECTURE.md). Release history is in [CHANGELOG.md](CHANGELOG.md); current status and next steps are in [SESSION_HANDOFF.md](SESSION_HANDOFF.md).

## License

MIT, see [LICENSE](LICENSE).
