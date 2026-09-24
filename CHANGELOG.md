# Changelog

## 2.0.0 (2026-09-24)

A rebuild of the editor after an audit found the 1.x editor lost and reordered text once a document reached page 2, opened `.docx` files as blank pages, and kept only bold, italic and headings through a `.docx` round trip. PR #3.

**Editor**
- TipTap/ProseMirror core: one document laid out on pages, paragraphs split across pages like Word; selection, copy, undo and find span pages.
- Paragraph styles, per-selection fonts and point sizes, underline, strikethrough, superscript, subscript, color, highlight, alignment, line and paragraph spacing, indents, lists, tables, pictures, links, page breaks, find and replace, word count, spell check, zoom.
- Page setup per document (paper, orientation, margins, page numbers); print / save as PDF with the on-screen page breaks.

**Files**
- `.docx` is the file format. Save writes the opened file atomically; Save As; recent files; tabs; "Save changes?" prompt on close.
- Drafts autosaved to the app-data folder and restored after a crash; 1.x documents migrated from localStorage.
- New `.docx` reader that resolves Word's style inheritance and reports unsupported features; writer covers every editor construct.
- Single instance: opening a `.docx` while Qwill runs opens it in the running window.

**Project**
- Content security policy; fs plugin limited to app data; npm audit clean.
- Unit, Playwright end-to-end and Rust tests; GitHub Actions CI on Ubuntu and Windows.
- Removed mammoth, html2pdf.js, date-fns and the per-page editor.

## 1.x

- 2026-04-09: README rewrite, dependency security patches, LICENSE (PR #2).
- 2026-04-04: migrated from Electron to Tauri 2; 43 unit tests (PR #1).
- 2025-11-25/26: first versions (React + Vite, per-page contentEditable editor, themes, .docx and PDF export, PDF to Word converter).
