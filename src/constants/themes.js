export const themes = [
    {
        id: 'light',
        name: 'Light',
        colors: {
            '--bg-color': '#eef2f6', // Soft cool gray-blue background
            '--text-color': '#1a1a1a',
            '--accent-color': '#64748b', // Slate-500 (very desaturated blue)
            '--toolbar-bg': 'rgba(238, 242, 246, 0.9)',
            '--toolbar-border': 'rgba(0, 0, 0, 0.05)',
            '--editor-bg': '#ffffff',
            '--editor-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            '--page-bg': '#ffffff'
        }
    },
    {
        id: 'dark',
        name: 'Dark',
        colors: {
            '--bg-color': '#313337', // App background
            '--text-color': '#a1a1aa', // Zinc-400 (Muted text)
            '--accent-color': '#52525b', // Zinc-600 (Dark gray accent)
            '--toolbar-bg': '#000000', // Pure black header
            '--toolbar-border': 'rgba(255, 255, 255, 0.05)',
            '--editor-bg': '#18181b', // Zinc-900 (Page color)
            '--editor-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
            '--page-bg': '#18181b'
        }
    },
    {
        id: 'sepia',
        name: 'Sepia',
        colors: {
            '--bg-color': '#f0e9d8', // Less yellow
            '--text-color': '#4a4036', // More grayish brown
            '--accent-color': '#b08d55', // Muted orange/gold
            '--toolbar-bg': 'rgba(240, 233, 216, 0.9)',
            '--toolbar-border': 'rgba(74, 64, 54, 0.1)',
            '--editor-bg': '#fcf8ed', // Less yellow
            '--editor-shadow': '0 4px 6px -1px rgba(74, 64, 54, 0.1), 0 2px 4px -1px rgba(74, 64, 54, 0.06)',
            '--page-bg': '#fcf8ed'
        }
    },
    {
        id: 'midnight',
        name: 'Midnight',
        colors: {
            '--bg-color': '#020617', // Slate-950 (Almost black blue)
            '--text-color': '#94a3b8', // Slate-400
            '--accent-color': '#475569', // Slate-600
            '--toolbar-bg': 'rgba(2, 6, 23, 0.9)',
            '--toolbar-border': 'rgba(255, 255, 255, 0.05)',
            '--editor-bg': '#1e293b', // Slate-800 (Page color)
            '--editor-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
            '--page-bg': '#1e293b'
        }
    },
    {
        id: 'forest',
        name: 'Forest',
        colors: {
            '--bg-color': '#1b1c1b', // Warm Black/Dark Earth
            '--text-color': '#cce3de', // Sage mist
            '--accent-color': '#587a6f', // Muted sage
            '--toolbar-bg': 'rgba(27, 28, 27, 0.9)',
            '--toolbar-border': 'rgba(255, 255, 255, 0.05)',
            '--editor-bg': '#2f3e35', // Deep Green Page
            '--editor-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
            '--page-bg': '#2f3e35'
        }
    }
];
