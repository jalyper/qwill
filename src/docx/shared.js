// Helpers shared by the .docx reader and writer.

/** Paragraph style ids Qwill writes for nodes Word has no built-in for. */
export const STYLE_IDS = { quote: 'Quote', code: 'QwillCode', rule: 'QwillRule' };
/** List indent per level, twips (0.5 in, Word's default). */
export const LIST_INDENT = 720;

// Word highlights are a fixed palette (w:highlight); anything else is
// stored as run shading (w:shd fill). Hex values match Word's rendering.
export const HIGHLIGHT_COLORS = {
    yellow: '#ffff00',
    green: '#00ff00',
    cyan: '#00ffff',
    magenta: '#ff00ff',
    blue: '#0000ff',
    red: '#ff0000',
    darkBlue: '#000080',
    darkCyan: '#008080',
    darkGreen: '#008000',
    darkMagenta: '#800080',
    darkRed: '#800000',
    darkYellow: '#808000',
    darkGray: '#808080',
    lightGray: '#c0c0c0',
    black: '#000000',
    white: '#ffffff',
};

/** '#abc', 'abc', 'rgb(1,2,3)', 'yellow' -> '#rrggbb'; null when not a color. */
export function normalizeColor(value) {
    if (!value) return null;
    const v = String(value).trim().toLowerCase();
    if (v === 'auto' || v === 'transparent' || v === 'inherit' || v === 'none') return null;
    let m = v.match(/^#?([0-9a-f]{6})$/);
    if (m) return `#${m[1]}`;
    m = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
    if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
    m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
    const named = Object.keys(HIGHLIGHT_COLORS).find((k) => k.toLowerCase() === v);
    return named ? HIGHLIGHT_COLORS[named] : null;
}

export function highlightName(hex) {
    const c = normalizeColor(hex);
    return Object.keys(HIGHLIGHT_COLORS).find((k) => HIGHLIGHT_COLORS[k] === c) || null;
}

/** '12pt' / '16px' / 12 -> points. */
export function toPoints(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return value;
    const m = String(value).trim().match(/^([\d.]+)\s*(pt|px)?$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    return m[2] === 'px' ? Math.round(n * 0.75 * 2) / 2 : n;
}

const MIME_TO_TYPE = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp' };
const EXT_TO_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml' };

export const mimeForExt = (ext) => EXT_TO_MIME[String(ext).toLowerCase()] || null;

export function bytesToBase64(bytes) {
    let s = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return btoa(s);
}

/** data: URL -> { type: 'png'|'jpg'|'gif'|'bmp', bytes } or null if unsupported. */
export function decodeDataUrl(src) {
    const m = String(src || '').match(/^data:([^;,]+)(;base64)?,(.*)$/s);
    if (!m) return null;
    const type = MIME_TO_TYPE[m[1].toLowerCase()];
    if (!type) return null;
    const raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return { type, bytes };
}

/** Pixel size from PNG / JPEG / GIF / BMP headers, or null. */
export function imageSize(b) {
    const u32 = (o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    if (b[0] === 0x89 && b[1] === 0x50) return { width: u32(16), height: u32(20) };
    if (b[0] === 0x47 && b[1] === 0x49) return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
    if (b[0] === 0x42 && b[1] === 0x4d) {
        const le = (o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
        return { width: le(18), height: Math.abs(le(22)) };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
        let o = 2;
        while (o + 9 < b.length) {
            if (b[o] !== 0xff) return null;
            const marker = b[o + 1];
            const len = (b[o + 2] << 8) | b[o + 3];
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
                return { height: (b[o + 5] << 8) | b[o + 6], width: (b[o + 7] << 8) | b[o + 8] };
            }
            o += 2 + len;
        }
    }
    return null;
}

export const EMU_PER_PX = 9525;
