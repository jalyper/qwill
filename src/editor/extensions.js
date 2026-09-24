import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { CharacterCount } from '@tiptap/extensions';
import { ParagraphFormat } from './ParagraphFormat';
import { PageBreak } from './PageBreak';
import { FindReplace } from './FindReplace';
import { Pagination } from './pagination/Pagination';

/**
 * The document schema + behaviour. Pagination is only added when a page view
 * is mounted (it needs the DOM); the schema is identical either way, so the
 * .docx converters and tests can build it headless via getSchema().
 */
export function createExtensions({ pagination } = {}) {
    const list = [
        StarterKit.configure({
            heading: { levels: [1, 2, 3, 4, 5, 6] },
            link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
            undoRedo: { depth: 500 },
        }),
        TextStyleKit.configure({ lineHeight: false }),
        TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
        Highlight.configure({ multicolor: true }),
        Subscript,
        Superscript,
        Image.configure({
            inline: true,
            allowBase64: true,
            resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 16, minHeight: 16 },
        }),
        TableKit.configure({ table: { resizable: true } }),
        CharacterCount,
        ParagraphFormat,
        PageBreak,
        FindReplace,
    ];
    if (pagination) list.push(Pagination.configure(pagination));
    return list;
}

export const FONT_FAMILIES = [
    { name: 'Calibri', value: 'Calibri, Carlito, "Segoe UI", sans-serif' },
    { name: 'Arial', value: 'Arial, "Liberation Sans", Helvetica, sans-serif' },
    { name: 'Times New Roman', value: '"Times New Roman", "Liberation Serif", Times, serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Garamond', value: 'Garamond, "EB Garamond", serif' },
    { name: 'Cambria', value: 'Cambria, Caladea, serif' },
    { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
    { name: 'Segoe UI', value: '"Segoe UI", system-ui, sans-serif' },
    { name: 'Courier New', value: '"Courier New", "Liberation Mono", Courier, monospace' },
    { name: 'Consolas', value: 'Consolas, "Cascadia Mono", monospace' },
];

export const DEFAULT_FONT = FONT_FAMILIES[0];
export const DEFAULT_FONT_SIZE_PT = 11;
export const FONT_SIZES_PT = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

/** First family name in a CSS font-family list, unquoted. */
export function primaryFamily(cssValue) {
    if (!cssValue) return null;
    return cssValue.split(',')[0].trim().replace(/^["']|["']$/g, '');
}

/** CSS font-family value for a bare family name (e.g. from .docx). */
export function familyToCss(name) {
    const known = FONT_FAMILIES.find((f) => f.name.toLowerCase() === String(name).toLowerCase());
    if (known) return known.value;
    return /[\s,]/.test(name) ? `"${name}"` : name;
}
