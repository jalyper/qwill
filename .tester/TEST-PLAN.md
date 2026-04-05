# Test Plan — Qwill Core Modules

**Branch:** test/unit-tests
**Framework:** Vitest
**Test Location:** src/__tests__/

---

## Test File 1: `src/__tests__/fileConversion.test.js`

**Covers:** `src/utils/fileConversion.js` — htmlToDocx, docxToHtml

### Test Cases

| # | Test Name | Verifies | Category |
|---|-----------|----------|----------|
| 1 | htmlToDocx returns a Blob | Basic output type | unit |
| 2 | htmlToDocx handles empty HTML | Edge case — empty input | edge-case |
| 3 | htmlToDocx preserves bold formatting | Bold text runs in DOCX output | unit |
| 4 | htmlToDocx preserves italic formatting | Italic text runs in DOCX output | unit |
| 5 | htmlToDocx handles headings (h1, h2, h3) | Heading paragraph styles | unit |
| 6 | htmlToDocx strips page-break elements | Page breaks removed before conversion | unit |
| 7 | htmlToDocx handles nested formatting (bold+italic) | Combined styles propagate | edge-case |
| 8 | docxToHtml converts valid DOCX buffer to HTML string | Roundtrip integrity | unit |
| 9 | docxToHtml returns empty string on invalid input | Error handling | error-handling |
| 10 | Roundtrip: htmlToDocx → docxToHtml preserves text content | Full cycle fidelity | integration |

**Mocking:** Need jsdom DOMParser (Vitest jsdom environment). No external mocks needed — uses real `docx` and `mammoth` libraries.

**Setup:** Configure vitest with `environment: 'jsdom'` for this file.

---

## Test File 2: `src/__tests__/useFileSystem.test.js`

**Covers:** `src/hooks/useFileSystem.js` — createNewFile, updateFileMeta, deleteFile, localStorage persistence

### Test Cases

| # | Test Name | Verifies | Category |
|---|-----------|----------|----------|
| 1 | createNewFile adds a file with UUID id | File creation | unit |
| 2 | createNewFile sets name to 'Untitled' | Default naming | unit |
| 3 | createNewFile prepends new file to list | Ordering (newest first) | unit |
| 4 | createNewFile persists to localStorage | Storage write | unit |
| 5 | updateFileMeta updates name for given id | Metadata update | unit |
| 6 | updateFileMeta re-sorts by lastModified desc | Sort order maintained | unit |
| 7 | deleteFile removes file from list | Deletion | unit |
| 8 | deleteFile removes content from localStorage | Storage cleanup | unit |
| 9 | deleteFile switches activeFileId when deleting active file | Active file fallback | edge-case |
| 10 | deleteFile creates new file when deleting last file | Always-one-file invariant | edge-case |
| 11 | Initial load parses files from localStorage | Hydration | unit |
| 12 | Initial load migrates legacy 'qwill-content' key | Legacy migration | edge-case |
| 13 | Initial load handles corrupted localStorage gracefully | Error recovery | error-handling |

**Mocking:** Mock `localStorage` (jsdom provides this). Mock `uuid` to return predictable IDs.

**Setup:** `@testing-library/react` with `renderHook` for testing the hook.

---

## Test File 3: `src/__tests__/useAutoSave.test.js`

**Covers:** `src/hooks/useAutoSave.js` — debounced save, status tracking, localStorage read/write

### Test Cases

| # | Test Name | Verifies | Category |
|---|-----------|----------|----------|
| 1 | Loads saved content from localStorage on mount | Initial hydration | unit |
| 2 | Returns empty string when no saved content exists | Default state | unit |
| 3 | Sets status to 'saving' when content changes | Status tracking | unit |
| 4 | Saves to localStorage after 1s debounce | Debounced write | unit |
| 5 | Sets status to 'saved' after save completes | Status lifecycle | unit |
| 6 | saveNow writes immediately without waiting for debounce | Manual save | unit |
| 7 | Calls onSaveCallback with fileId and metadata | Callback invocation | unit |
| 8 | Does not save when fileId is null | Guard clause | edge-case |
| 9 | Clears pending timeout on unmount | Cleanup | unit |
| 10 | Reloads content when fileId changes | File switching | unit |

**Mocking:** Mock `localStorage`. Use Vitest fake timers for debounce testing.

**Setup:** `@testing-library/react` with `renderHook`. Vitest fake timers.

---

## Test File 4: `src/__tests__/themes.test.js`

**Covers:** `src/constants/themes.js` — theme data structure integrity

### Test Cases

| # | Test Name | Verifies | Category |
|---|-----------|----------|----------|
| 1 | Exports a non-empty array | Basic export | unit |
| 2 | Each theme has required fields (id, name, colors) | Schema validation | unit |
| 3 | Each theme has all required CSS custom properties | Color completeness | unit |
| 4 | All theme IDs are unique | No duplicates | edge-case |
| 5 | First theme is 'light' (default) | Default ordering | unit |
| 6 | Color values are valid CSS color strings | Format validation | unit |

**Mocking:** None needed — pure data.

---

## Test File 5: `src/__tests__/pdfConverter.test.js`

**Covers:** `electron/pdf-converter.cjs` — convertPdfToDocx

### Test Cases

| # | Test Name | Verifies | Category |
|---|-----------|----------|----------|
| 1 | Converts a valid PDF buffer to DOCX file | Happy path | unit |
| 2 | Output DOCX contains text from PDF | Content extraction | unit |
| 3 | Splits PDF text by newlines into paragraphs | Paragraph structure | unit |
| 4 | Throws on non-existent file path | Error handling | error-handling |
| 5 | Throws on invalid/corrupt PDF data | Error handling | error-handling |

**Mocking:** Mock `fs` (readFileSync, writeFileSync) and `pdf-parse`. Test the logic, not I/O.

**Setup:** This is a CJS Node module — test with Vitest Node environment.

---

## Coverage Goals

| Source File | Functions Covered | Test Count |
|-------------|-------------------|------------|
| fileConversion.js | htmlToDocx, docxToHtml | 10 |
| useFileSystem.js | createNewFile, updateFileMeta, deleteFile, init | 13 |
| useAutoSave.js | load, save, debounce, saveNow, callback | 10 |
| themes.js | data integrity | 6 |
| pdf-converter.cjs | convertPdfToDocx | 5 |
| **Total** | | **44** |

### Intentionally Excluded
- **Components (Editor, Toolbar, Sidebar, Page)** — UI rendering, best covered by E2E/Playwright
- **usePagination / useSnakePagination** — DOM measurement dependent (offsetHeight, scrollHeight), needs browser environment
- **useElectronFileSystem** — Electron IPC dependent, needs integration test setup
- **useExport** — Wraps fileConversion + browser download trigger, covered indirectly
- **IntegrationTests.jsx** — Existing test harness, not production code

### Dependencies to Install
```
npm install -D vitest @testing-library/react @testing-library/react-hooks jsdom
```
