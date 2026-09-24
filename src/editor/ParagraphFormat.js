import { Extension } from '@tiptap/core';

// Word-style paragraph formatting on paragraphs and headings. Values are kept
// in the units Word uses so .docx round-trips without rounding drift:
//   lineHeight   multiple of single spacing (1, 1.15, 1.5, 2)
//   spaceBefore  points      spaceAfter  points
//   indent       points (left indent)
//   firstLine    points (negative = hanging indent)
// null means "use the style default" (see editor.css).

const TYPES = ['paragraph', 'heading'];
export const INDENT_STEP_PT = 36; // 0.5 in, Word's default tab stop

/** Parse a CSS length (pt/px/in/em) into points. */
export function cssToPt(value) {
    if (value == null || value === '') return null;
    const m = String(value).trim().match(/^(-?[\d.]+)\s*(pt|px|in|cm|mm|em|rem)?$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const unit = m[2] || 'px';
    const factor = { pt: 1, px: 0.75, in: 72, cm: 72 / 2.54, mm: 72 / 25.4, em: 12, rem: 12 }[unit];
    return Math.round(n * factor * 100) / 100;
}

export const ParagraphFormat = Extension.create({
    name: 'paragraphFormat',

    addGlobalAttributes() {
        return [
            {
                types: TYPES,
                attributes: {
                    lineHeight: {
                        default: null,
                        parseHTML: (el) => {
                            const v = el.style.lineHeight;
                            // Unitless multiples only; absolute line heights
                            // from pasted HTML are dropped.
                            return /^[\d.]+$/.test(v) ? parseFloat(v) : null;
                        },
                        renderHTML: (a) => (a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {}),
                    },
                    spaceBefore: {
                        default: null,
                        parseHTML: (el) => cssToPt(el.style.marginTop),
                        renderHTML: (a) => (a.spaceBefore != null ? { style: `margin-top: ${a.spaceBefore}pt` } : {}),
                    },
                    spaceAfter: {
                        default: null,
                        parseHTML: (el) => cssToPt(el.style.marginBottom),
                        renderHTML: (a) => (a.spaceAfter != null ? { style: `margin-bottom: ${a.spaceAfter}pt` } : {}),
                    },
                    indent: {
                        default: null,
                        parseHTML: (el) => cssToPt(el.style.marginLeft) || null,
                        renderHTML: (a) => (a.indent ? { style: `margin-left: ${a.indent}pt` } : {}),
                    },
                    firstLine: {
                        default: null,
                        parseHTML: (el) => cssToPt(el.style.textIndent) || null,
                        renderHTML: (a) => (a.firstLine ? { style: `text-indent: ${a.firstLine}pt` } : {}),
                    },
                },
            },
        ];
    },

    addCommands() {
        const setOnBlocks = (attrs, commands) =>
            TYPES.map((t) => commands.updateAttributes(t, attrs)).some(Boolean);
        const currentIndent = (state) => state.selection.$from.parent.attrs.indent || 0;

        return {
            setLineHeight: (lineHeight) => ({ commands }) => setOnBlocks({ lineHeight }, commands),
            setParagraphSpacing: (spacing) => ({ commands }) => setOnBlocks(spacing, commands),
            indentParagraph: () => ({ editor, state, commands }) => {
                if (editor.isActive('listItem')) return commands.sinkListItem('listItem');
                return setOnBlocks({ indent: Math.min(currentIndent(state) + INDENT_STEP_PT, 432) }, commands);
            },
            outdentParagraph: () => ({ editor, state, commands }) => {
                if (editor.isActive('listItem')) return commands.liftListItem('listItem');
                const next = currentIndent(state) - INDENT_STEP_PT;
                return setOnBlocks({ indent: next > 0 ? next : null }, commands);
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            'Mod-]': () => this.editor.commands.indentParagraph(),
            'Mod-[': () => this.editor.commands.outdentParagraph(),
            'Mod-1': () => this.editor.commands.setLineHeight(1),
            'Mod-5': () => this.editor.commands.setLineHeight(1.5),
            'Mod-2': () => this.editor.commands.setLineHeight(2),
        };
    },
});
