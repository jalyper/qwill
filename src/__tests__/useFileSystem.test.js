import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileSystem } from '../hooks/useFileSystem.js';

vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

import { v4 as uuidv4 } from 'uuid';

const FILE_LIST_KEY = 'qwill-file-list';
const CONTENT_PREFIX = 'qwill-content-';

describe('useFileSystem', () => {
  let idCounter;

  beforeEach(() => {
    localStorage.clear();
    idCounter = 0;
    uuidv4.mockImplementation(() => `test-id-${++idCounter}`);
  });

  it('createNewFile adds a file with UUID id', () => {
    const { result } = renderHook(() => useFileSystem());

    // Initial file created on mount
    expect(result.current.files.length).toBe(1);
    expect(result.current.files[0].id).toBe('test-id-1');

    act(() => {
      result.current.createNewFile();
    });

    expect(result.current.files.length).toBe(2);
    expect(result.current.files[0].id).toBe('test-id-2');
  });

  it('createNewFile sets name to Untitled', () => {
    const { result } = renderHook(() => useFileSystem());

    act(() => {
      result.current.createNewFile();
    });

    const newFile = result.current.files[0];
    expect(newFile.name).toBe('Untitled');
  });

  it('createNewFile prepends new file to list', () => {
    const { result } = renderHook(() => useFileSystem());

    act(() => {
      result.current.createNewFile();
    });

    // Newest file should be first
    expect(result.current.files[0].id).toBe('test-id-2');
    expect(result.current.files[1].id).toBe('test-id-1');
  });

  it('createNewFile persists to localStorage', () => {
    const { result } = renderHook(() => useFileSystem());

    act(() => {
      result.current.createNewFile();
    });

    const stored = JSON.parse(localStorage.getItem(FILE_LIST_KEY));
    expect(stored.length).toBe(2);
  });

  it('updateFileMeta updates name for given id', () => {
    const { result } = renderHook(() => useFileSystem());
    const fileId = result.current.files[0].id;

    act(() => {
      result.current.updateFileMeta(fileId, { name: 'My Document' });
    });

    expect(result.current.files.find((f) => f.id === fileId).name).toBe('My Document');
  });

  it('updateFileMeta re-sorts by lastModified desc', () => {
    const { result } = renderHook(() => useFileSystem());

    act(() => {
      result.current.createNewFile();
    });

    // Update the older file with a newer timestamp
    const olderId = result.current.files[1].id;
    act(() => {
      result.current.updateFileMeta(olderId, { lastModified: Date.now() + 10000 });
    });

    expect(result.current.files[0].id).toBe(olderId);
  });

  it('deleteFile removes file from list', () => {
    const { result } = renderHook(() => useFileSystem());

    act(() => {
      result.current.createNewFile();
    });

    const toDelete = result.current.files[1].id;
    act(() => {
      result.current.deleteFile(toDelete);
    });

    expect(result.current.files.find((f) => f.id === toDelete)).toBeUndefined();
  });

  it('deleteFile removes content from localStorage', () => {
    const { result } = renderHook(() => useFileSystem());

    act(() => {
      result.current.createNewFile();
    });

    const toDelete = result.current.files[1].id;
    localStorage.setItem(CONTENT_PREFIX + toDelete, 'some content');

    act(() => {
      result.current.deleteFile(toDelete);
    });

    expect(localStorage.getItem(CONTENT_PREFIX + toDelete)).toBeNull();
  });

  it('deleteFile switches activeFileId when deleting active file', () => {
    const { result } = renderHook(() => useFileSystem());

    act(() => {
      result.current.createNewFile();
    });

    const activeId = result.current.activeFileId;
    act(() => {
      result.current.deleteFile(activeId);
    });

    expect(result.current.activeFileId).not.toBe(activeId);
    expect(result.current.activeFileId).not.toBeNull();
  });

  it('deleteFile creates new file when deleting last file', () => {
    const { result } = renderHook(() => useFileSystem());

    expect(result.current.files.length).toBe(1);
    const lastId = result.current.files[0].id;

    act(() => {
      result.current.deleteFile(lastId);
    });

    // Should have created a new file
    expect(result.current.files.length).toBeGreaterThanOrEqual(1);
  });

  it('initial load parses files from localStorage', () => {
    const existingFiles = [
      { id: 'existing-1', name: 'Doc 1', lastModified: Date.now(), preview: '' },
      { id: 'existing-2', name: 'Doc 2', lastModified: Date.now(), preview: '' },
    ];
    localStorage.setItem(FILE_LIST_KEY, JSON.stringify(existingFiles));

    const { result } = renderHook(() => useFileSystem());

    expect(result.current.files.length).toBe(2);
    expect(result.current.files[0].id).toBe('existing-1');
    expect(result.current.activeFileId).toBe('existing-1');
  });

  it('initial load migrates legacy qwill-content key', () => {
    localStorage.setItem('qwill-content', '<p>Legacy content</p>');

    const { result } = renderHook(() => useFileSystem());

    expect(result.current.files.length).toBe(1);
    expect(localStorage.getItem('qwill-content')).toBeNull();
    const fileId = result.current.files[0].id;
    expect(localStorage.getItem(CONTENT_PREFIX + fileId)).toBe('<p>Legacy content</p>');
  });

  it('initial load handles corrupted localStorage gracefully', () => {
    localStorage.setItem(FILE_LIST_KEY, 'not valid json{{{');

    const { result } = renderHook(() => useFileSystem());

    // Should recover — either empty or created a new file
    expect(result.current.files.length).toBeGreaterThanOrEqual(1);
  });
});
