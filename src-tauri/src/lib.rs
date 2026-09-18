pub mod commands;
pub mod logger;
pub mod services;

use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};

pub use logger::{DiagnosticRecord, Logger};
pub use services::{HealthCheckService, KernelHealthPayload, KernelService, StartupDiagnostics};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let logger = Logger::global();
    let kernel_service = Arc::new(KernelService::new());
    let service_clone = kernel_service.clone();

    logger.info("INIT", "", "Starting AgenticOS Tauri Desktop Application runtime supervisor");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(kernel_service)
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let service = service_clone.clone();

            // Run backend launch and automated health-check loop in background task
            tauri::async_runtime::spawn(async move {
                let install_dir = service.resolve_installation_path(Some(&app_handle));
                let install_str = install_dir.to_string_lossy().to_string();

                Logger::global().info(
                    "STARTUP",
                    &install_str,
                    "Tauri setup hook initialized. Spawning backend process with controlled working directory...",
                );

                // 1. Launch backend kernel binary with controlled working directory set to installation path
                match service.start_kernel(Some(&app_handle)) {
                    Ok(pid) => {
                        Logger::global().info(
                            "RUNNING",
                            &install_str,
                            &format!("Backend child process successfully spawned with PID {}. Initiating automated health check...", pid),
                        );
                    }
                    Err(e) => {
                        Logger::global().error(
                            "FAILED",
                            &install_str,
                            &format!("Kernel backend process launch failed: {}. Emitting startup_failed to UI.", e),
                            None,
                        );
                        let diag = service.get_diagnostics();
                        let _ = app_handle.emit("agenticos://startup_failed", &diag);
                        if let Some(main_window) = app_handle.get_webview_window("main") {
                            let _ = main_window.show();
                        }
                        return;
                    }
                }

                // 2. Automated health-check service polling 127.0.0.1:8001/healthz and validating schema
                let health_service = HealthCheckService::new(
                    Some("http://127.0.0.1:8001/healthz".to_string()),
                    Some(15),
                );

                let is_healthy = health_service.poll_until_ready(&app_handle, &install_str).await;
                let diag = service.get_diagnostics();

                if is_healthy {
                    Logger::global().info(
                        "READY",
                        &install_str,
                        "Backend kernel healthy and schema validated. Signaling UI and revealing main window.",
                    );
                    let _ = app_handle.emit("agenticos://startup_ready", &diag);
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        let _ = main_window.show();
                        let _ = main_window.set_focus();
                    }
                } else {
                    Logger::global().error(
                        "FAILED",
                        &install_str,
                        "Health check loop timed out or schema validation failed. Revealing diagnostic recovery screen in UI.",
                        None,
                    );
                    let _ = app_handle.emit("agenticos://startup_failed", &diag);
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        let _ = main_window.show();
                    }
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
        .build(tauri::generate_context!())
        .expect("error while building AgenticOS Tauri desktop application");

    // Main event loop: Ensures monitored child process is cleaned up on application exit
    let cleanup_service = app.state::<Arc<KernelService>>().inner().clone();
    app.run(move |_app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                Logger::global().info("SHUTDOWN", "", "Application exit requested. Cleaning up child process...");
                cleanup_service.stop_kernel();
            }
            tauri::RunEvent::Exit => {
                Logger::global().info("SHUTDOWN", "", "Application exit triggered. Ensuring backend process is terminated.");
                cleanup_service.stop_kernel();
            }
            _ => {}
        }
    });
}
