import React, { useState, useEffect, useCallback } from 'react';
import useAutoSave from '../hooks/useAutoSave';
import { useFileSystem } from '../hooks/useFileSystem';
import useExport from '../hooks/useExport';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import { useDesktopFileSystem } from '../hooks/useDesktopFileSystem';
import Page from './Page';
import { v4 as uuidv4 } from 'uuid';
import { useSnakePagination } from '../hooks/useSnakePagination';
import { themes } from '../constants/themes';

const Editor = () => {
    const { files, activeFileId, setActiveFileId, createNewFile, updateFileMeta, deleteFile } = useFileSystem();
    const { saveFileAs, openFile } = useDesktopFileSystem();

    const [currentTheme, setCurrentTheme] = useState(themes[0]);
    const [isPageView, setIsPageView] = useState(true);
    const [font, setFont] = useState('var(--font-sans)');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [focusedPageId, setFocusedPageId] = useState(null);

    const { pages, setPages, registerPageRef, updatePageContent } = useSnakePagination([{ id: uuidv4(), content: '' }]);

    // Apply theme colors
    useEffect(() => {
        const root = document.documentElement;
        Object.entries(currentTheme.colors).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
    }, [currentTheme]);

    useEffect(() => {
        document.execCommand('defaultParagraphSeparator', false, 'div');
        document.body.classList.add('page-view');

        // Zoom shortcuts (Ctrl+=/Ctrl+-/Ctrl+0)
        const handleKeydown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) + 0.1).toFixed(1);
                } else if (e.key === '-') {
                    e.preventDefault();
                    document.body.style.zoom = Math.max(0.3, parseFloat(document.body.style.zoom || 1) - 0.1).toFixed(1);
                } else if (e.key === '0') {
                    e.preventDefault();
                    document.body.style.zoom = '1';
                }
            }
        };
        document.addEventListener('keydown', handleKeydown);
        return () => document.removeEventListener('keydown', handleKeydown);
    }, []);

    const getFullContent = useCallback(() => {
        return pages.map(p => p.content).join('');
    }, [pages]);

    const { content, setContent, saveStatus, lastSaved, saveNow } = useAutoSave(activeFileId, (id, meta) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = pages[0]?.content || '';
        const text = tempDiv.textContent || tempDiv.innerText || '';
        const firstLine = text.split('\n')[0].substring(0, 30);
        const name = firstLine.trim() || 'Untitled';
        updateFileMeta(id, { ...meta, name, preview: text.substring(0, 50) });
    });

    // When activeFileId changes, load the saved content into pages
    const prevFileIdRef = React.useRef(activeFileId);
    useEffect(() => {
        if (activeFileId && activeFileId !== prevFileIdRef.current) {
            prevFileIdRef.current = activeFileId;
            const saved = localStorage.getItem('qwill-content-' + activeFileId) || '';
            setPages([{ id: uuidv4(), content: saved }]);
        }
    }, [activeFileId, setPages]);

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
        const result = await openFile();
        if (result) {
            setPages([{ id: uuidv4(), content: result.html }]);
            const newFileId = createNewFile();
            updateFileMeta(newFileId, {
                name: result.filePath.split(/[\\/]/).pop().replace('.docx', ''),
                preview: result.html.substring(0, 50)
            });
            setActiveFileId(newFileId);
        }
    };

    const handleSaveAs = async () => {
        const fullContent = getFullContent();
        await saveFileAs(fullContent);
    };

    const togglePageView = () => {
        setIsPageView(!isPageView);
        document.body.classList.toggle('page-view');
    };

    const handleFormat = (command, value = null) => {
        document.execCommand(command, false, value);
    };

    const handleFontChange = (fontValue) => {
        setFont(fontValue);
    };

    const handleConvertPdf = async () => {
        try {
            const { open, save } = await import('@tauri-apps/plugin-dialog');
            const { invoke } = await import('@tauri-apps/api/core');

            const pdfPath = await open({
                filters: [
                    { name: 'PDF Documents', extensions: ['pdf'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });
            if (!pdfPath) return;

            const defaultDocxName = (typeof pdfPath === 'string' ? pdfPath : pdfPath.path)
                .replace(/\.pdf$/i, '.docx');
            const docxPath = await save({
                defaultPath: defaultDocxName,
                filters: [{ name: 'Word Documents', extensions: ['docx'] }],
            });
            if (!docxPath) return;

            const resultPath = await invoke('convert_pdf_to_docx', {
                pdfPath: typeof pdfPath === 'string' ? pdfPath : pdfPath.path,
                docxPath,
            });

            alert(`Successfully converted PDF to Word!\nSaved to: ${resultPath}`);
        } catch (error) {
            console.error('Error converting PDF:', error);
            alert(`Conversion failed: ${error}`);
        }
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
                onConvertPdf={handleConvertPdf}
            />

            <Toolbar
                currentFont={font}
                onFontChange={handleFontChange}
                saveStatus={saveStatus}
                lastSaved={lastSaved}
                onManualSave={saveNow}
                onSaveAs={handleSaveAs}
                onOpen={handleOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                currentTheme={currentTheme}
                onThemeChange={setCurrentTheme}
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
        </>
    );
};

export default Editor;
