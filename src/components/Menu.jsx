import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

const CloseContext = createContext(() => {});

/** A toolbar dropdown. Closes on outside click, Escape, or choosing an item. */
export function Menu({ label, title, disabled, align = 'left', buttonClass = 'qw-btn', children }) {
    const [open, setOpen] = useState(false);
    const wrap = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
            if (!wrap.current?.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div className="qw-menu-wrap" ref={wrap}>
            <button
                type="button"
                className={buttonClass}
                title={title}
                aria-label={title}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen((o) => !o)}
            >
                {label}
            </button>
            {open && (
                <div className={`qw-menu${align === 'right' ? ' right' : ''}`} role="menu">
                    <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
                </div>
            )}
        </div>
    );
}

export function MenuItem({ onClick, disabled, checked, shortcut, title, children }) {
    const close = useContext(CloseContext);
    return (
        <button
            type="button"
            role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={checked === undefined ? undefined : !!checked}
            className="qw-menu-item"
            disabled={disabled}
            title={title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
                close();
                onClick?.();
            }}
        >
            {checked !== undefined && <Check size={14} style={{ visibility: checked ? 'visible' : 'hidden' }} />}
            <span>{children}</span>
            {shortcut && <kbd>{shortcut}</kbd>}
        </button>
    );
}

export const MenuSeparator = () => <div className="qw-menu-sep" role="separator" />;
export const MenuLabel = ({ children }) => <div className="qw-menu-label">{children}</div>;
