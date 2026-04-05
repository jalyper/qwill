import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileSystem } from '../hooks/useFileSystem.js';

vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

import { v4 as uuidv4 } from 'uuid';

const FILE_LIST_KEY = 'qwill-file-list';
const CONTENT_PREFIX = 'qwill-content-';

describe('file switching (sidebar regression)', () => {
  let idCounter;

  beforeEach(() => {
    localStorage.clear();
    idCounter = 0;
    uuidv4.mockImplementation(() => `file-${++idCounter}`);
  });

  it('switching files does not overwrite the target file content', () => {
    // Setup: two files with distinct content in localStorage
    const files = [
      { id: 'doc-a', name: 'Document A', lastModified: Date.now(), preview: 'AAA' },
      { id: 'doc-b', name: 'Document B', lastModified: Date.now() - 1000, preview: 'BBB' },
    ];
    localStorage.setItem(FILE_LIST_KEY, JSON.stringify(files));
    localStorage.setItem(CONTENT_PREFIX + 'doc-a', '<p>Content of A</p>');
    localStorage.setItem(CONTENT_PREFIX + 'doc-b', '<p>Content of B</p>');

    const { result } = renderHook(() => useFileSystem());

    // Initially on doc-a
    expect(result.current.activeFileId).toBe('doc-a');

    // Switch to doc-b
    act(() => {
      result.current.setActiveFileId('doc-b');
    });

    expect(result.current.activeFileId).toBe('doc-b');

    // Verify doc-a content was NOT overwritten
    expect(localStorage.getItem(CONTENT_PREFIX + 'doc-a')).toBe('<p>Content of A</p>');
    // Verify doc-b content was NOT overwritten
    expect(localStorage.getItem(CONTENT_PREFIX + 'doc-b')).toBe('<p>Content of B</p>');
  });

  it('switching back to original file preserves its content', () => {
    const files = [
      { id: 'doc-a', name: 'Document A', lastModified: Date.now(), preview: '' },
      { id: 'doc-b', name: 'Document B', lastModified: Date.now() - 1000, preview: '' },
    ];
    localStorage.setItem(FILE_LIST_KEY, JSON.stringify(files));
    localStorage.setItem(CONTENT_PREFIX + 'doc-a', '<p>Original A</p>');
    localStorage.setItem(CONTENT_PREFIX + 'doc-b', '<p>Original B</p>');

    const { result } = renderHook(() => useFileSystem());

    // Switch to B
    act(() => {
      result.current.setActiveFileId('doc-b');
    });

    // Switch back to A
    act(() => {
      result.current.setActiveFileId('doc-a');
    });

    expect(result.current.activeFileId).toBe('doc-a');
    expect(localStorage.getItem(CONTENT_PREFIX + 'doc-a')).toBe('<p>Original A</p>');
    expect(localStorage.getItem(CONTENT_PREFIX + 'doc-b')).toBe('<p>Original B</p>');
  });

  it('each file loads its own content from localStorage', () => {
    const files = [
      { id: 'doc-x', name: 'X', lastModified: Date.now(), preview: '' },
      { id: 'doc-y', name: 'Y', lastModified: Date.now() - 1000, preview: '' },
      { id: 'doc-z', name: 'Z', lastModified: Date.now() - 2000, preview: '' },
    ];
    localStorage.setItem(FILE_LIST_KEY, JSON.stringify(files));
    localStorage.setItem(CONTENT_PREFIX + 'doc-x', 'X content');
    localStorage.setItem(CONTENT_PREFIX + 'doc-y', 'Y content');
    localStorage.setItem(CONTENT_PREFIX + 'doc-z', 'Z content');

    const { result } = renderHook(() => useFileSystem());

    // Verify we can read each file's content independently
    expect(localStorage.getItem(CONTENT_PREFIX + result.current.files[0].id)).toBe('X content');
    expect(localStorage.getItem(CONTENT_PREFIX + result.current.files[1].id)).toBe('Y content');
    expect(localStorage.getItem(CONTENT_PREFIX + result.current.files[2].id)).toBe('Z content');

    // Rapidly switch through all files
    act(() => result.current.setActiveFileId('doc-y'));
    act(() => result.current.setActiveFileId('doc-z'));
    act(() => result.current.setActiveFileId('doc-x'));

    // All content should be intact
    expect(localStorage.getItem(CONTENT_PREFIX + 'doc-x')).toBe('X content');
    expect(localStorage.getItem(CONTENT_PREFIX + 'doc-y')).toBe('Y content');
    expect(localStorage.getItem(CONTENT_PREFIX + 'doc-z')).toBe('Z content');
  });

  it('creating a new file does not corrupt existing file content', () => {
    const files = [
      { id: 'existing', name: 'Existing', lastModified: Date.now(), preview: '' },
    ];
    localStorage.setItem(FILE_LIST_KEY, JSON.stringify(files));
    localStorage.setItem(CONTENT_PREFIX + 'existing', '<p>Important content</p>');

    const { result } = renderHook(() => useFileSystem());

    // Create a new file
    act(() => {
      result.current.createNewFile();
    });

    // Existing file content must be untouched
    expect(localStorage.getItem(CONTENT_PREFIX + 'existing')).toBe('<p>Important content</p>');
    // New file should have empty content
    const newFileId = result.current.files[0].id; // newest is first
    expect(localStorage.getItem(CONTENT_PREFIX + newFileId)).toBe('');
  });

  it('deleting active file switches to another without corrupting it', () => {
    const files = [
      { id: 'doc-1', name: 'Doc 1', lastModified: Date.now(), preview: '' },
      { id: 'doc-2', name: 'Doc 2', lastModified: Date.now() - 1000, preview: '' },
    ];
    localStorage.setItem(FILE_LIST_KEY, JSON.stringify(files));
    localStorage.setItem(CONTENT_PREFIX + 'doc-1', 'Content 1');
    localStorage.setItem(CONTENT_PREFIX + 'doc-2', 'Content 2');

    const { result } = renderHook(() => useFileSystem());

    expect(result.current.activeFileId).toBe('doc-1');

    // Delete active file
    act(() => {
      result.current.deleteFile('doc-1');
    });

    // Should switch to doc-2
    expect(result.current.activeFileId).toBe('doc-2');
    // doc-2 content must be intact
    expect(localStorage.getItem(CONTENT_PREFIX + 'doc-2')).toBe('Content 2');
    // doc-1 content should be removed
    expect(localStorage.getItem(CONTENT_PREFIX + 'doc-1')).toBeNull();
  });
});
