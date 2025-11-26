import React, { useRef, useLayoutEffect } from 'react';

const Page = ({ id, content, onContentChange, registerPageRef, pageNumber, isFocused, onFocus }) => {
    const contentRef = useRef(null);
    const pageRef = useRef(null);

    // Register ref with parent
    useLayoutEffect(() => {
        if (contentRef.current) {
            registerPageRef(id, contentRef.current);
        }
    }, [id, registerPageRef]);

    // Sync content
    useLayoutEffect(() => {
        if (contentRef.current && content !== contentRef.current.innerHTML) {
            if (document.activeElement !== contentRef.current) {
                contentRef.current.innerHTML = content;
            } else {
                // If focused, try to preserve cursor if content changed externally
                if (content !== contentRef.current.innerHTML) {
                    const savedSel = saveSelection(contentRef.current);
                    contentRef.current.innerHTML = content;
                    restoreSelection(contentRef.current, savedSel);
                }
            }
        }
    }, [content]);

    // Focus
    useLayoutEffect(() => {
        if (isFocused && contentRef.current) {
            contentRef.current.focus();
        }
    }, [isFocused]);

    const handleInput = (e) => {
        onContentChange(id, e.currentTarget.innerHTML);
    };

    return (
        <div className="page" ref={pageRef} data-page-number={pageNumber}>
            <div
                className="page-content"
                contentEditable
                ref={contentRef}
                onInput={handleInput}
                onFocus={() => onFocus(id)}
                spellCheck={false}
            />
            <div className="page-number">{pageNumber}</div>
        </div>
    );
};

// Helper to save/restore selection (cursor position)
const saveSelection = (containerEl) => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(containerEl);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const start = preSelectionRange.toString().length;
        return {
            start: start,
            end: start + range.toString().length
        };
    }
    return { start: 0, end: 0 };
};

const restoreSelection = (containerEl, savedSel) => {
    let charIndex = 0;
    const range = document.createRange();
    range.setStart(containerEl, 0);
    range.collapse(true);
    const nodeStack = [containerEl];
    let node;
    let foundStart = false;
    let foundEnd = false;

    while (!foundEnd && (node = nodeStack.pop())) {
        if (node.nodeType === 3) {
            const nextCharIndex = charIndex + node.length;
            if (!foundStart && savedSel.start >= charIndex && savedSel.start <= nextCharIndex) {
                range.setStart(node, savedSel.start - charIndex);
                foundStart = true;
            }
            if (foundStart && savedSel.end >= charIndex && savedSel.end <= nextCharIndex) {
                range.setEnd(node, savedSel.end - charIndex);
                foundEnd = true;
            }
            charIndex = nextCharIndex;
        } else {
            let i = node.childNodes.length;
            while (i--) {
                nodeStack.push(node.childNodes[i]);
            }
        }
    }

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
};

export default Page;
