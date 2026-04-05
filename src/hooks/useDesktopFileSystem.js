import { useState, useCallback } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { htmlToDocx, docxToHtml } from '../utils/fileConversion';

export const useDesktopFileSystem = () => {
    const [currentFilePath, setCurrentFilePath] = useState(null);
    const [fileName, setFileName] = useState('Untitled');

    const openFile = useCallback(async () => {
        try {
            const selected = await open({
                filters: [
                    { name: 'Word Documents', extensions: ['docx'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
            });

            if (!selected) return null;

            const filePath = typeof selected === 'string' ? selected : selected.path;
            const bytes = await readFile(filePath);
            const arrayBuffer = bytes.buffer;
            const html = await docxToHtml(arrayBuffer);

            setCurrentFilePath(filePath);
            setFileName(filePath.split(/[\\/]/).pop().replace('.docx', ''));

            return { html, filePath };
        } catch (error) {
            console.error('Error opening file:', error);
            return null;
        }
    }, []);

    const saveFile = useCallback(async (htmlContent) => {
        try {
            let filePath = currentFilePath;

            if (!filePath) {
                filePath = await save({
                    defaultPath: `${fileName}.docx`,
                    filters: [{ name: 'Word Documents', extensions: ['docx'] }],
                });
                if (!filePath) return false;
            }

            const docxBlob = await htmlToDocx(htmlContent);
            const arrayBuffer = await docxBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            await writeFile(filePath, bytes);

            setCurrentFilePath(filePath);
            setFileName(filePath.split(/[\\/]/).pop().replace('.docx', ''));
            return true;
        } catch (error) {
            console.error('Error saving file:', error);
            return false;
        }
    }, [currentFilePath, fileName]);

    const saveFileAs = useCallback(async (htmlContent) => {
        try {
            const filePath = await save({
                defaultPath: `${fileName}.docx`,
                filters: [{ name: 'Word Documents', extensions: ['docx'] }],
            });
            if (!filePath) return false;

            const docxBlob = await htmlToDocx(htmlContent);
            const arrayBuffer = await docxBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            await writeFile(filePath, bytes);

            setCurrentFilePath(filePath);
            setFileName(filePath.split(/[\\/]/).pop().replace('.docx', ''));
            return true;
        } catch (error) {
            console.error('Error saving file as:', error);
            return false;
        }
    }, [fileName]);

    return {
        currentFilePath,
        fileName,
        openFile,
        saveFile,
        saveFileAs,
        htmlToDocx,
    };
};
