mod commands;

use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be first: a second launch (double-clicking another .docx while
        // Qwill is open) hands its file to this window instead of starting a
        // second copy that would fight over the same workspace state.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            if let Some(path) = commands::documents::document_arg(&argv, std::path::Path::new(&cwd)) {
                let _ = app.emit("open-document", path);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::documents::read_document,
            commands::documents::write_document,
            commands::documents::launch_document,
            commands::pdf_converter::convert_pdf_to_docx
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
