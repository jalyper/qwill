import { useCallback, useRef } from 'react';

// Content height per page: 11in - 2in margins = 9in = 864px at 96dpi
const CONTENT_HEIGHT_PX = 864;

export const usePagination = () => {
    const rafRef = useRef(null);

    const paginate = useCallback((editorRef) => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        rafRef.current = requestAnimationFrame(() => {
            if (!editorRef.current) return;

            const container = editorRef.current;

            // 1. Remove existing page breaks
            container.querySelectorAll('.page-break').forEach(b => b.remove());

            // 2. Wrap bare text nodes in divs for measurement
            for (const node of Array.from(container.childNodes)) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                    const wrapper = document.createElement('div');
                    node.parentNode.insertBefore(wrapper, node);
                    wrapper.appendChild(node);
                }
            }

            // 3. Calculate page boundaries using caretRangeFromPoint.
            //    This finds the exact text position at each page break Y coordinate
            //    and inserts a break element there — works regardless of block structure.
            const containerRect = container.getBoundingClientRect();
            const paddingTop = parseFloat(getComputedStyle(container).paddingTop) || 0;
            const paddingLeft = parseFloat(getComputedStyle(container).paddingLeft) || 0;
            const contentStartY = containerRect.top + paddingTop;
            const xProbe = containerRect.left + paddingLeft + 10;

            // Total content height (scroll height minus padding)
            const totalContentHeight = container.scrollHeight - paddingTop * 2;
            const numBreaks = Math.floor(totalContentHeight / CONTENT_HEIGHT_PX);

            if (numBreaks === 0) return;

            // 4. For each page boundary, find where to split and insert a break.
            //    We work backwards to avoid position shifts affecting later breaks.
            const breakPositions = [];

            for (let i = numBreaks; i >= 1; i--) {
                // Y coordinate in viewport space for this page boundary
                const breakY = contentStartY + (i * CONTENT_HEIGHT_PX);

                // Find the range at this Y position
                let range = null;
                if (document.caretRangeFromPoint) {
                    range = document.caretRangeFromPoint(xProbe, breakY);
                } else if (document.caretPositionFromPoint) {
                    const pos = document.caretPositionFromPoint(xProbe, breakY);
                    if (pos) {
                        range = document.createRange();
                        range.setStart(pos.offsetNode, pos.offset);
                    }
                }

                if (!range) continue;

                // Find the nearest block-level parent to split at
                let splitNode = range.startContainer;
                if (splitNode.nodeType === Node.TEXT_NODE) {
                    splitNode = splitNode.parentNode;
                }

                // Walk up to find a direct child of the container
                while (splitNode && splitNode.parentNode !== container) {
                    splitNode = splitNode.parentNode;
                }

                if (!splitNode || splitNode.classList?.contains('page-break')) continue;

                // If the range is inside a text node within this block,
                // we need to split the block at that point
                const originalRange = range;
                const startContainer = originalRange.startContainer;
                const startOffset = originalRange.startOffset;

                if (startContainer.nodeType === Node.TEXT_NODE &&
                    startContainer.parentNode === splitNode ||
                    container.contains(startContainer)) {
                    // Split the text node and its parent block at the break point
                    const splitRange = document.createRange();
                    splitRange.setStart(splitNode, 0);
                    splitRange.setEnd(startContainer, startOffset);

                    // Extract content before the split into a new div
                    const beforeContent = splitRange.cloneContents();
                    const afterDiv = splitNode;

                    // Create a new div for the content before the break
                    const beforeDiv = document.createElement('div');
                    beforeDiv.appendChild(beforeContent);

                    // Remove the extracted content from the original
                    splitRange.deleteContents();

                    // Insert the before-div and page break before the remaining content
                    container.insertBefore(beforeDiv, afterDiv);

                    const breakEl = document.createElement('div');
                    breakEl.className = 'page-break';
                    breakEl.contentEditable = 'false';
                    container.insertBefore(breakEl, afterDiv);

                    // Clean up empty nodes
                    if (afterDiv.textContent.trim() === '' && !afterDiv.querySelector('img')) {
                        afterDiv.remove();
                    }
                } else {
                    // Simple case: insert break before this block
                    const breakEl = document.createElement('div');
                    breakEl.className = 'page-break';
                    breakEl.contentEditable = 'false';
                    container.insertBefore(breakEl, splitNode);
                }
            }
        });
    }, []);

    return { paginate };
};
