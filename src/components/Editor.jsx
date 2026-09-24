import React, { useState, useEffect, useCallback, useRef } from 'react';
import useAutoSave from '../hooks/useAutoSave';
import { useFileSystem } from '../hooks/useFileSystem';
import useExport from '../hooks/useExport';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import { useDesktopFileSystem } from '../hooks/useDesktopFileSystem';
import { themes } from '../constants/themes';

// Page dimensions in px (US Letter at 96dpi)
const PAGE_WIDTH = 816;   // 8.5in
const PAGE_HEIGHT = 1056; // 11in
const PAGE_PADDING = 96;  // 1in margins
const CONTENT_HEIGHT = PAGE_HEIGHT - (PAGE_PADDING * 2); // 864px
const PAGE_GAP = 30;

const Editor = () => {
    const { files, activeFileId, setActiveFileId, createNewFile, updateFileMeta, deleteFile } = useFileSystem();
    const { saveFileAs, openFile } = useDesktopFileSystem();

    const [currentTheme, setCurrentTheme] = useState(themes[0]);
    const [isPageView, setIsPageView] = useState(true);
    const [font, setFont] = useState('var(--font-sans)');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [pageCount, setPageCount] = useState(1);

    const editorRef = useRef(null);

    // Apply theme colors
    useEffect(() => {
        const root = document.documentElement;
        Object.entries(currentTheme.colors).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
    }, [currentTheme]);

    useEffect(() => {
        document.execCommand('defaultParagraphSeparator', false, 'div');

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

    // Recompute page count from contentEditable scroll height
    const updatePageCount = useCallback(() => {
        if (!editorRef.current || !isPageView) return;
        const scrollH = editorRef.current.scrollHeight;
        const pages = Math.max(1, Math.ceil(scrollH / PAGE_HEIGHT));
        setPageCount(pages);
    }, [isPageView]);

    // Observe content size changes with ResizeObserver
    useEffect(() => {
        if (!editorRef.current) return;
        const observer = new ResizeObserver(() => updatePageCount());
        observer.observe(editorRef.current);
        return () => observer.disconnect();
    }, [updatePageCount]);

    const { content, setContent, saveStatus, lastSaved, saveNow } = useAutoSave(activeFileId, (id, meta) => {
        if (!editorRef.current) return;
        const text = editorRef.current.textContent || '';
        const firstLine = text.split('\n')[0].substring(0, 30);
        const name = firstLine.trim() || 'Untitled';
        updateFileMeta(id, { ...meta, name, preview: text.substring(0, 50) });
    });

    // When activeFileId changes, load saved content
    const prevFileIdRef = useRef(activeFileId);
    useEffect(() => {
        if (activeFileId && activeFileId !== prevFileIdRef.current) {
            prevFileIdRef.current = activeFileId;
            const saved = localStorage.getItem('qwill-content-' + activeFileId) || '';
            if (editorRef.current) {
                editorRef.current.innerHTML = saved;
                setContent(saved);
                requestAnimationFrame(updatePageCount);
            }
        }
    }, [activeFileId, setContent, updatePageCount]);

    // Sync editor to auto-save on input
    const handleInput = useCallback(() => {
        if (!editorRef.current) return;
        setContent(editorRef.current.innerHTML);
        updatePageCount();
    }, [setContent, updatePageCount]);

    // Load initial content
    useEffect(() => {
        if (editorRef.current && content && document.activeElement !== editorRef.current) {
            editorRef.current.innerHTML = content;
            requestAnimationFrame(updatePageCount);
        }
    }, [content, updatePageCount]);

    const { exportAsDocx, exportAsPdf } = useExport();

    const getFullContent = useCallback(() => {
        return editorRef.current?.innerHTML || '';
    }, []);

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
            if (editorRef.current) {
                editorRef.current.innerHTML = result.html;
                setContent(result.html);
            }
            const newFileId = createNewFile();
            updateFileMeta(newFileId, {
                name: result.filePath.split(/[\\/]/).pop().replace('.docx', ''),
                preview: result.html.substring(0, 50)
            });
            setActiveFileId(newFileId);
        }
    };

    const handleSaveAs = async () => {
        await saveFileAs(getFullContent());
    };

    const togglePageView = () => {
        setIsPageView(prev => !prev);
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

    // Total height of the page stack including gaps
    const totalHeight = isPageView
        ? (pageCount * PAGE_HEIGHT) + ((pageCount - 1) * PAGE_GAP)
        : undefined;

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
                <div style={{ position: 'relative', width: isPageView ? PAGE_WIDTH : 'min(800px, 100%)' }}>
                    {/* The single contentEditable — drives layout */}
                    <div
                        className="editor-ce"
                        ref={editorRef}
                        contentEditable
                        onInput={handleInput}
                        spellCheck={false}
                        style={{
                            width: '100%',
                            padding: isPageView ? PAGE_PADDING : '2rem',
                            outline: 'none',
                            lineHeight: 1.6,
                            fontSize: '16px',
                            fontFamily: font,
                            minHeight: isPageView ? PAGE_HEIGHT : '50vh',
                            color: 'var(--text-color)',
                            backgroundColor: isPageView ? 'var(--page-bg, #ffffff)' : 'transparent',
                            boxShadow: isPageView ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
                            position: 'relative',
                            zIndex: 1,
                        }}
                    />

                    {/* Page boundary lines + page numbers — overlaid, no pointer events */}
                    {isPageView && Array.from({ length: pageCount - 1 }, (_, i) => {
                        const yPos = (i + 1) * PAGE_HEIGHT;
                        return (
                            <div
                                key={`boundary-${i}`}
                                style={{
                                    position: 'absolute',
                                    top: yPos - 1,
                                    left: 0,
                                    width: '100%',
                                    height: 2,
                                    backgroundColor: 'var(--bg-color)',
                                    boxShadow: '0 -2px 4px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.08)',
                                    zIndex: 2,
                                    pointerEvents: 'none',
                                }}
                            />
                        );
                    })}

                    {/* Page numbers */}
                    {isPageView && Array.from({ length: pageCount }, (_, i) => (
                        <div
                            key={`pagenum-${i}`}
                            style={{
                                position: 'absolute',
                                top: (i + 1) * PAGE_HEIGHT - 40,
                                right: 40,
                                color: '#9ca3af',
                                fontSize: '0.8rem',
                                zIndex: 2,
                                pointerEvents: 'none',
                            }}
                        >{i + 1}</div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default Editor;
