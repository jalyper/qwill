import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import mammoth from 'mammoth';

// Convert HTML to DOCX
export const htmlToDocx = async (htmlContent) => {
    // Parse HTML and create DOCX document
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // Remove page breaks before conversion
    const pageBreaks = doc.querySelectorAll('.page-break');
    pageBreaks.forEach(brk => brk.remove());

    const paragraphs = [];
    const body = doc.body;

    // Process each child node recursively to generate TextRuns
    const processNode = (node, styles = {}) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) {
                return new TextRun({
                    text: text,
                    bold: styles.bold,
                    italics: styles.italics
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();

            // Skip empty text nodes unless they are significant? 
            // For now, we rely on textContent check in TEXT_NODE.

            const runs = [];

            // Handle formatting
            // Inherit from parent or check current node
            const isBold = styles.bold || node.style.fontWeight === 'bold' || tagName === 'b' || tagName === 'strong';
            const isItalic = styles.italics || node.style.fontStyle === 'italic' || tagName === 'i' || tagName === 'em';

            // Process child nodes
            if (node.childNodes.length > 0) {
                for (const child of node.childNodes) {
                    const childRun = processNode(child, { bold: isBold, italics: isItalic });
                    if (childRun) {
                        if (Array.isArray(childRun)) {
                            runs.push(...childRun);
                        } else {
                            runs.push(childRun);
                        }
                    }
                }
            } else {
                // If it's an element without children but has text content (unlikely if we iterate children, but possible for some elements)
                const text = node.textContent.trim();
                if (text) {
                    runs.push(new TextRun({
                        text,
                        bold: isBold,
                        italics: isItalic,
                    }));
                }
            }

            return runs.length > 0 ? runs : null;
        }
        return null;
    };

    // Process top-level nodes to create Paragraphs
    Array.from(body.childNodes).forEach(node => {
        const runs = processNode(node);
        if (runs) {
            // Flatten if needed
            const children = Array.isArray(runs) ? runs : [runs];

            // Check if we need a heading style
            let heading;
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                if (tagName === 'h1') heading = 'Heading1';
                if (tagName === 'h2') heading = 'Heading2';
                if (tagName === 'h3') heading = 'Heading3';
            }

            paragraphs.push(new Paragraph({
                children,
                heading
            }));
        }
    });

    // If no paragraphs, add empty one
    if (paragraphs.length === 0) {
        paragraphs.push(new Paragraph({ text: '' }));
    }

    const document = new Document({
        sections: [{
            properties: {},
            children: paragraphs,
        }],
    });

    const blob = await Packer.toBlob(document);
    return blob;
};

// Convert DOCX to HTML
export const docxToHtml = async (arrayBuffer) => {
    try {
        const result = await mammoth.convertToHtml({ arrayBuffer });
        return result.value;
    } catch (error) {
        console.error('Error converting DOCX to HTML:', error);
        return '';
    }
};
