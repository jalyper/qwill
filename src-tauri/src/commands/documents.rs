//! Reading and writing the user's documents.
//!
//! These bypass the fs plugin's scope on purpose: a recent file must reopen
//! after a restart, when the scope granted by the file dialog is gone. In
//! exchange they only ever touch absolute paths ending in `.docx`.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::ipc::{InvokeBody, Request, Response};

const DOCUMENT_EXTENSIONS: &[&str] = &["docx"];

fn document_path(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err(format!("Not an absolute path: {path}"));
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    match ext {
        Some(e) if DOCUMENT_EXTENSIONS.contains(&e.as_str()) => Ok(p),
        _ => Err("Qwill can only open and save .docx documents".into()),
    }
}

/// Decode the percent-encoded path header (headers must be ASCII, paths
/// need not be).
fn percent_decode(s: &str) -> Result<String, String> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).map_err(|e| e.to_string())?;
            out.push(u8::from_str_radix(hex, 16).map_err(|_| format!("Bad escape %{hex}"))?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|e| e.to_string())
}

/// Write via a temp file in the same folder, then rename over the target, so
/// a crash or full disk mid-save never leaves a half-written document.
fn write_atomic(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let dir = target.parent().ok_or("Path has no parent folder")?;
    let name = target
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Path has no file name")?;
    let tmp = dir.join(format!(".~{name}.qwill-tmp"));

    let result = (|| -> std::io::Result<()> {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        drop(f);
        fs::rename(&tmp, target)
    })();

    result.map_err(|e| {
        let _ = fs::remove_file(&tmp);
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            format!(
                "Could not save {}: the file is read-only or open in another program.",
                target.display()
            )
        } else {
            format!("Could not save {}: {e}", target.display())
        }
    })
}

#[tauri::command]
pub async fn read_document(path: String) -> Result<Response, String> {
    let p = document_path(&path)?;
    let bytes = fs::read(&p).map_err(|e| format!("Could not open {}: {e}", p.display()))?;
    Ok(Response::new(bytes))
}

/// Body: the raw file bytes. Header `x-path`: percent-encoded target path.
#[tauri::command]
pub async fn write_document(request: Request<'_>) -> Result<(), String> {
    let encoded = request
        .headers()
        .get("x-path")
        .and_then(|v| v.to_str().ok())
        .ok_or("Missing x-path header")?;
    let p = document_path(&percent_decode(encoded)?)?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected raw bytes".into());
    };
    write_atomic(&p, bytes)
}

/// A .docx passed on the command line (double-click / "Open with").
#[tauri::command]
pub fn launch_document() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| a.to_ascii_lowercase().ends_with(".docx"))
        .map(|a| {
            fs::canonicalize(&a)
                .map(|p| p.to_string_lossy().trim_start_matches(r"\\?\").to_string())
                .unwrap_or(a)
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_unicode_paths() {
        assert_eq!(
            percent_decode("C%3A%5CUsers%5Cz%C3%BCrich%20notes.docx").unwrap(),
            r"C:\Users\zürich notes.docx"
        );
    }

    #[test]
    fn rejects_non_documents() {
        let abs = if cfg!(windows) { r"C:\x\a.exe" } else { "/x/a.exe" };
        assert!(document_path(abs).is_err());
        assert!(document_path("relative.docx").is_err());
    }

    #[test]
    fn atomic_write_replaces_existing_file() {
        let dir = std::env::temp_dir().join(format!("qwill-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let target = dir.join("doc.docx");
        fs::write(&target, b"old").unwrap();
        write_atomic(&target, b"new contents").unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"new contents");
        assert!(!dir.join(".~doc.docx.qwill-tmp").exists());
        fs::remove_dir_all(&dir).unwrap();
    }
}
