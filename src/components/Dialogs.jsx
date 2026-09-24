import { useEffect, useRef, useState } from 'react';
import { PAPER_SIZES, normalizePageSetup } from '../document/pageSetup';

export function Dialog({ title, onClose, children, actions }) {
    const ref = useRef(null);
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    });
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') closeRef.current?.();
        };
        document.addEventListener('keydown', onKey);
        ref.current?.querySelector('input, select, button.primary')?.focus();
        return () => document.removeEventListener('keydown', onKey);
    }, []);
    return (
        <div className="qw-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
            <div className="qw-dialog" role="dialog" aria-modal="true" aria-labelledby="qw-dialog-title" ref={ref}>
                <h2 id="qw-dialog-title">{title}</h2>
                {children}
                <div className="qw-dialog-actions">{actions}</div>
            </div>
        </div>
    );
}

/** Save / Don't Save / Cancel, like Word's close prompt. */
export function UnsavedDialog({ names, onSave, onDiscard, onCancel }) {
    const many = names.length > 1;
    return (
        <Dialog
            title={many ? 'Save your changes?' : `Save changes to “${names[0]}”?`}
            onClose={onCancel}
            actions={
                <>
                    <button type="button" className="qw-btn primary" onClick={onSave}>{many ? 'Save all' : 'Save'}</button>
                    <button type="button" className="qw-btn" onClick={onDiscard}>Don’t save</button>
                    <button type="button" className="qw-btn" onClick={onCancel}>Cancel</button>
                </>
            }
        >
            {many ? (
                <>
                    <p>These documents have changes that are not saved to disk:</p>
                    <ul>{names.map((n) => <li key={n}>{n}</li>)}</ul>
                </>
            ) : (
                <p>Your changes will be lost if you don’t save them.</p>
            )}
        </Dialog>
    );
}

export function LinkDialog({ initialHref, hasSelection, onApply, onRemove, onCancel }) {
    const [href, setHref] = useState(initialHref || '');
    const [text, setText] = useState('');
    const apply = () => {
        const v = href.trim();
        if (!v) return;
        const url = /^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('#') ? v : `https://${v}`;
        onApply(url, hasSelection ? null : text.trim() || url);
    };
    return (
        <Dialog
            title={initialHref ? 'Edit link' : 'Insert link'}
            onClose={onCancel}
            actions={
                <>
                    {initialHref && <button type="button" className="qw-btn" onClick={onRemove}>Remove link</button>}
                    <button type="button" className="qw-btn" onClick={onCancel}>Cancel</button>
                    <button type="button" className="qw-btn primary" onClick={apply} disabled={!href.trim()}>OK</button>
                </>
            }
        >
            <form onSubmit={(e) => { e.preventDefault(); apply(); }}>
                {!hasSelection && (
                    <div className="row">
                        <label>Text to display<input type="text" value={text} onChange={(e) => setText(e.target.value)} /></label>
                    </div>
                )}
                <div className="row">
                    <label>Address<input type="url" value={href} placeholder="https://" onChange={(e) => setHref(e.target.value)} /></label>
                </div>
                <button type="submit" hidden />
            </form>
        </Dialog>
    );
}

export function PageSetupDialog({ pageSetup, onApply, onCancel }) {
    const [s, setS] = useState(() => normalizePageSetup(pageSetup));
    const margin = (k) => (
        <label>
            {k[0].toUpperCase() + k.slice(1)} (in)
            <input
                type="number"
                step="0.05"
                min="0"
                max="4"
                value={s.margins[k]}
                onChange={(e) => setS({ ...s, margins: { ...s.margins, [k]: e.target.value } })}
            />
        </label>
    );
    return (
        <Dialog
            title="Page setup"
            onClose={onCancel}
            actions={
                <>
                    <button type="button" className="qw-btn" onClick={onCancel}>Cancel</button>
                    <button type="button" className="qw-btn primary" onClick={() => onApply(normalizePageSetup(s))}>OK</button>
                </>
            }
        >
            <div className="row">
                <label>
                    Paper size
                    <select value={s.paper} onChange={(e) => setS({ ...s, paper: e.target.value })}>
                        {Object.entries(PAPER_SIZES).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
                        {s.customSize && (
                            <option value="custom">Custom ({s.customSize.width.toFixed(2)} × {s.customSize.height.toFixed(2)} in)</option>
                        )}
                    </select>
                </label>
                <label>
                    Orientation
                    <select value={s.orientation} onChange={(e) => setS({ ...s, orientation: e.target.value })}>
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                    </select>
                </label>
            </div>
            <div className="row">
                {margin('top')}
                {margin('bottom')}
                {margin('left')}
                {margin('right')}
            </div>
            <label className="check">
                <input type="checkbox" checked={s.pageNumbers} onChange={(e) => setS({ ...s, pageNumbers: e.target.checked })} />
                Page numbers in the footer
            </label>
        </Dialog>
    );
}
