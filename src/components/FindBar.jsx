import { useEffect, useRef, useState } from 'react';
import { useEditorState } from '@tiptap/react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { findKey } from '../editor/FindReplace';

export default function FindBar({ editor, showReplace, onClose }) {
    const [query, setQuery] = useState(() => {
        if (!editor) return '';
        const { from, to } = editor.state.selection;
        const selected = editor.state.doc.textBetween(from, to, ' ');
        return selected.length < 200 ? selected : '';
    });
    const [replacement, setReplacement] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [wholeWord, setWholeWord] = useState(false);
    const input = useRef(null);

    const found = useEditorState({
        editor,
        selector: ({ editor: e }) => {
            const s = e ? findKey.getState(e.state) : null;
            return { count: s?.matches.length || 0, index: s?.index ?? -1 };
        },
    });

    useEffect(() => {
        input.current?.focus();
        input.current?.select();
    }, []);

    useEffect(() => {
        editor?.commands.setFindQuery(query, { caseSensitive, wholeWord });
    }, [editor, query, caseSensitive, wholeWord]);

    useEffect(() => () => editor?.commands.clearFind(), [editor]);

    const close = () => {
        editor?.commands.clearFind();
        editor?.commands.focus();
        onClose();
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') {
            e.preventDefault();
            if (e.shiftKey) editor.commands.findPrevious();
            else editor.commands.findNext();
        }
    };

    const status = !query ? '' : found.count ? `${found.index + 1} of ${found.count}` : 'No results';

    return (
        <div className="qw-find" role="search" onKeyDown={onKeyDown}>
            <input ref={input} type="text" placeholder="Find in document" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find" />
            <div className="qw-find-row">
                <button type="button" className="qw-btn" title="Previous (Shift+Enter)" disabled={!found.count} onClick={() => editor.commands.findPrevious()}><ChevronUp size={16} /></button>
                <button type="button" className="qw-btn" title="Next (Enter)" disabled={!found.count} onClick={() => editor.commands.findNext()}><ChevronDown size={16} /></button>
                <button type="button" className="qw-btn" title="Close (Esc)" onClick={close}><X size={16} /></button>
            </div>
            {showReplace && (
                <>
                    <input type="text" placeholder="Replace with" value={replacement} onChange={(e) => setReplacement(e.target.value)} aria-label="Replace with" />
                    <div className="qw-find-row">
                        <button type="button" className="qw-btn" disabled={!found.count} onClick={() => editor.commands.replaceCurrent(replacement)}>Replace</button>
                        <button type="button" className="qw-btn" disabled={!found.count} onClick={() => editor.commands.replaceAll(replacement)}>All</button>
                    </div>
                </>
            )}
            <div className="qw-find-opts">
                <label><input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Match case</label>
                <label><input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} /> Whole words</label>
                <span className="qw-find-count" aria-live="polite">{status}</span>
            </div>
        </div>
    );
}
