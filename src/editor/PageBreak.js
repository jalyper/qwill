import { Node, mergeAttributes } from '@tiptap/core';

// An explicit page break (Ctrl+Enter, like Word). Pagination treats it as a
// forced break; .docx stores it as <w:br w:type="page"/>.
export const PageBreak = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,
    selectable: true,

    parseHTML() {
        return [
            { tag: 'div[data-type="page-break"]' },
            {
                tag: 'div',
                getAttrs: (el) =>
                    /always|page/.test(el.style.breakAfter || el.style.pageBreakAfter || '') &&
                    !el.textContent.trim()
                        ? {}
                        : false,
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'page-break', class: 'qw-page-break' })];
    },

    addCommands() {
        return {
            // Inserting a block mid-paragraph splits it, so the text after the
            // cursor starts the next page; TrailingNode keeps a paragraph
            // after a break at the end of the document.
            setPageBreak: () => ({ commands }) => commands.insertContent({ type: this.name }),
        };
    },

    addKeyboardShortcuts() {
        return { 'Mod-Enter': () => this.editor.commands.setPageBreak() };
    },
});
