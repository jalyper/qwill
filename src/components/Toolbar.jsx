import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
    Bold, Italic, AlignLeft, AlignCenter, AlignRight,
    Heading1, Heading2, Heading3,
    FileText, Download, Palette, Menu,
    Save, FolderOpen, ChevronDown, File, Check
} from 'lucide-react';
import { themes } from '../constants/themes';

const fonts = [
    { name: 'Sans Serif', value: 'var(--font-sans)' },
    { name: 'Serif', value: 'var(--font-serif)' },
    { name: 'Monospace', value: 'var(--font-mono)' },
    { name: 'Courier New', value: '"Courier New", Courier, monospace' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
    { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
    { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
];

const fontSizes = [
    { name: '12', value: '3' },
    { name: '14', value: '4' },
    { name: '16', value: '5' },
    { name: '18', value: '6' },
    { name: '24', value: '7' },
];

const btnStyle = {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '4px',
    padding: '0.3rem',
    cursor: 'pointer',
    color: 'var(--text-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    opacity: 0.7
};

const activeBtnStyle = {
    ...btnStyle,
    backgroundColor: 'rgba(0,0,0,0.05)',
    opacity: 1,
    border: '1px solid rgba(0,0,0,0.1)'
};

const Toolbar = ({
    currentFont,
    onFontChange,
    saveStatus,
    lastSaved,
    onManualSave,
    onSaveAs,
    onOpen,
    onToggleSidebar,
    currentTheme,
    onThemeChange,
    onTogglePageView,
    isPageView,
    onFormat,
    onExport
}) => {
    const [showExportMenu, setShowExportMenu] = React.useState(false);
    const [showThemeMenu, setShowThemeMenu] = React.useState(false);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '50px',
            padding: '0 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--toolbar-bg)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--toolbar-border)',
            zIndex: 100,
            transition: 'all 0.3s ease'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                    onClick={onToggleSidebar}
                    title="Menu"
                    style={{ ...btnStyle, padding: '0.2rem' }}
                >
                    <Menu size={20} />
                </button>
                <div style={{ fontWeight: '600', fontSize: '1.1rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Qwill
                </div>
            </div>

            {/* Formatting Controls */}
            <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                <button onClick={() => onFormat('bold')} style={btnStyle} title="Bold (Ctrl+B)"><Bold size={16} /></button>
                <button onClick={() => onFormat('italic')} style={btnStyle} title="Italic (Ctrl+I)"><Italic size={16} /></button>

                <div style={{ position: 'relative', width: '24px', height: '24px', overflow: 'hidden', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)', marginLeft: '0.2rem' }}>
                    <input
                        type="color"
                        onChange={(e) => onFormat('foreColor', e.target.value)}
                        title="Text Color"
                        style={{
                            position: 'absolute',
                            top: '-50%',
                            left: '-50%',
                            width: '200%',
                            height: '200%',
                            cursor: 'pointer',
                            border: 'none',
                            padding: 0
                        }}
                    />
                </div>

                <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--toolbar-border)', margin: '0 0.5rem' }} />

                {/* Alignment */}
                <button onClick={() => onFormat('justifyLeft')} style={btnStyle} title="Align Left"><AlignLeft size={16} /></button>
                <button onClick={() => onFormat('justifyCenter')} style={btnStyle} title="Align Center"><AlignCenter size={16} /></button>
                <button onClick={() => onFormat('justifyRight')} style={btnStyle} title="Align Right"><AlignRight size={16} /></button>

                <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--toolbar-border)', margin: '0 0.5rem' }} />

                <select
                    value={currentFont}
                    onChange={(e) => onFontChange(e.target.value)}
                    style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid transparent',
                        backgroundColor: 'transparent',
                        fontFamily: 'inherit',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        outline: 'none',
                        color: 'var(--text-color)',
                        maxWidth: '100px'
                    }}
                >
                    {fonts.map(font => (
                        <option key={font.name} value={font.value}>{font.name}</option>
                    ))}
                </select>

                {/* Font Size Selector */}
                <select
                    onChange={(e) => onFormat('fontSize', e.target.value)}
                    defaultValue="5"
                    style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid transparent',
                        backgroundColor: 'transparent',
                        fontFamily: 'inherit',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        outline: 'none',
                        color: 'var(--text-color)',
                        minWidth: '50px'
                    }}
                    title="Font Size"
                >
                    {fontSizes.map(size => (
                        <option key={size.value} value={size.value}>{size.name}</option>
                    ))}
                </select>

                <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--toolbar-border)', margin: '0 0.5rem' }} />

                {/* Heading Buttons */}
                <button onClick={() => onFormat('formatBlock', 'h1')} style={btnStyle} title="Heading 1"><Heading1 size={16} /></button>
                <button onClick={() => onFormat('formatBlock', 'h2')} style={btnStyle} title="Heading 2"><Heading2 size={16} /></button>
                <button onClick={() => onFormat('formatBlock', 'h3')} style={btnStyle} title="Heading 3"><Heading3 size={16} /></button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {/* File Operations */}
                <button onClick={onOpen} style={btnStyle} title="Open File">
                    <FolderOpen size={18} />
                </button>

                <button onClick={onManualSave} style={btnStyle} title="Save">
                    <Save size={18} />
                </button>

                <button onClick={onSaveAs} style={btnStyle} title="Save As...">
                    <FileText size={18} />
                    <span style={{ fontSize: '0.7rem', marginLeft: '2px' }}>As...</span>
                </button>

                {/* Export Dropdown */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        style={btnStyle}
                        title="Export Document"
                    >
                        <Download size={18} />
                        <ChevronDown size={12} style={{ marginLeft: '2px' }} />
                    </button>
                    {showExportMenu && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.5rem',
                            backgroundColor: 'var(--toolbar-bg)',
                            border: '1px solid var(--toolbar-border)',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 1000,
                            minWidth: '160px',
                            backdropFilter: 'blur(10px)',
                            padding: '0.3rem'
                        }}>
                            <button
                                onClick={() => {
                                    onExport('docx');
                                    setShowExportMenu(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem 0.8rem',
                                    border: 'none',
                                    background: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    color: 'var(--text-color)',
                                    fontSize: '0.9rem',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                                <FileText size={14} /> DOCX
                            </button>
                            <button
                                onClick={() => {
                                    onExport('pdf');
                                    setShowExportMenu(false);
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem 0.8rem',
                                    border: 'none',
                                    background: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    color: 'var(--text-color)',
                                    fontSize: '0.9rem',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                            >
                                <File size={14} /> PDF
                            </button>
                        </div>
                    )}
                </div>

                <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--toolbar-border)', margin: '0 0.2rem' }} />

                {/* View Toggles */}
                <button onClick={onTogglePageView} style={btnStyle} title="Toggle Page View">
                    <FileText size={18} style={{ opacity: isPageView ? 1 : 0.5 }} />
                </button>

                {/* Theme Toggle */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowThemeMenu(!showThemeMenu)}
                        style={btnStyle}
                        title="Change Theme"
                    >
                        <Palette size={18} />
                    </button>
                    {showThemeMenu && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '0.5rem',
                            backgroundColor: 'var(--toolbar-bg)',
                            border: '1px solid var(--toolbar-border)',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            zIndex: 1000,
                            minWidth: '160px',
                            backdropFilter: 'blur(10px)',
                            padding: '0.3rem'
                        }}>
                            {themes.map(theme => (
                                <button
                                    key={theme.id}
                                    onClick={() => {
                                        onThemeChange(theme);
                                        setShowThemeMenu(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem 0.8rem',
                                        border: 'none',
                                        background: 'transparent',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        color: 'var(--text-color)',
                                        fontSize: '0.9rem',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        justifyContent: 'space-between'
                                    }}
                                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0,0,0,0.05)'}
                                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            backgroundColor: theme.colors['--bg-color'],
                                            border: '1px solid var(--text-color)'
                                        }} />
                                        {theme.name}
                                    </div>
                                    {currentTheme.id === theme.id && <Check size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Save Status Indicator */}
                <div style={{
                    fontSize: '0.7rem',
                    color: saveStatus === 'saving' ? 'var(--accent-color)' : 'var(--text-color)',
                    opacity: 0.6,
                    minWidth: '60px',
                    textAlign: 'right'
                }}>
                    {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
                </div>
            </div>
        </div>
    );
};

export default Toolbar;

