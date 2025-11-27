import { useState, useLayoutEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const useSnakePagination = (initialPages) => {
    const [pages, setPages] = useState(initialPages);
    const [pageRefs, setPageRefs] = useState({});

    const registerPageRef = useCallback((id, ref) => {
        setPageRefs(prev => {
            if (prev[id] === ref) return prev;
            return { ...prev, [id]: ref };
        });
    }, []);

    // Cleanup refs for pages that no longer exist
    useLayoutEffect(() => {
        const currentPageIds = new Set(pages.map(p => p.id));
        setPageRefs(prev => {
            const cleaned = {};
            Object.keys(prev).forEach(id => {
                if (currentPageIds.has(id)) {
                    cleaned[id] = prev[id];
                }
            });
            return cleaned;
        });
    }, [pages]);

    const balancePages = useCallback(() => {
        // Guard: Only balance when all page refs are registered
        const allRefsRegistered = pages.every(page => pageRefs[page.id]);
        if (!allRefsRegistered) {
            console.log('[balancePages] Skipping: not all page refs registered yet', {
                pagesCount: pages.length,
                refsCount: Object.keys(pageRefs).length,
                missingRefs: pages.filter(p => !pageRefs[p.id]).map(p => p.id)
            });
            return;
        }

        let newPages = pages.map(p => ({ ...p }));
        let hasChanges = false;

        for (let i = 0; i < newPages.length; i++) {
            const pageId = newPages[i].id;
            const pageEl = pageRefs[pageId];

            if (!pageEl) continue;

            while (pageEl.scrollHeight > pageEl.clientHeight + 1) {
                const lastChild = pageEl.lastChild;
                if (!lastChild) break;

                let contentToMove = '';

                if (lastChild.nodeType === Node.TEXT_NODE) {
                    const text = lastChild.textContent;
                    let min = 0, max = text.length, splitIndex = 0;

                    pageEl.removeChild(lastChild);
                    if (pageEl.scrollHeight <= pageEl.clientHeight + 1) {
                        while (min <= max) {
                            const mid = Math.floor((min + max) / 2);
                            if (mid === 0) { min = 1; continue; }

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
                    newPages.push({ id: uuidv4(), content: contentToMove });
                }

                newPages[i].content = pageEl.innerHTML;
                hasChanges = true;
            }

            if (i + 1 < newPages.length) {
                const nextPageId = newPages[i + 1].id;
                const nextPageEl = pageRefs[nextPageId];

                if (nextPageEl) {
                    while (nextPageEl.firstChild) {
                        const firstChild = nextPageEl.firstChild;
                        const clone = firstChild.cloneNode(true);
                        pageEl.appendChild(clone);

                        if (pageEl.scrollHeight <= pageEl.clientHeight + 1) {
                            newPages[i].content = pageEl.innerHTML;
                            nextPageEl.removeChild(firstChild);
                            newPages[i + 1].content = nextPageEl.innerHTML;
                            hasChanges = true;
                        } else {
                            if (firstChild.nodeType === Node.TEXT_NODE) {
                                const text = firstChild.textContent;
                                let min = 0, max = text.length, splitIndex = 0;

                                while (min <= max) {
                                    const mid = Math.floor((min + max) / 2);
                                    if (mid === 0) { min = 1; continue; }
                                    clone.textContent = text.substring(0, mid);

                                    if (pageEl.scrollHeight <= pageEl.clientHeight + 1) {
                                        splitIndex = mid;
                                        min = mid + 1;
                                    } else {
                                        max = mid - 1;
                                    }
                                }

                                if (splitIndex > 0) {
                                    clone.textContent = text.substring(0, splitIndex);
                                    newPages[i].content = pageEl.innerHTML;
                                    firstChild.textContent = text.substring(splitIndex);
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

        let removedPageIndex = -1;
        for (let i = newPages.length - 1; i > 0; i--) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newPages[i].content;
            if (tempDiv.textContent.trim() === '' && tempDiv.querySelectorAll('img').length === 0) {
                removedPageIndex = i;
                newPages.splice(i, 1);
                hasChanges = true;
            }
        }

        if (hasChanges) {
            setPages(newPages);

            if (removedPageIndex > 0) {
                setTimeout(() => {
                    const prevPageId = newPages[removedPageIndex - 1]?.id;
                    if (prevPageId && pageRefs[prevPageId]) {
                        const prevPageEl = pageRefs[prevPageId];
                        prevPageEl.focus();
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(prevPageEl);
                        range.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }, 0);
            }
        }
    }, [pages, pageRefs]);

    useLayoutEffect(() => {
        console.log('[useLayoutEffect] Triggered - checking if should balance', {
            pagesCount: pages.length,
            refsCount: Object.keys(pageRefs).length
        });
        balancePages();
    }, [pages, pageRefs]); // Removed balancePages from deps - we want to run when pages or refs change

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