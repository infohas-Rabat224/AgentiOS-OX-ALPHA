pub mod commands;
pub mod services;

use std::sync::Arc;
use tauri::{Manager, Emitter};
pub use services::{KernelService, StartupDiagnostics};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let kernel_service = Arc::new(KernelService::new());
    let service_clone = kernel_service.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(kernel_service)
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let service = service_clone.clone();

            // Run backend launch and health-check loop in background task
            tauri::async_runtime::spawn(async move {
                service.append_log("Tauri setup hook initialized. Starting AgenticOS backend kernel...");

                // 1. Launch kernel binary
                match service.start_kernel(Some(&app_handle)) {
                    Ok(pid) => {
                        service.append_log(&format!("Kernel process started (PID: {}). Starting health-check loop...", pid));
                    }
                    Err(e) => {
                        service.append_log(&format!("Kernel startup failed: {}. Notifying frontend.", e));
                        let diag = service.get_diagnostics();
                        let _ = app_handle.emit("agenticos://startup_failed", &diag);
                        return;
                    }
                }

                // 2. Health check loop before rendering/revealing main window
                let is_healthy = service.run_health_check_loop(15).await;
                let diag = service.get_diagnostics();

                if is_healthy {
                    service.append_log("Backend kernel healthy and ready. Revealing main window.");
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        let _ = main_window.show();
                        let _ = main_window.set_focus();
                    }
                    let _ = app_handle.emit("agenticos://startup_ready", &diag);
                } else {
                    service.append_log("Health check loop timed out. Showing failure UI with diagnostics.");
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        let _ = main_window.show();
                    }
                    let _ = app_handle.emit("agenticos://startup_failed", &diag);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::download::download_github_release_asset,
            commands::credential_vault::vault_store_secret,
            commands::credential_vault::vault_get_secret,
            commands::credential_vault::vault_delete_secret,
            commands::credential_vault::vault_list_keys,
            commands::credential_vault::vault_has_secret,
            commands::kernel::get_startup_status,
            commands::kernel::retry_kernel_startup,
            commands::kernel::open_diagnostic_log,
            commands::kernel::copy_diagnostic_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgenticOS Tauri desktop application");
}
