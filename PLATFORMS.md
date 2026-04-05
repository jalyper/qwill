# Qwill — Desktop App (Tauri)

Qwill is a desktop word processor built with React and powered by [Tauri v2](https://v2.tauri.app). The frontend is React/Vite; the backend is Rust.

---

## Features

| Feature | Status |
|---------|--------|
| Rich text editing (bold, italic, headings, alignment, color) | Yes |
| Multiple documents with sidebar | Yes |
| Auto-save to localStorage | Yes |
| Themes (Light, Dark, Sepia, Midnight, Forest) | Yes |
| Page view with pagination | Yes |
| Font selection (8 fonts) | Yes |
| Font size selection | Yes |
| Open .docx files (native file dialog) | Yes |
| Save / Save As to filesystem (native dialog) | Yes |
| Export to DOCX | Yes |
| Export to PDF | Yes |
| PDF to DOCX conversion (Rust backend) | Yes |
| Zoom (Ctrl+=/Ctrl+-/Ctrl+0) | Yes |
| Offline — fully local, no internet needed | Yes |

## Known Issues

- **Cross-page text selection** — selecting text across page boundaries with mouse drag or Ctrl+A is confined to a single page. This is due to each page being a separate `contentEditable` element. Tracked by E2E tests in `e2e/cross-page-selection.spec.js`.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  React Frontend                   │
│  (Editor, Toolbar, Sidebar, Page, Themes, Hooks) │
│                                                   │
│  Vite dev server / bundled in production          │
└─────────────────────┬────────────────────────────┘
                      │ invoke() / plugins
              ┌───────▼────────┐
              │  Tauri (Rust)  │
              │                │
              │  Native FS     │
              │  File Dialogs  │
              │  PDF → DOCX    │
              │  (pdf-extract  │
              │   + docx-rs)   │
              └────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `src/components/Editor.jsx` | Main editor component, orchestrates all hooks |
| `src/components/Page.jsx` | Individual page with contentEditable |
| `src/hooks/useDesktopFileSystem.js` | Tauri file dialog + read/write via plugins |
| `src/hooks/useFileSystem.js` | localStorage-based document list management |
| `src/hooks/useAutoSave.js` | Debounced auto-save to localStorage |
| `src/hooks/useSnakePagination.js` | Multi-page content rebalancing |
| `src/hooks/useExport.js` | DOCX and PDF export |
| `src/utils/fileConversion.js` | HTML ↔ DOCX conversion (docx + mammoth) |
| `src/constants/themes.js` | Theme definitions |
| `src-tauri/src/commands/pdf_converter.rs` | Rust PDF text extraction + DOCX generation |

---

## Building

```bash
npm run tauri:dev    # Dev mode with hot reload
npm run tauri:build  # Production build with installer
npm test             # Run unit tests (Vitest)
npx playwright test  # Run E2E tests (Playwright)
```

Produces platform-specific installers in `src-tauri/target/release/bundle/`:
- **Windows:** NSIS installer (.exe) and MSI
- **macOS:** DMG and .app bundle
- **Linux:** AppImage and .deb

---

## Migration History

Qwill was originally built with Electron, then migrated to Tauri v2.

| Aspect | Electron (before) | Tauri v2 (now) |
|--------|----------|----------|
| Runtime | Bundled Chromium + Node.js | System webview + Rust |
| App size | ~150-200 MB | ~5-10 MB |
| Memory usage | ~150-300 MB | ~50-80 MB |
| Backend language | JavaScript (Node.js) | Rust |
| IPC | `ipcMain`/`ipcRenderer` | `tauri::command` + `invoke()` |
| PDF conversion | `pdf-parse` (Node) | `pdf-extract` (Rust) |
