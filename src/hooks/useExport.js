import { htmlToDocx } from '../utils/fileConversion';
import html2pdf from 'html2pdf.js';

const useExport = () => {
    const exportAsDocx = async (content, filename = 'document') => {
        try {
            const blob = await htmlToDocx(content);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}.docx`;
            link.click();
            URL.revokeObjectURL(url);

            return { success: true };
        } catch (error) {
            console.error('Error exporting to DOCX:', error);
            return { success: false, error: error.message };
        }
    };

    const exportAsPdf = async (content, filename = 'document') => {
        try {
            // Create a temporary container with proper styling
            const container = document.createElement('div');
            container.innerHTML = content;
            container.style.padding = '40px';
            container.style.fontFamily = 'Arial, sans-serif';
            container.style.fontSize = '12pt';
            container.style.lineHeight = '1.6';
            container.style.color = '#000';
            container.style.backgroundColor = '#fff';

            const options = {
                margin: [10, 10, 10, 10],
                filename: `${filename}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            await html2pdf().set(options).from(container).save();

            return { success: true };
        } catch (error) {
            console.error('Error exporting to PDF:', error);
            return { success: false, error: error.message };
        }
    };

    return {
        exportAsDocx,
        exportAsPdf
    };
};

export default useExport;
