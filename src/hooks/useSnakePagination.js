import { useState, useLayoutEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const useSnakePagination = (initialPages) => {
    const [pages, setPages] = useState(initialPages);
    const [pageRefs, setPageRefs] = useState({});

    const registerPageRef = useCallback((id, ref) => {
        setPageRefs(prev => ({ ...prev, [id]: ref }));
    }, []);

    const balancePages = useCallback(() => {
        console.warn('[balancePages] Running, pages:', pages.length);

        let newPages = pages.map(p => ({ ...p }));
        let hasChanges = false;

        for (let i = 0; i < newPages.length; i++) {
            const pageId = newPages[i].id;
            const pageEl = pageRefs[pageId];

            console.warn(`[balancePages] Processing page ${i}, id: ${pageId}, has ref: ${!!pageEl}`);

            if (!pageEl) {
                console.warn(`[balancePages] Page ref missing for ${pageId}`);
                continue;
            }

            console.warn(`[balancePages] Page ${i} - scrollHeight: ${pageEl.scrollHeight}, clientHeight: ${pageEl.clientHeight}, content length: ${newPages[i].content.length}`);

            // Check Overflow
            while (pageEl.scrollHeight > pageEl.clientHeight + 1) {
                const lastChild = pageEl.lastChild;
                if (!lastChild) break;

                let contentToMove = '';

                if (lastChild.nodeType === Node.TEXT_NODE) {
                    const text = lastChild.textContent;
                    let min = 0;
                    let max = text.length;
                    let splitIndex = 0;

                    pageEl.removeChild(lastChild);
                    if (pageEl.scrollHeight <= pageEl.clientHeight + 1) {
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
                            lastChild.textContent = text.substring(0, splitIndex);
                            pageEl.appendChild(lastChild);
                            contentToMove = text.substring(splitIndex);
                        } else {
                            contentToMove = text;
                        }
                    } else {
                        contentToMove = text;
                    }
                } else {
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

                console.warn(`[balancePages] Page ${i} - Checking underflow. Next page id: ${nextPageId}, has ref: ${!!nextPageEl}`);

                if (nextPageEl) {
                    console.warn(`[balancePages] Page ${i} - Next page has ${nextPageEl.childNodes.length} child nodes`);
                    while (nextPageEl.firstChild) {
                        const firstChild = nextPageEl.firstChild;
                        const clone = firstChild.cloneNode(true);

                        pageEl.appendChild(clone);

                        const fits = pageEl.scrollHeight <= pageEl.clientHeight + 1;
                        console.warn(`[balancePages] Page ${i} - Trying to pull node type ${firstChild.nodeType}. Fits? ${fits}`);

                        if (fits) {
                            newPages[i].content = pageEl.innerHTML;
                            nextPageEl.removeChild(firstChild);
                            newPages[i + 1].content = nextPageEl.innerHTML;
                            hasChanges = true;
                        } else {
                            if (firstChild.nodeType === Node.TEXT_NODE) {
                                const text = firstChild.textContent;
                                let min = 0;
                                let max = text.length;
                                let splitIndex = 0;

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
                                    const textToMove = text.substring(0, splitIndex);
                                    const textToKeep = text.substring(splitIndex);

                                    clone.textContent = textToMove;
                                    newPages[i].content = pageEl.innerHTML;

                                    firstChild.textContent = textToKeep;
                                    newPages[i + 1].content = nextPageEl.innerHTML;

                                    hasChanges = true;
                                    break;
                                } else {
                                    pageEl.removeChild(clone);
                                    break;
                                }
                            } else {
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
                console.warn(`[balancePages] Removing empty page ${i}`);
                newPages.splice(i, 1);
                hasChanges = true;
            }
        }

        if (hasChanges) {
            console.warn('[balancePages] Setting new pages, count:', newPages.length);
            setPages(newPages);
        } else {
            console.warn('[balancePages] No changes needed');
        }
    }, [pages, pageRefs]);

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
