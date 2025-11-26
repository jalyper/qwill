import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import html2pdf from 'html2pdf.js';

const useExport = () => {
    const exportAsDocx = async (content, filename = 'document') => {
        try {
            // Parse HTML content to extract text and basic formatting
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;

            // Remove page breaks
            const pageBreaks = tempDiv.querySelectorAll('.page-break');
            pageBreaks.forEach(brk => brk.remove());

            const paragraphs = [];

            // Simple conversion - extract text from each block element
            const processNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent.trim();
                    if (text) {
                        return new TextRun({
                            text: text,
                            bold: false,
                            italics: false
                        });
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toLowerCase();
                    const text = node.textContent.trim();

                    if (!text) return null;

                    const runs = [];

                    // Check for formatting
                    const isBold = tagName === 'b' || tagName === 'strong' ||
                        node.style.fontWeight === 'bold' ||
                        window.getComputedStyle(node).fontWeight === 'bold';
                    const isItalic = tagName === 'i' || tagName === 'em' ||
                        node.style.fontStyle === 'italic' ||
                        window.getComputedStyle(node).fontStyle === 'italic';

                    // Process child nodes
                    if (node.childNodes.length > 0) {
                        for (const child of node.childNodes) {
                            const childRun = processNode(child);
                            if (childRun) {
                                if (Array.isArray(childRun)) {
                                    runs.push(...childRun);
                                } else {
                                    runs.push(childRun);
                                }
                            }
                        }
                    } else {
                        runs.push(new TextRun({
                            text: text,
                            bold: isBold,
                            italics: isItalic
                        }));
                    }

                    return runs.length > 0 ? runs : null;
                }
                return null;
            };

            // Process all block-level elements
            const blockElements = tempDiv.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6, li');

            if (blockElements.length === 0) {
                // No block elements, treat entire content as one paragraph
                const runs = processNode(tempDiv);
                if (runs) {
                    paragraphs.push(new Paragraph({
                        children: Array.isArray(runs) ? runs : [runs]
                    }));
                }
            } else {
                blockElements.forEach(element => {
                    const runs = processNode(element);
                    if (runs && runs.length > 0) {
                        paragraphs.push(new Paragraph({
                            children: Array.isArray(runs) ? runs : [runs]
                        }));
                    }
                });
            }

            // Create document
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: paragraphs.length > 0 ? paragraphs : [
                        new Paragraph({
                            children: [new TextRun("")]
                        })
                    ]
                }]
            });

            // Generate and download
            const blob = await Packer.toBlob(doc);
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
