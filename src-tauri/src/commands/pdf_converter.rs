use std::fs;

/// Convert a PDF file to a DOCX file by extracting text and creating
/// one paragraph per line. This is a basic text-only extraction —
/// images, tables, and formatting are not preserved.
#[tauri::command]
pub async fn convert_pdf_to_docx(pdf_path: String, docx_path: String) -> Result<String, String> {
    // 1. Read PDF and extract text
    let pdf_bytes = fs::read(&pdf_path).map_err(|e| format!("Failed to read PDF: {}", e))?;

    let text = pdf_extract::extract_text_from_mem(&pdf_bytes)
        .map_err(|e| format!("Failed to extract text from PDF: {}", e))?;

    // 2. Split by newlines and build DOCX with one paragraph per line
    let mut docx = docx_rs::Docx::new();

    for line in text.lines() {
        let trimmed = line.trim();
        let paragraph = docx_rs::Paragraph::new()
            .add_run(docx_rs::Run::new().add_text(trimmed));
        docx = docx.add_paragraph(paragraph);
    }

    // 3. Write DOCX to output path
    let file = fs::File::create(&docx_path)
        .map_err(|e| format!("Failed to create DOCX file: {}", e))?;

    docx.build()
        .pack(file)
        .map_err(|e| format!("Failed to write DOCX: {}", e))?;

    Ok(docx_path)
}
