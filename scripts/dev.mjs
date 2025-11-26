// Simple script to run Electron with Vite dev server
import { spawn } from 'child_process';
import { createServer } from 'vite';
import electron from 'vite-plugin-electron';

// Start Vite dev server
const server = await createServer({
    configFile: './vite.config.js',
});

await server.listen();

server.printUrls();

const viteDevServer = `http://localhost:${server.config.server.port}`;

// Set environment variable for Electron
process.env.VITE_DEV_SERVER_URL = viteDevServer;

// Build Electron files first
console.log('Building Electron files...');
const { build } = await import('vite');

await build({
    configFile: false,
    build: {
        outDir: 'dist-electron',
        lib: {
            entry: 'electron/main.cjs',
            formats: ['cjs'],
            fileName: () => 'main.cjs'
        },
        rollupOptions: {
            external: ['electron', 'path']
        }
    }
});

await build({
    configFile: false,
    build: {
        outDir: 'dist-electron',
        lib: {
            entry: 'electron/preload.cjs',
            formats: ['cjs'],
            fileName: () => 'preload.cjs'
        },
        rollupOptions: {
            external: ['electron']
        }
    }
});

console.log('Starting Electron...');

// Start Electron
const electronProcess = spawn('electron', ['.'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: viteDevServer }
});

electronProcess.on('close', () => {
    server.close();
    process.exit();
});
