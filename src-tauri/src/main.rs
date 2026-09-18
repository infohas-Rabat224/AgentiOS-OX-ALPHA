#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use agentic_os_lib::logger::{self, Logger};
use agentic_os_lib::services::health_check::{HealthCheckService, KernelHealthPayload};
use agentic_os_lib::KernelService;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

static GLOBAL_KERNEL_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static GLOBAL_KERNEL_PID: Mutex<Option<u32>> = Mutex::new(None);
static GLOBAL_KERNEL_PATH: Mutex<Option<String>> = Mutex::new(None);
static GLOBAL_INSTALLATION_PATH: Mutex<Option<String>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelProcessInfo {
    pub pid: u32,
    pub binary_path: String,
    pub working_directory: String,
    pub log_path: String,
    pub status: String,
    pub started_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: Option<String>,
    pub phase: Option<String>,
    pub health: Option<String>,
    pub uptime_seconds: Option<f64>,
    pub subsystems: HashMap<String, String>,
    pub raw_json: Option<String>,
    pub http_code: u16,
    pub duration_ms: u64,
}

/// Resolves the absolute installation directory of the desktop application
pub fn resolve_installation_path(app: &AppHandle) -> PathBuf {
    // 1. Check Tauri internal resource directory
    if let Ok(res_dir) = app.path().resource_dir() {
        if res_dir.exists() {
            return res_dir;
        }
    }

    // 2. Check current executable directory (production install root)
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            if parent.exists() {
                return parent.to_path_buf();
            }
        }
    }

    // 3. Check %LOCALAPPDATA%\AgenticOS on Windows
    #[cfg(windows)]
    {
        if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(app_data).join("AgenticOS");
            if p.exists() {
                return p;
            }
        }
    }

    // 4. Fallback to current working directory
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

/// Resolves the absolute internal path to the AgenticOS kernel binary or sidecar
pub fn resolve_absolute_kernel_path(
    app: &AppHandle,
    custom_path: Option<String>,
) -> Result<(PathBuf, PathBuf), String> {
    let install_dir = resolve_installation_path(app);

    // 1. Custom path override if provided
    if let Some(ref path_str) = custom_path {
        let p = PathBuf::from(path_str);
        if p.is_file() && p.exists() {
            let working_dir = p.parent().unwrap_or(&install_dir).to_path_buf();
            return Ok((p, working_dir));
        }
    }

    // 2. Check inside installation root directory
    let candidates = [
        install_dir.join("agenticos-kernel.exe"),
        install_dir.join("bin").join("agenticos-kernel.exe"),
        install_dir.join("build-windows").join("bin").join("agenticos-kernel.exe"),
        install_dir.join("agenticos-kernel"),
        install_dir.join("..").join("build-windows").join("bin").join("agenticos-kernel.exe"),
    ];

    for c in &candidates {
        if c.exists() && c.is_file() {
            return Ok((c.clone(), install_dir.clone()));
        }
    }

    // 3. Check bundled Python runtime sidecar
    let python_candidates = [
        install_dir.join("python").join("python.exe"),
        install_dir.join("python").join("bin").join("python3"),
    ];

    for p in &python_candidates {
        if p.exists() && p.is_file() {
            return Ok((p.clone(), install_dir.clone()));
        }
    }

    // 4. Staging and development paths
    let dev_candidates = [
        PathBuf::from("build-windows/bin/agenticos-kernel.exe"),
        PathBuf::from("../build-windows/bin/agenticos-kernel.exe"),
        PathBuf::from("bin/agenticos-kernel.exe"),
        PathBuf::from("agenticos-kernel.exe"),
    ];

    for c in &dev_candidates {
        if c.exists() && c.is_file() {
            let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
            return Ok((c.clone(), cwd));
        }
    }

    Err(format!(
        "AgenticOS backend kernel binary not found in installation path ({:?}) or workspace.",
        install_dir
    ))
}

/// Cleans up any running backend child process on exit or restart
pub fn cleanup_child_process() {
    let mut guard = GLOBAL_KERNEL_PROCESS.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(mut child) = guard.take() {
        let pid = child.id();
        let logger = Logger::global();
        logger.info("SHUTDOWN", "", &format!("Sending kill signal to backend child process PID {}", pid));
        let _ = child.kill();
        let _ = child.wait();
        logger.info("STOPPED", "", &format!("Backend child process PID {} terminated and cleaned up successfully.", pid));
    }
    *GLOBAL_KERNEL_PID.lock().unwrap_or_else(|e| e.into_inner()) = None;
}

/// Launches the AgenticOS backend process using std::process::Command with a controlled
/// working directory set to the installation path, ensuring monitoring and clean exit.
#[tauri::command]
pub async fn launch_kernel(
    app: AppHandle,
    custom_path: Option<String>,
) -> Result<KernelProcessInfo, String> {
    let logger = Logger::global();

    // 1. Resolve absolute internal binary and controlled working directory
    let (binary_path, install_path) = resolve_absolute_kernel_path(&app, custom_path)
        .map_err(|e| {
            logger.error("FAILED", "", &format!("Failed to resolve kernel binary path: {}", e), None);
            e
        })?;

    let binary_str = binary_path.to_string_lossy().to_string();
    let install_str = install_path.to_string_lossy().to_string();

    logger.info(
        "LAUNCHING",
        &binary_str,
        &format!("Launching backend process with controlled working directory: {}", install_str),
    );

    // 2. Setup logging directory and files
    let log_dir = Logger::resolve_log_dir();
    fs::create_dir_all(&log_dir).map_err(|e| format!("Failed to create log directory: {}", e))?;
    let kernel_log_path = log_dir.join("kernel.log");

    let stdout_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&kernel_log_path)
        .map_err(|e| format!("Failed to open stdout kernel log {:?}: {}", kernel_log_path, e))?;

    let stderr_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&kernel_log_path)
        .map_err(|e| format!("Failed to open stderr kernel log {:?}: {}", kernel_log_path, e))?;

    // 3. Clean up any previously running kernel instance
    cleanup_child_process();

    // 4. Construct Command with controlled working directory set to installation path
    let mut cmd = Command::new(&binary_path);
    cmd.current_dir(&install_path); // Controlled working directory set to installation path
    cmd.stdout(Stdio::from(stdout_log));
    cmd.stderr(Stdio::from(stderr_log));

    // If running python runtime sidecar, set PYTHONPATH to AgenticosHybrid/src
    if binary_str.ends_with("python.exe") || binary_str.ends_with("python3") {
        let hybrid_src = install_path.join("AgenticosHybrid").join("src");
        cmd.env("PYTHONPATH", &hybrid_src);
        cmd.args(&["-m", "agentic_os", "serve", "--host", "127.0.0.1", "--port", "8001"]);
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW = 0x08000000 to keep UI clean
        cmd.creation_flags(0x08000000);
    }

    // 5. Spawn child process and register for supervisor monitoring
    match cmd.spawn() {
        Ok(child) => {
            let pid = child.id();
            let log_str = kernel_log_path.to_string_lossy().to_string();

            logger.info(
                "RUNNING",
                &binary_str,
                &format!("Backend process spawned with PID {} in working dir {}", pid, install_str),
            );

            *GLOBAL_KERNEL_PID.lock().unwrap() = Some(pid);
            *GLOBAL_KERNEL_PATH.lock().unwrap() = Some(binary_str.clone());
            *GLOBAL_INSTALLATION_PATH.lock().unwrap() = Some(install_str.clone());
            *GLOBAL_KERNEL_PROCESS.lock().unwrap() = Some(child);

            // Spawn background monitor task for child process lifecycle
            let app_clone = app.clone();
            let mon_binary = binary_str.clone();
            let mon_install = install_str.clone();

            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_millis(500)).await;

                    let mut guard = GLOBAL_KERNEL_PROCESS.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(ref mut child_proc) = *guard {
                        if child_proc.id() == pid {
                            match child_proc.try_wait() {
                                Ok(Some(exit_status)) => {
                                    let err_msg = format!(
                                        "Backend child process (PID {}) terminated unexpectedly with: {:?}",
                                        pid, exit_status
                                    );
                                    Logger::global().error(
                                        "FAILED",
                                        &mon_binary,
                                        &err_msg,
                                        Some("Child exited before application shutdown."),
                                    );
                                    let _ = app_clone.emit("agenticos://kernel_crashed", &err_msg);
                                    break;
                                }
                                Ok(None) => {
                                    // Healthy, process still running
                                }
                                Err(e) => {
                                    Logger::global().error(
                                        "FAILED",
                                        &mon_install,
                                        &format!("Process monitoring error for PID {}: {}", pid, e),
                                        None,
                                    );
                                    break;
                                }
                            }
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            });

            Ok(KernelProcessInfo {
                pid,
                binary_path: binary_str,
                working_directory: install_str,
                log_path: log_str,
                status: "RUNNING".to_string(),
                started_at: logger::chrono_iso_timestamp(),
            })
        }
        Err(e) => {
            let err_msg = format!("Failed to spawn backend process {:?}: {}", binary_path, e);
            logger.error("FAILED", &binary_str, &err_msg, Some("Verify binary permissions and path."));
            Err(err_msg)
        }
    }
}

/// Performs an HTTP GET request to 127.0.0.1:8001/healthz and validates the kernel health schema
#[tauri::command]
pub async fn check_health() -> Result<HealthResponse, String> {
    let start = Instant::now();
    let health_service = HealthCheckService::new(
        Some("http://127.0.0.1:8001/healthz".to_string()),
        Some(2),
    );

    match health_service.check_once().await {
        Ok(payload) => {
            let duration_ms = start.elapsed().as_millis() as u64;
            let raw_json = serde_json::to_string(&payload).unwrap_or_default();

            Ok(HealthResponse {
                status: payload.status,
                service: payload.service,
                phase: payload.phase,
                health: payload.health,
                uptime_seconds: payload.uptime_seconds,
                subsystems: payload.subsystems,
                raw_json: Some(raw_json),
                http_code: 200,
                duration_ms,
            })
        }
        Err(e) => {
            let elapsed = start.elapsed().as_millis() as u64;
            Err(format!(
                "Health check validation failed at 127.0.0.1:8001/healthz ({}ms): {}",
                elapsed, e
            ))
        }
    }
}

/// Retrieves the current monitored kernel process PID and status
#[tauri::command]
pub async fn get_monitored_kernel() -> Result<Option<KernelProcessInfo>, String> {
    let pid_opt = *GLOBAL_KERNEL_PID.lock().unwrap();
    if let Some(pid) = pid_opt {
        let path = GLOBAL_KERNEL_PATH.lock().unwrap().clone().unwrap_or_default();
        let install = GLOBAL_INSTALLATION_PATH.lock().unwrap().clone().unwrap_or_default();
        let log = Logger::global().log_path().to_string_lossy().to_string();
        Ok(Some(KernelProcessInfo {
            pid,
            binary_path: path,
            working_directory: install,
            log_path: log,
            status: "ACTIVE".to_string(),
            started_at: "monitored".to_string(),
        }))
    } else {
        Ok(None)
    }
}

fn main() {
    let logger = Logger::global();
    let kernel_service = Arc::new(KernelService::new());
    let service_clone = kernel_service.clone();

    logger.info("INIT", "", "AgenticOS Desktop Mission Control initializing");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(kernel_service)
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let service = service_clone.clone();

            // Background task: Launches backend process with controlled working directory
            // and executes automated health-check service polling 127.0.0.1:8001/healthz
            tauri::async_runtime::spawn(async move {
                let install_dir = service.resolve_installation_path(Some(&app_handle));
                let install_str = install_dir.to_string_lossy().to_string();

                Logger::global().info(
                    "STARTUP",
                    &install_str,
                    "Tauri runtime setup hook executing. Launching backend process with controlled working directory...",
                );

                // 1. Launch backend process using controlled working directory
                match service.start_kernel(Some(&app_handle)) {
                    Ok(pid) => {
                        Logger::global().info(
                            "RUNNING",
                            &install_str,
                            &format!("Backend process spawned with PID {}. Starting automated health check polling...", pid),
                        );
                    }
                    Err(e) => {
                        Logger::global().error(
                            "FAILED",
                            &install_str,
                            &format!("Failed to start backend kernel: {}. Notifying frontend.", e),
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
                        "Backend kernel healthy and verified. Revealing main window and notifying UI.",
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
                        "Automated health check timed out. Showing diagnostic recovery panel.",
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
            launch_kernel,
            check_health,
            get_monitored_kernel,
            agentic_os_lib::commands::download::download_github_release_asset,
            agentic_os_lib::commands::credential_vault::vault_store_secret,
            agentic_os_lib::commands::credential_vault::vault_get_secret,
            agentic_os_lib::commands::credential_vault::vault_delete_secret,
            agentic_os_lib::commands::credential_vault::vault_list_keys,
            agentic_os_lib::commands::credential_vault::vault_has_secret,
            agentic_os_lib::commands::kernel::get_startup_status,
            agentic_os_lib::commands::kernel::retry_kernel_startup,
            agentic_os_lib::commands::kernel::open_diagnostic_log,
            agentic_os_lib::commands::kernel::copy_diagnostic_report,
        ])
        .build(tauri::generate_context!())
        .expect("error while building AgenticOS Desktop application");

    // Modified main loop: Listens to application exit events and ensures child process cleanup
    app.run(move |_app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                Logger::global().info("SHUTDOWN", "", "Application exit requested. Cleaning up child processes...");
                cleanup_child_process();
            }
            tauri::RunEvent::Exit => {
                Logger::global().info("SHUTDOWN", "", "Application exit event. Terminating backend kernel...");
                cleanup_child_process();
            }
            _ => {}
        }
    });
}
