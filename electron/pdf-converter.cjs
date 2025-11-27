const fs = require('fs');
const pdf = require('pdf-parse');
const { Document, Packer, Paragraph, TextRun } = require('docx');

/**
 * Converts a PDF file to a DOCX file.
 * @param {string} pdfPath - The path to the source PDF file.
 * @param {string} docxPath - The path to save the generated DOCX file.
 * @returns {Promise<void>}
 */
async function convertPdfToDocx(pdfPath, docxPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);

    // Split text by newlines to create paragraphs
    // This is a basic extraction. pdf-parse returns all text in data.text
    const textLines = data.text.split('\n');

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: textLines.map(line =>
            new Paragraph({
              children: [
                new TextRun(line.trim()),
              ],
            })
          ),
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(docxPath, buffer);
    console.log(`Successfully converted ${pdfPath} to ${docxPath}`);
  } catch (error) {
    console.error('Error converting PDF to DOCX:', error);
    throw error;
  }
}

module.exports = { convertPdfToDocx };
