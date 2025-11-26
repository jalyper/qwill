import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const useSnakePagination = (initialPages) => {
    const [pages, setPages] = useState(initialPages);
    const [pageRefs, setPageRefs] = useState({});

    const registerPageRef = useCallback((id, ref) => {
        setPageRefs(prev => ({ ...prev, [id]: ref }));
    }, []);

    const balancePages = useCallback(() => {
        // console.warn('Running balancePages', pages.length);
        let newPages = pages.map(p => ({ ...p })); // Deep clone for safety
        let hasChanges = false;

        // Loop through pages
        for (let i = 0; i < newPages.length; i++) {
            const pageId = newPages[i].id;
            const pageEl = pageRefs[pageId];

            if (!pageEl) {
                // console.warn(`Page ref missing for ${pageId}`);
                continue;
            }

            // Check Overflow
            while (pageEl.scrollHeight > pageEl.clientHeight + 1) {
                // console.warn(`Overflow detected on page ${i}`);
                const lastChild = pageEl.lastChild;
                if (!lastChild) break;

                let contentToMove = '';

                // If text node, try to split it
                if (lastChild.nodeType === Node.TEXT_NODE) {
                    const text = lastChild.textContent;
                    // Binary search for split point
                    let min = 0;
                    let max = text.length;
                    let splitIndex = 0;

                    // First check if removing the whole node solves it
                    pageEl.removeChild(lastChild);
                    if (pageEl.scrollHeight <= pageEl.clientHeight + 1) {
                        // It fits without this node. Find how much we can put back.
                        while (min <= max) {
                            const mid = Math.floor((min + max) / 2);
                            if (mid === 0) {
                                min = 1;
                                continue;
                            }

                            lastChild.textContent = text.substring(0, mid);
                            pageEl.appendChild(lastChild);

                            if (pageEl.scrollHeight <= pageEl.clientHeight + 1) {
                                splitIndex = mid;
                                min = mid + 1;
                            } else {
                                max = mid - 1;
                            }
                            pageEl.removeChild(lastChild);
                        }

                        if (splitIndex > 0 && splitIndex < text.length) {
                            // We found a split point
                            lastChild.textContent = text.substring(0, splitIndex);
                            pageEl.appendChild(lastChild);
                            contentToMove = text.substring(splitIndex);
                        } else {
                            // Either fits entirely (shouldn't happen in this loop) or doesn't fit at all
                            contentToMove = text;
                            // Don't append back if it doesn't fit at all
                        }
                    } else {
                        // Even without this node, it overflows. 
                        // This means previous nodes are causing overflow? 
                        // Or we are in a loop removing multiple nodes.
                        // We just move this whole node and continue loop.
                        contentToMove = text;
                    }
                } else {
                    // Element node
                    contentToMove = lastChild.outerHTML;
                    pageEl.removeChild(lastChild);
                }

                if (i + 1 < newPages.length) {
                    newPages[i + 1].content = contentToMove + newPages[i + 1].content;
                } else {
                    const newId = uuidv4();
                    newPages.push({ id: newId, content: contentToMove });
                }

                newPages[i].content = pageEl.innerHTML;
                hasChanges = true;
            }

            // Check Underflow (Pull from next)
            if (i + 1 < newPages.length) {
                const nextPageId = newPages[i + 1].id;
                const nextPageEl = pageRefs[nextPageId];

                if (nextPageEl) {
                    // console.warn(`Checking underflow for page ${i}, next page has children: ${nextPageEl.childNodes.length}`);
                    while (nextPageEl.firstChild) {
                        const firstChild = nextPageEl.firstChild;
                        const clone = firstChild.cloneNode(true);

                        pageEl.appendChild(clone);

                        // console.warn(`Trying to pull node type ${firstChild.nodeType} to page ${i}. Fits? ${pageEl.scrollHeight <= pageEl.clientHeight + 1}`);

                        if (pageEl.scrollHeight <= pageEl.clientHeight + 1) {
                            const contentToMove = firstChild.nodeType === Node.ELEMENT_NODE ? firstChild.outerHTML : (firstChild.textContent ? firstChild.textContent : '');

                            newPages[i].content = pageEl.innerHTML;
                            nextPageEl.removeChild(firstChild);
                            newPages[i + 1].content = nextPageEl.innerHTML;

                            hasChanges = true;
                        } else {
                            // Doesn't fit entirely.
                            // If text node, try to split.
                            if (firstChild.nodeType === Node.TEXT_NODE) {
                                const text = firstChild.textContent;
                                let min = 0;
                                let max = text.length;
                                let splitIndex = 0;

                                // Binary search for how much fits
                                while (min <= max) {
                                    const mid = Math.floor((min + max) / 2);
                                    if (mid === 0) {
                                        min = 1;
                                        continue;
                                    }

                                    clone.textContent = text.substring(0, mid);

                                    if (pageEl.scrollHeight <= pageEl.clientHeight + 1) {
                                        splitIndex = mid;
                                        min = mid + 1;
                                    } else {
                                        max = mid - 1;
                                    }
                                }

                                if (splitIndex > 0) {
                                    // We found a chunk that fits
                                    const textToMove = text.substring(0, splitIndex);
                                    const textToKeep = text.substring(splitIndex);

                                    // Update current page
                                    // We need to set the clone's text to what fits
                                    clone.textContent = textToMove;
                                    newPages[i].content = pageEl.innerHTML;

                                    // Update next page
                                    // We need to update the firstChild of next page to only have the remaining text
                                    firstChild.textContent = textToKeep;
                                    newPages[i + 1].content = nextPageEl.innerHTML;

                                    hasChanges = true;
                                    // We stop pulling because we filled the page
                                    break;
                                } else {
                                    // Nothing fits
                                    pageEl.removeChild(clone);
                                    break;
                                }
                            } else {
                                // Element node that doesn't fit
                                pageEl.removeChild(clone);
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Remove empty pages (except the first one)
        for (let i = newPages.length - 1; i > 0; i--) {
            const content = newPages[i].content;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            if (tempDiv.textContent.trim() === '' && tempDiv.querySelectorAll('img').length === 0) {
                newPages.splice(i, 1);
                hasChanges = true;
            }
        }

        if (hasChanges) {
            setPages(newPages);
        }
    }, [pages, pageRefs]);

    // Run balancePages whenever pages or refs change
    useLayoutEffect(() => {
        balancePages();
    }, [pages, pageRefs, balancePages]);

    const updatePageContent = (id, newContent) => {
        setPages(prev => prev.map(p => p.id === id ? { ...p, content: newContent } : p));
    };

    return {
        pages,
        setPages,
        registerPageRef,
        updatePageContent,
        balancePages
    };
};
