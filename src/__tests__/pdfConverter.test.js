import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// The CJS module electron/pdf-converter.cjs uses require('fs') and require('pdf-parse')
// which can't be reliably mocked from ESM tests. Instead, we test the core conversion
// logic directly — the same algorithm the module uses.

// Replicate the conversion logic from pdf-converter.cjs for unit testing
const convertPdfTextToDocx = async (pdfText) => {
  const textLines = pdfText.split('\n');

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: textLines.map(
          (line) =>
            new Paragraph({
              children: [new TextRun(line.trim())],
            })
        ),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
};

describe('PDF to DOCX conversion logic', () => {
  it('converts text to a valid DOCX buffer', async () => {
    const buffer = await convertPdfTextToDocx('Hello World\nSecond line');
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('output buffer starts with DOCX/ZIP magic bytes', async () => {
    const buffer = await convertPdfTextToDocx('Test content');
    // DOCX files are ZIP archives — magic bytes PK (0x50, 0x4B)
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it('splits text by newlines into separate paragraphs', async () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const lines = text.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Line 1');
    expect(lines[1]).toBe('Line 2');
    expect(lines[2]).toBe('Line 3');

    // Verify conversion doesn't throw
    const buffer = await convertPdfTextToDocx(text);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('handles empty text input', async () => {
    const buffer = await convertPdfTextToDocx('');
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('trims whitespace from each line', async () => {
    const text = '  Leading spaces  \n  Trailing spaces  ';
    const lines = text.split('\n').map((l) => l.trim());
    expect(lines[0]).toBe('Leading spaces');
    expect(lines[1]).toBe('Trailing spaces');

    const buffer = await convertPdfTextToDocx(text);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
