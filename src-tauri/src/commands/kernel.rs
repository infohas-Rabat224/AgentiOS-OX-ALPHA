use std::sync::Arc;
use tauri::{AppHandle, State};
use crate::services::{KernelService, StartupDiagnostics};

#[tauri::command]
pub async fn get_startup_status(
    kernel_service: State<'_, Arc<KernelService>>,
) -> Result<StartupDiagnostics, String> {
    Ok(kernel_service.get_diagnostics())
}

#[tauri::command]
pub async fn retry_kernel_startup(
    app: AppHandle,
    kernel_service: State<'_, Arc<KernelService>>,
) -> Result<StartupDiagnostics, String> {
    let service = kernel_service.inner().clone();
    service.append_log("Received retry_kernel_startup request from UI.");

    // Start kernel in background
    let _ = service.start_kernel(Some(&app));

    // Run health check loop (10 seconds)
    service.run_health_check_loop(10).await;

    Ok(service.get_diagnostics())
}

#[tauri::command]
pub async fn open_diagnostic_log(
    kernel_service: State<'_, Arc<KernelService>>,
) -> Result<bool, String> {
    let diag = kernel_service.get_diagnostics();
    let log_path = diag.log_path;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("notepad.exe")
            .arg(&log_path)
            .spawn()
            .map_err(|e| format!("Failed to open notepad: {}", e))?;
        return Ok(true);
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&log_path)
            .spawn()
            .map_err(|e| format!("Failed to open log: {}", e))?;
        return Ok(true);
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&log_path)
            .spawn()
            .map_err(|e| format!("Failed to open log: {}", e))?;
        return Ok(true);
    }

    #[allow(unreachable_code)]
    Ok(false)
}

#[tauri::command]
pub async fn copy_diagnostic_report(
    kernel_service: State<'_, Arc<KernelService>>,
) -> Result<String, String> {
    let d = kernel_service.get_diagnostics();
    let report = format!(
        "================================================================\n\
         AGENTICOS STARTUP DIAGNOSTIC REPORT\n\
         ================================================================\n\
         Timestamp:       {}\n\
         Status:          {}\n\
         Component:       {}\n\
         Health Verified: {}\n\
         Backend PID:     {:?}\n\
         Kernel Port:     {}\n\
         Frontend Port:   {}\n\
         Health Endpoint: {}\n\
         Platform:        {} (Arch: {}, Host: {})\n\
         Total Memory:    {} MB (Available: {} MB)\n\
         CPU Cores:       {}\n\
         Binary Path:     {:?}\n\
         Log Path:        {}\n\
         Error Reason:    {:?}\n\
         Diagnostic Trace:\n{}\n\
         ================================================================",
        d.timestamp,
        d.status,
        d.component,
        d.is_healthy,
        d.backend_pid,
        d.kernel_port,
        d.frontend_port,
        d.health_url,
        d.platform,
        d.arch,
        d.hostname,
        d.total_memory_mb,
        d.available_memory_mb,
        d.cpu_cores,
        d.kernel_binary_path,
        d.log_path,
        d.error_reason,
        d.diagnostic_trace
    );
    Ok(report)
}
