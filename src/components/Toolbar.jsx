import { useRef } from 'react';
import { useEditorState } from '@tiptap/react';
import {
    AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowUpDown, Baseline, Bold, ChevronDown, Highlighter,
    ImagePlus, IndentDecrease, IndentIncrease, Italic, Link, List, ListOrdered, Minus, Redo2, RemoveFormatting,
    Search, SeparatorHorizontal, Strikethrough, Subscript, Superscript, Table, Underline, Undo2,
} from 'lucide-react';
import { FONT_FAMILIES, FONT_SIZES_PT, primaryFamily, familyToCss } from '../editor/extensions';
import { normalizeStyles } from '../document/docStyles';
import { toPoints } from '../docx/shared';
import { Menu, MenuItem, MenuSeparator } from './Menu';

const STYLES = [
    { id: 'p', label: 'Normal' },
    { id: 'h1', label: 'Heading 1' },
    { id: 'h2', label: 'Heading 2' },
    { id: 'h3', label: 'Heading 3' },
    { id: 'h4', label: 'Heading 4' },
    { id: 'quote', label: 'Quote' },
    { id: 'code', label: 'Code' },
];

const LINE_SPACINGS = [1, 1.08, 1.15, 1.5, 2, 2.5, 3];

function Btn({ on, title, onClick, disabled, children }) {
    return (
        <button
            type="button"
            className={`qw-btn${on ? ' is-on' : ''}`}
            title={title}
            aria-label={title}
            aria-pressed={on === undefined ? undefined : !!on}
            disabled={disabled}
            // Keep the document selection while clicking toolbar buttons.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function readState(editor, styles) {
    if (!editor) return null;
    const ts = editor.getAttributes('textStyle');
    const block = editor.state.selection.$from.parent;
    let style = 'p';
    if (editor.isActive('codeBlock')) style = 'code';
    else if (editor.isActive('blockquote')) style = 'quote';
    else if (editor.isActive('heading')) style = `h${editor.getAttributes('heading').level}`;
    const level = /^h\d$/.test(style) ? Number(style.slice(1)) : null;
    const base = level ? styles.headings[level] : styles.normal;
    return {
        style,
        font: primaryFamily(ts.fontFamily) || base.font,
        size: toPoints(ts.fontSize) || base.size,
        color: ts.color || null,
        highlight: editor.getAttributes('highlight').color || null,
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        sup: editor.isActive('superscript'),
        sub: editor.isActive('subscript'),
        align: block.attrs.textAlign || 'left',
        lineHeight: block.attrs.lineHeight || null,
        bullet: editor.isActive('bulletList'),
        ordered: editor.isActive('orderedList'),
        link: editor.isActive('link'),
        inTable: editor.isActive('table'),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
    };
}

export default function Toolbar({ editor, docStyles, onFind, onLink, fileMenu }) {
    const styles = normalizeStyles(docStyles);
    const s = useEditorState({ editor, selector: ({ editor: e }) => readState(e, styles) });
    const imageInput = useRef(null);
    const off = !editor || !s;
    const chain = () => editor.chain().focus();

    const setStyle = (id) => {
        const c = chain();
        if (id === 'code') return c.setCodeBlock().run();
        if (s.style === 'code') c.setParagraph();
        if (id === 'quote') return (s.style === 'quote' ? c : c.setParagraph().setBlockquote()).run();
        if (s.style === 'quote') c.unsetBlockquote();
        if (id === 'p') return c.setParagraph().run();
        return c.setHeading({ level: Number(id.slice(1)) }).run();
    };

    const setFont = (name) => {
        const level = /^h\d$/.test(s.style) ? Number(s.style.slice(1)) : null;
        const base = (level ? styles.headings[level] : styles.normal).font;
        if (name === base) chain().unsetFontFamily().run();
        else chain().setFontFamily(familyToCss(name)).run();
    };

    const setSize = (pt) => {
        const n = parseFloat(pt);
        if (Number.isFinite(n) && n >= 1 && n <= 1638) chain().setFontSize(`${n}pt`).run();
    };

    const insertImage = async (file) => {
        if (!file) return;
        const src = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        const img = new Image();
        img.src = src;
        await img.decode().catch(() => {});
        const dom = editor.view.dom;
        const cs = getComputedStyle(dom);
        const contentWidth = dom.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const width = Math.round(Math.min(img.naturalWidth || 300, Math.max(contentWidth, 100)));
        const height = img.naturalWidth ? Math.round((width * img.naturalHeight) / img.naturalWidth) : null;
        chain().setImage({ src, alt: file.name.replace(/\.[^.]+$/, ''), width, height }).run();
    };

    const fontOptions = s && !FONT_FAMILIES.some((f) => f.name === s.font) ? [{ name: s.font }, ...FONT_FAMILIES] : FONT_FAMILIES;
    const sizeOptions = s && !FONT_SIZES_PT.includes(s.size) ? [...FONT_SIZES_PT, s.size].sort((a, b) => a - b) : FONT_SIZES_PT;
    const lineHeight = s?.lineHeight || styles.normal.lineHeight;

    return (
        <div className="qw-toolbar" role="toolbar" aria-label="Formatting">
            <div className="qw-group">{fileMenu}</div>

            <div className="qw-group">
                <Btn title="Undo (Ctrl+Z)" disabled={off || !s.canUndo} onClick={() => chain().undo().run()}><Undo2 size={16} /></Btn>
                <Btn title="Redo (Ctrl+Y)" disabled={off || !s.canRedo} onClick={() => chain().redo().run()}><Redo2 size={16} /></Btn>
            </div>

            <div className="qw-group">
                <select className="qw-select style" title="Paragraph style" disabled={off} value={s?.style || 'p'} onChange={(e) => setStyle(e.target.value)}>
                    {STYLES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                </select>
                <select className="qw-select font" title="Font" disabled={off} value={s?.font || ''} onChange={(e) => setFont(e.target.value)}>
                    {fontOptions.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                </select>
                <select className="qw-select size" title="Font size (pt)" disabled={off} value={s?.size || 11} onChange={(e) => setSize(e.target.value)}>
                    {sizeOptions.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
                </select>
            </div>

            <div className="qw-group">
                <Btn title="Bold (Ctrl+B)" on={s?.bold} disabled={off} onClick={() => chain().toggleBold().run()}><Bold size={16} /></Btn>
                <Btn title="Italic (Ctrl+I)" on={s?.italic} disabled={off} onClick={() => chain().toggleItalic().run()}><Italic size={16} /></Btn>
                <Btn title="Underline (Ctrl+U)" on={s?.underline} disabled={off} onClick={() => chain().toggleUnderline().run()}><Underline size={16} /></Btn>
                <Btn title="Strikethrough" on={s?.strike} disabled={off} onClick={() => chain().toggleStrike().run()}><Strikethrough size={16} /></Btn>
                <Btn title="Superscript (Ctrl+.)" on={s?.sup} disabled={off} onClick={() => chain().toggleSuperscript().run()}><Superscript size={16} /></Btn>
                <Btn title="Subscript (Ctrl+,)" on={s?.sub} disabled={off} onClick={() => chain().toggleSubscript().run()}><Subscript size={16} /></Btn>
                <label className="qw-btn qw-color" title="Text color">
                    <Baseline size={16} />
                    <span className="qw-swatch" style={{ background: s?.color || 'currentColor' }} />
                    <input type="color" disabled={off} value={s?.color || '#000000'} onChange={(e) => chain().setColor(e.target.value).run()} aria-label="Text color" />
                </label>
                <label className="qw-btn qw-color" title="Highlight color">
                    <Highlighter size={16} />
                    <span className="qw-swatch" style={{ background: s?.highlight || '#ffff00' }} />
                    <input type="color" disabled={off} value={s?.highlight || '#ffff00'} onChange={(e) => chain().setHighlight({ color: e.target.value }).run()} aria-label="Highlight color" />
                </label>
                <Btn title="Clear formatting" disabled={off} onClick={() => chain().unsetAllMarks().run()}><RemoveFormatting size={16} /></Btn>
            </div>

            <div className="qw-group">
                <Btn title="Align left (Ctrl+Shift+L)" on={s?.align === 'left'} disabled={off} onClick={() => chain().setTextAlign('left').run()}><AlignLeft size={16} /></Btn>
                <Btn title="Center (Ctrl+Shift+E)" on={s?.align === 'center'} disabled={off} onClick={() => chain().setTextAlign('center').run()}><AlignCenter size={16} /></Btn>
                <Btn title="Align right (Ctrl+Shift+R)" on={s?.align === 'right'} disabled={off} onClick={() => chain().setTextAlign('right').run()}><AlignRight size={16} /></Btn>
                <Btn title="Justify (Ctrl+Shift+J)" on={s?.align === 'justify'} disabled={off} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify size={16} /></Btn>
                <Menu disabled={off} title="Line and paragraph spacing" label={<><ArrowUpDown size={16} /><ChevronDown size={12} /></>}>
                    {LINE_SPACINGS.map((lh) => (
                        <MenuItem key={lh} checked={lineHeight === lh} onClick={() => chain().setLineHeight(lh).run()}>
                            {String(lh)}
                        </MenuItem>
                    ))}
                    <MenuSeparator />
                    <MenuItem onClick={() => chain().setParagraphSpacing({ spaceBefore: 12 }).run()}>Add space before paragraph</MenuItem>
                    <MenuItem onClick={() => chain().setParagraphSpacing({ spaceBefore: 0 }).run()}>Remove space before paragraph</MenuItem>
                    <MenuItem onClick={() => chain().setParagraphSpacing({ spaceAfter: 8 }).run()}>Add space after paragraph</MenuItem>
                    <MenuItem onClick={() => chain().setParagraphSpacing({ spaceAfter: 0 }).run()}>Remove space after paragraph</MenuItem>
                </Menu>
            </div>

            <div className="qw-group">
                <Btn title="Bullets (Ctrl+Shift+8)" on={s?.bullet} disabled={off} onClick={() => chain().toggleBulletList().run()}><List size={16} /></Btn>
                <Btn title="Numbering (Ctrl+Shift+7)" on={s?.ordered} disabled={off} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={16} /></Btn>
                <Btn title="Decrease indent (Ctrl+[)" disabled={off} onClick={() => chain().outdentParagraph().run()}><IndentDecrease size={16} /></Btn>
                <Btn title="Increase indent (Ctrl+])" disabled={off} onClick={() => chain().indentParagraph().run()}><IndentIncrease size={16} /></Btn>
            </div>

            <div className="qw-group">
                <Btn title="Link (Ctrl+K)" on={s?.link} disabled={off} onClick={onLink}><Link size={16} /></Btn>
                <Btn title="Insert picture" disabled={off} onClick={() => imageInput.current?.click()}><ImagePlus size={16} /></Btn>
                <input
                    ref={imageInput}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/bmp"
                    hidden
                    onChange={(e) => {
                        insertImage(e.target.files?.[0]);
                        e.target.value = '';
                    }}
                />
                <Menu disabled={off} title="Table" label={<><Table size={16} /><ChevronDown size={12} /></>}>
                    <MenuItem onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()}>Insert 3 × 3 table</MenuItem>
                    <MenuItem onClick={() => chain().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run()}>Insert 4 × 4 table with header</MenuItem>
                    <MenuSeparator />
                    <MenuItem disabled={!s?.inTable} onClick={() => chain().addRowBefore().run()}>Insert row above</MenuItem>
                    <MenuItem disabled={!s?.inTable} onClick={() => chain().addRowAfter().run()}>Insert row below</MenuItem>
                    <MenuItem disabled={!s?.inTable} onClick={() => chain().addColumnBefore().run()}>Insert column left</MenuItem>
                    <MenuItem disabled={!s?.inTable} onClick={() => chain().addColumnAfter().run()}>Insert column right</MenuItem>
                    <MenuSeparator />
                    <MenuItem disabled={!s?.inTable} onClick={() => chain().mergeOrSplit().run()}>Merge / split cells</MenuItem>
                    <MenuItem disabled={!s?.inTable} onClick={() => chain().toggleHeaderRow().run()}>Toggle header row</MenuItem>
                    <MenuSeparator />
                    <MenuItem disabled={!s?.inTable} onClick={() => chain().deleteRow().run()}>Delete row</MenuItem>
                    <MenuItem disabled={!s?.inTable} onClick={() => chain().deleteColumn().run()}>Delete column</MenuItem>
                    <MenuItem disabled={!s?.inTable} onClick={() => chain().deleteTable().run()}>Delete table</MenuItem>
                </Menu>
                <Btn title="Page break (Ctrl+Enter)" disabled={off} onClick={() => chain().setPageBreak().run()}><SeparatorHorizontal size={16} /></Btn>
                <Btn title="Horizontal line" disabled={off} onClick={() => chain().setHorizontalRule().run()}><Minus size={16} /></Btn>
            </div>

            <div className="qw-group">
                <Btn title="Find and replace (Ctrl+F)" disabled={off} onClick={onFind}><Search size={16} /></Btn>
            </div>
        </div>
    );
}
