import { useState, useEffect, useCallback, useRef } from 'react';

const CONTENT_PREFIX = 'qwill-content-';

const useAutoSave = (fileId, onSaveCallback) => {
    const [value, setValue] = useState('');
    const [status, setStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'
    const [lastSaved, setLastSaved] = useState(null);
    const timeoutRef = useRef(null);
    const callbackRef = useRef(onSaveCallback);

    // Update callback ref when it changes
    useEffect(() => {
        callbackRef.current = onSaveCallback;
    }, [onSaveCallback]);

    // Load content when fileId changes. This legitimately needs to call
    // setState in an effect because the content source (localStorage) is
    // outside React — we can't derive `value` from props, and loading has
    // to happen on the mount/fileId-change edge.
    useEffect(() => {
        if (!fileId) return;
        const saved = localStorage.getItem(CONTENT_PREFIX + fileId);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setValue(saved || '');
        setStatus('saved');
    }, [fileId]);

    const saveNow = useCallback(() => {
        if (!fileId) return;
        localStorage.setItem(CONTENT_PREFIX + fileId, value);
        setStatus('saved');
        const now = Date.now();
        setLastSaved(now);
        if (callbackRef.current) {
            callbackRef.current(fileId, { lastModified: now, preview: value.substring(0, 50) });
        }
    }, [fileId, value]);

    // Debounced auto-save: whenever `value` changes, enter 'saving' state
    // and schedule a real save 1s later. The setStatus here is intentional —
    // it's how the UI shows the "saving…" indicator while the debounce
    // window is open — so we silence the effect-state lint.
    useEffect(() => {
        if (!fileId) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStatus('saving');

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            saveNow();
        }, 1000);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [fileId, value, saveNow]);

    return {
        content: value,
        setContent: setValue,
        saveStatus: status,
        lastSaved,
        saveNow
    };
};

export default useAutoSave;
