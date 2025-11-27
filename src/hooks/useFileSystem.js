import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const FILE_LIST_KEY = 'qwill-file-list';
const CONTENT_PREFIX = 'qwill-content-';

export const useFileSystem = () => {
    const [files, setFiles] = useState([]);
    const [activeFileId, setActiveFileId] = useState(null);

    // Load file list on mount
    useEffect(() => {
        const storedFiles = localStorage.getItem(FILE_LIST_KEY);
        if (storedFiles) {
            try {
                const parsedFiles = JSON.parse(storedFiles);
                setFiles(parsedFiles);
                if (parsedFiles.length > 0) {
                    setActiveFileId(parsedFiles[0].id);
                }
            } catch (error) {
                console.error('Error parsing file list from localStorage:', error);
                // Fallback: Clear corrupted data or start fresh
                localStorage.removeItem(FILE_LIST_KEY);
                createNewFile();
            }
        } else {
            // Migration or Initial State
            const legacyContent = localStorage.getItem('qwill-content');
            if (legacyContent) {
                const newFile = {
                    id: uuidv4(),
                    name: 'Untitled',
                    lastModified: Date.now(),
                    preview: legacyContent.substring(0, 50)
                };
                localStorage.setItem(CONTENT_PREFIX + newFile.id, legacyContent);
                localStorage.setItem(FILE_LIST_KEY, JSON.stringify([newFile]));
                localStorage.removeItem('qwill-content'); // Cleanup legacy
                setFiles([newFile]);
                setActiveFileId(newFile.id);
            } else {
                // Create initial empty file
                createNewFile();
            }
        }
    }, []);

    const createNewFile = useCallback(() => {
        const newFile = {
            id: uuidv4(),
            name: 'Untitled',
            lastModified: Date.now(),
            preview: ''
        };
        setFiles(prev => {
            const updated = [newFile, ...prev];
            localStorage.setItem(FILE_LIST_KEY, JSON.stringify(updated));
            return updated;
        });
        localStorage.setItem(CONTENT_PREFIX + newFile.id, '');
        setActiveFileId(newFile.id);
        return newFile.id;
    }, []);

    const updateFileMeta = useCallback((id, updates) => {
        setFiles(prev => {
            const updated = prev.map(f => f.id === id ? { ...f, ...updates } : f);
            // Sort by lastModified desc
            updated.sort((a, b) => b.lastModified - a.lastModified);
            localStorage.setItem(FILE_LIST_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    const deleteFile = useCallback((id) => {
        setFiles(prev => {
            const updated = prev.filter(f => f.id !== id);
            localStorage.setItem(FILE_LIST_KEY, JSON.stringify(updated));
            if (activeFileId === id) {
                setActiveFileId(updated.length > 0 ? updated[0].id : null);
            }
            return updated;
        });
        localStorage.removeItem(CONTENT_PREFIX + id);
        if (files.length === 1 && files[0].id === id) {
            createNewFile(); // Ensure there's always one file
        }
    }, [activeFileId, files, createNewFile]);

    return {
        files,
        activeFileId,
        setActiveFileId,
        createNewFile,
        updateFileMeta,
        deleteFile
    };
};
