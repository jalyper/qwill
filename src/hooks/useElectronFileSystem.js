import { useState, useEffect, useCallback } from 'react';
import { htmlToDocx, docxToHtml } from '../utils/fileConversion';

// Check if running in Electron
const isElectron = () => {
    return typeof window !== 'undefined' && !!window.electronAPI;
};

export const useElectronFileSystem = () => {
    const [currentFilePath, setCurrentFilePath] = useState(null);
    const [fileName, setFileName] = useState('Untitled');
    const [isElectronEnv, setIsElectronEnv] = useState(false);

    useEffect(() => {
        setIsElectronEnv(isElectron());
    }, []);

    // Open file dialog and load file
    const openFile = useCallback(async () => {
        if (!isElectronEnv) return null;

        try {
            const filePath = await window.electronAPI.openFile();
            if (!filePath) return null;

            const result = await window.electronAPI.readFile(filePath);
            if (!result.success) {
                console.error('Error reading file:', result.error);
                return null;
            }

            const html = await docxToHtml(result.data);
            setCurrentFilePath(filePath);
            setFileName(filePath.split(/[\\/]/).pop().replace('.docx', ''));

            return { html, filePath };
        } catch (error) {
            console.error('Error opening file:', error);
            return null;
        }
    }, [isElectronEnv, docxToHtml]);

    // Save file to current path
    const saveFile = useCallback(async (htmlContent) => {
        if (!isElectronEnv) return false;

        try {
            let filePath = currentFilePath;

            // If no current file, show save dialog
            if (!filePath) {
                filePath = await window.electronAPI.saveFileDialog(`${fileName}.docx`);
                if (!filePath) return false;
            }

            const docxBlob = await htmlToDocx(htmlContent);
            const arrayBuffer = await docxBlob.arrayBuffer();
            console.log('Renderer: Generated DOCX buffer (saveFile)', arrayBuffer);
            const result = await window.electronAPI.writeFile(filePath, arrayBuffer);
            console.log('Renderer: Write result (saveFile)', result);

            if (result.success) {
                setCurrentFilePath(filePath);
                setFileName(filePath.split(/[\\/]/).pop().replace('.docx', ''));
                return true;
            } else {
                console.error('Error saving file:', result.error);
                return false;
            }
        } catch (error) {
            console.error('Error saving file:', error);
            return false;
        }
    }, [isElectronEnv, currentFilePath, fileName, htmlToDocx]);

    // Save as (always show dialog)
    const saveFileAs = useCallback(async (htmlContent) => {
        if (!isElectronEnv) return false;

        try {
            const filePath = await window.electronAPI.saveFileDialog(`${fileName}.docx`);
            if (!filePath) return false;

            const docxBlob = await htmlToDocx(htmlContent);
            const arrayBuffer = await docxBlob.arrayBuffer();
            console.log('Renderer: Generated DOCX buffer', arrayBuffer);
            const result = await window.electronAPI.writeFile(filePath, arrayBuffer);
            console.log('Renderer: Write result', result);

            if (result.success) {
                setCurrentFilePath(filePath);
                setFileName(filePath.split(/[\\/]/).pop().replace('.docx', ''));
                return true;
            } else {
                console.error('Error saving file:', result.error);
                return false;
            }
        } catch (error) {
            console.error('Error saving file as:', error);
            return false;
        }
    }, [isElectronEnv, fileName, htmlToDocx]);

    return {
        isElectronEnv,
        currentFilePath,
        fileName,
        openFile,
        saveFile,
        saveFileAs,
        htmlToDocx,
    };
};
