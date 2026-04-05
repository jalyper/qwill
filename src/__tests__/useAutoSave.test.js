import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAutoSave from '../hooks/useAutoSave.js';

const CONTENT_PREFIX = 'qwill-content-';

describe('useAutoSave', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads saved content from localStorage on mount', () => {
    localStorage.setItem(CONTENT_PREFIX + 'file-1', 'Saved content');

    const { result } = renderHook(() => useAutoSave('file-1'));

    expect(result.current.content).toBe('Saved content');
  });

  it('returns empty string when no saved content exists', () => {
    const { result } = renderHook(() => useAutoSave('file-new'));

    expect(result.current.content).toBe('');
  });

  it('sets status to saving when content changes', () => {
    const { result } = renderHook(() => useAutoSave('file-1'));

    act(() => {
      result.current.setContent('new text');
    });

    expect(result.current.saveStatus).toBe('saving');
  });

  it('saves to localStorage after 1s debounce', () => {
    const { result } = renderHook(() => useAutoSave('file-1'));

    act(() => {
      result.current.setContent('debounced content');
    });

    // Not saved yet
    expect(localStorage.getItem(CONTENT_PREFIX + 'file-1')).not.toBe('debounced content');

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(localStorage.getItem(CONTENT_PREFIX + 'file-1')).toBe('debounced content');
  });

  it('sets status to saved after save completes', () => {
    const { result } = renderHook(() => useAutoSave('file-1'));

    act(() => {
      result.current.setContent('text');
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.saveStatus).toBe('saved');
  });

  it('saveNow writes immediately without waiting for debounce', () => {
    const { result } = renderHook(() => useAutoSave('file-1'));

    act(() => {
      result.current.setContent('immediate save');
    });

    act(() => {
      result.current.saveNow();
    });

    expect(localStorage.getItem(CONTENT_PREFIX + 'file-1')).toBe('immediate save');
    expect(result.current.saveStatus).toBe('saved');
  });

  it('calls onSaveCallback with fileId and metadata', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useAutoSave('file-1', callback));

    act(() => {
      result.current.setContent('callback test');
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(callback).toHaveBeenCalledWith('file-1', expect.objectContaining({
      lastModified: expect.any(Number),
      preview: expect.any(String),
    }));
  });

  it('does not save when fileId is null', () => {
    const { result } = renderHook(() => useAutoSave(null));

    act(() => {
      result.current.setContent('should not save');
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // No key should have been written
    expect(localStorage.length).toBe(0);
  });

  it('clears pending timeout on unmount', () => {
    const { result, unmount } = renderHook(() => useAutoSave('file-1'));

    act(() => {
      result.current.setContent('before unmount');
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Should not have saved since component unmounted
    expect(localStorage.getItem(CONTENT_PREFIX + 'file-1')).not.toBe('before unmount');
  });

  it('reloads content when fileId changes', () => {
    localStorage.setItem(CONTENT_PREFIX + 'file-a', 'Content A');
    localStorage.setItem(CONTENT_PREFIX + 'file-b', 'Content B');

    const { result, rerender } = renderHook(
      ({ fileId }) => useAutoSave(fileId),
      { initialProps: { fileId: 'file-a' } }
    );

    expect(result.current.content).toBe('Content A');

    rerender({ fileId: 'file-b' });

    expect(result.current.content).toBe('Content B');
  });
});
