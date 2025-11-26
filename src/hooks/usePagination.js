import { useCallback } from 'react';

// 11 inches * 96 DPI = 1056px
// We want some padding for the text content within the page.
// Let's assume standard 1 inch margins top/bottom.
// So content height = 11in - 2in = 9in = 864px.
const PAGE_HEIGHT_PX = 1056;
const CONTENT_HEIGHT_PX = 864; // 9 inches

export const usePagination = () => {

    const paginate = useCallback((editorRef, setContent) => {
        if (!editorRef.current) return;

        const container = editorRef.current;
        // We need to work with live nodes to preserve state/cursor where possible
        // But we also need to be careful about modifying the list while iterating

        // 1. Identify logical blocks (elements that are NOT page breaks)
        const children = Array.from(container.children);
        const blocks = children.filter(child => !child.classList.contains('page-break'));

        console.log('Paginate running. Blocks:', blocks.length);

        if (blocks.length === 0) return;

        let currentHeight = 0;
        let domChanged = false;
        let lastBlock = null;

        // Helper to create a break
        const createBreak = () => {
            const div = document.createElement('div');
            div.className = 'page-break';
            div.contentEditable = 'false';
            return div;
        };

        // We will build a list of operations or just do them?
        // Doing them in-place is tricky if we insert/remove.
        // Let's iterate through BLOCKS and check the gap BEFORE them.

        blocks.forEach((block, index) => {
            const height = block.offsetHeight;

            // If this single block is huge, we might need to split it (advanced)
            // For now, let's just push it to next page if it doesn't fit

            if (currentHeight + height > CONTENT_HEIGHT_PX) {
                // Insert break before this block
                const breakEl = createBreak();
                container.insertBefore(breakEl, block);

                // Reset height for new page
                currentHeight = height;
                domChanged = true;
            } else {
                currentHeight += height;
            }

            lastBlock = block;
        });

        // If DOM changed, update the content state to match
        // This ensures saving works and React doesn't get out of sync
        if (domChanged) {
            console.log('DOM changed, updating content state');
            const newHtml = container.innerHTML;
            setContent(newHtml);
        }

    }, []);

    return {
        paginate
    };
};
