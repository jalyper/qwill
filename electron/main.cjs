const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        backgroundColor: '#ffffff',
        show: false, // Don't show until ready
    });

    // Show window when ready to avoid visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // In development, load from Vite dev server
    // In production, load the built files
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools in development
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    createWindow();

    // Register Zoom Shortcuts
    const { globalShortcut } = require('electron');

    // Zoom In (Ctrl+= or Ctrl+Plus)
    globalShortcut.register('CommandOrControl+=', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            const currentZoom = win.webContents.getZoomLevel();
            win.webContents.setZoomLevel(currentZoom + 0.5);
        }
    });

    // Zoom Out (Ctrl+-)
    globalShortcut.register('CommandOrControl+-', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            const currentZoom = win.webContents.getZoomLevel();
            win.webContents.setZoomLevel(currentZoom - 0.5);
        }
    });

    // Reset Zoom (Ctrl+0)
    globalShortcut.register('CommandOrControl+0', () => {
        const win = BrowserWindow.getFocusedWindow();
        if (win) {
            win.webContents.setZoomLevel(0);
        }
    });

    // On macOS, re-create window when dock icon is clicked
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers for file operations
ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Word Documents', extensions: ['docx'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName || 'Untitled.docx',
        filters: [
            { name: 'Word Documents', extensions: ['docx'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePath) {
        return result.filePath;
    }
    return null;
});

ipcMain.handle('file:read', async (event, filePath) => {
    try {
        const data = await fs.readFile(filePath);
        return { success: true, data: data.buffer };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('file:write', async (event, filePath, data) => {
    try {
        console.log('Writing file to:', filePath);
        console.log('Data type:', typeof data);
        console.log('Data length:', data.length);
        console.log('Is Buffer?', Buffer.isBuffer(data));

        // Ensure data is a buffer
        const buffer = Buffer.from(data);
        console.log('Buffer length:', buffer.length);

        await fs.writeFile(filePath, buffer);
        console.log('File written successfully');
        return { success: true };
    } catch (error) {
        console.error('Error writing file:', error);
        return { success: false, error: error.message };
    }
});
