const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Platform info
    platform: process.platform,
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron,
    },

    // File operations
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    saveFileDialog: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
    readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('file:write', filePath, data),
});
