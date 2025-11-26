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

    // Load content when fileId changes
    useEffect(() => {
        if (!fileId) return;
        const saved = localStorage.getItem(CONTENT_PREFIX + fileId);
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

    useEffect(() => {
        if (!fileId) return;
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
