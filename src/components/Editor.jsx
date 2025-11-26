import React, { useState, useEffect, useRef, useCallback } from 'react';
import useAutoSave from '../hooks/useAutoSave';
import { useFileSystem } from '../hooks/useFileSystem';
import useExport from '../hooks/useExport';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import { useElectronFileSystem } from '../hooks/useElectronFileSystem';
import Page from './Page';
import { v4 as uuidv4 } from 'uuid';
import IntegrationTests from '../tests/IntegrationTests';
import { useSnakePagination } from '../hooks/useSnakePagination';

const Editor = () => {
    const { files, activeFileId, setActiveFileId, createNewFile, updateFileMeta, deleteFile } = useFileSystem();
    const { saveFileAs, isElectronEnv, htmlToDocx, openFile } = useElectronFileSystem();

    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isPageView, setIsPageView] = useState(true); // Default to true
    const [font, setFont] = useState('var(--font-sans)');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [focusedPageId, setFocusedPageId] = useState(null);

    // Use Snake Pagination Hook
    const { pages, setPages, registerPageRef, updatePageContent } = useSnakePagination([{ id: uuidv4(), content: '' }]);

    useEffect(() => {
        // Enforce div as paragraph separator
        document.execCommand('defaultParagraphSeparator', false, 'div');
        // Set page view class by default
        document.body.classList.add('page-view');
    }, []);

    // Combine all pages content for saving/exporting
    const getFullContent = useCallback(() => {
        return pages.map(p => p.content).join('');
    }, [pages]);

    const { content, setContent, saveStatus, lastSaved, saveNow } = useAutoSave(activeFileId, (id, meta) => {
        // Extract text content for preview/name from first page
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pages[0]?.content || '';
        const text = tempDiv.textContent || tempDiv.innerText || '';
        const firstLine = text.split('\n')[0].substring(0, 30);
        const name = firstLine.trim() || 'Untitled';
        updateFileMeta(id, { ...meta, name, preview: text.substring(0, 50) });
    });

    // Update auto-save content when pages change
    useEffect(() => {
        const fullContent = getFullContent();
        if (fullContent !== content) {
            setContent(fullContent);
        }
    }, [pages, getFullContent, setContent, content]);

    const { exportAsDocx, exportAsPdf } = useExport();

    const handleExport = async (format) => {
        const filename = files.find(f => f.id === activeFileId)?.name || 'document';
        const fullContent = getFullContent();
        if (format === 'docx') {
            await exportAsDocx(fullContent, filename);
        } else if (format === 'pdf') {
            await exportAsPdf(fullContent, filename);
        }
    };

    const handleOpen = async () => {
        if (isElectronEnv) {
            const result = await openFile();
            if (result) {
                // For now, just load everything into the first page and let it flow?
                // Or try to split?
                // Simple approach: Load into first page.
                setPages([{ id: uuidv4(), content: result.html }]);

                const newFileId = createNewFile();
                updateFileMeta(newFileId, {
                    name: result.filePath.split(/[\\/]/).pop().replace('.docx', ''),
                    preview: result.html.substring(0, 50)
                });
                setActiveFileId(newFileId);
            }
        } else {
            alert('Open file is currently only supported in the desktop app.');
        }
    };

    const handleSaveAs = async () => {
        const fullContent = getFullContent();
        if (isElectronEnv) {
            await saveFileAs(fullContent);
        } else {
            const filename = files.find(f => f.id === activeFileId)?.name || 'Untitled';
            await exportAsDocx(fullContent, filename);
        }
    };

    const toggleDarkMode = () => {
        setIsDarkMode(!isDarkMode);
        document.body.classList.toggle('dark-mode');
    };

    const togglePageView = () => {
        setIsPageView(!isPageView);
        document.body.classList.toggle('page-view');
    };

    const handleFormat = (command, value = null) => {
        document.execCommand(command, false, value);
        // Focus is handled by browser usually, but we might need to ensure correct page is focused
    };

    return (
        <>
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                files={files}
                activeFileId={activeFileId}
                onSelectFile={setActiveFileId}
                onCreateFile={createNewFile}
                onDeleteFile={deleteFile}
            />

            <Toolbar
                currentFont={font}
                onFontChange={setFont}
                saveStatus={saveStatus}
                lastSaved={lastSaved}
                onManualSave={saveNow}
                onSaveAs={handleSaveAs}
                onOpen={handleOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                onToggleDarkMode={toggleDarkMode}
                isDarkMode={isDarkMode}
                onTogglePageView={togglePageView}
                isPageView={isPageView}
                onFormat={handleFormat}
                onExport={handleExport}
            />

            <div style={{
                marginTop: '80px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingBottom: '10vh',
                flex: 1,
            }}>
                {pages.map((page, index) => (
                    <Page
                        key={page.id}
                        id={page.id}
                        pageNumber={index + 1}
                        content={page.content}
                        font={font}
                        onContentChange={updatePageContent}
                        registerPageRef={registerPageRef}
                        onFocus={setFocusedPageId}
                        isFocused={focusedPageId === page.id}
                    />
                ))}
            </div>
            {/* Integration Tests Harness */}
            <IntegrationTests
                pages={pages}
                setPages={setPages}
                getPageRef={(id) => document.querySelector(`[data-page-number] .page-content`)}
            />
        </>
    );
};

export default Editor;
