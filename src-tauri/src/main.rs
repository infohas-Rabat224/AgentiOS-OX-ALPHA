#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use agentic_os_lib::logger::{self, Logger};
use agentic_os_lib::services::health_check::{HealthCheckService, KernelHealthPayload};
use agentic_os_lib::KernelService;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// Startup metadata captured immediately upon launch for diagnostic & forensic audit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupMetadata {
    pub timestamp: String,
    pub app_name: String,
    pub app_version: String,
    pub os: String,
    pub os_family: String,
    pub architecture: String,
    pub exe_path: String,
    pub current_working_dir: String,
    pub localappdata_dir: String,
    pub log_path: String,
    pub host_pid: u32,
    pub target_triple: String,
}

/// Robust startup logging utility capturing metadata and critical exit codes to %LOCALAPPDATA%\AgenticOS\logs\startup.log
pub struct StartupDiagnosticsLogger;

impl StartupDiagnosticsLogger {
    /// Resolves the absolute path to %LOCALAPPDATA%\AgenticOS\logs\startup.log
    pub fn resolve_startup_log_path() -> PathBuf {
        #[cfg(windows)]
        {
            if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
                return PathBuf::from(app_data).join("AgenticOS").join("logs").join("startup.log");
            }
        }
        #[cfg(not(windows))]
        {
            if let Ok(home) = std::env::var("HOME") {
                return PathBuf::from(home).join(".agenticos").join("logs").join("startup.log");
            }
        }
        PathBuf::from("logs").join("startup.log")
    }

    /// Captures full startup metadata immediately upon launch and writes to startup.log
    pub fn init_and_log_startup() -> StartupMetadata {
        let log_file = Self::resolve_startup_log_path();
        if let Some(parent) = log_file.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let exe_path = std::env::current_exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "UNKNOWN_EXE_PATH".to_string());

        let cwd = std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "UNKNOWN_CWD".to_string());

        let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| {
            std::env::var("HOME").unwrap_or_else(|_| "UNKNOWN".to_string())
        });

        let timestamp = logger::chrono_iso_timestamp();
        let app_version = env!("CARGO_PKG_VERSION").to_string();
        let os = std::env::consts::OS.to_string();
        let os_family = std::env::consts::FAMILY.to_string();
        let architecture = std::env::consts::ARCH.to_string();
        let host_pid = std::process::id();
        let target_triple = format!("{}-{}-{}", architecture, os, os_family);

        let metadata = StartupMetadata {
            timestamp: timestamp.clone(),
            app_name: "AgenticOS Desktop Mission Control".to_string(),
            app_version: app_version.clone(),
            os: os.clone(),
            os_family: os_family.clone(),
            architecture: architecture.clone(),
            exe_path: exe_path.clone(),
            current_working_dir: cwd.clone(),
            localappdata_dir: localappdata,
            log_path: log_file.to_string_lossy().to_string(),
            host_pid,
            target_triple,
        };

        // Write immediate formatted startup banner to startup.log
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_file) {
            let banner = format!(
                "\n================================================================================\n\
                 AGENTICOS STARTUP DIAGNOSTICS SESSION INITIALIZED\n\
                 Timestamp:          {}\n\
                 Application:        {} v{}\n\
                 OS / Architecture:  {} ({}) / {}\n\
                 Host Process PID:   {}\n\
                 Executable Path:    {}\n\
                 Working Directory:  {}\n\
                 Startup Log File:   {}\n\
                 ================================================================================\n",
                metadata.timestamp,
                metadata.app_name,
                metadata.app_version,
                metadata.os,
                metadata.os_family,
                metadata.architecture,
                metadata.host_pid,
                metadata.exe_path,
                metadata.current_working_dir,
                metadata.log_path,
            );
            let _ = file.write_all(banner.as_bytes());

            let entry = format!(
                "[{}] [METADATA] [INIT] version=\"{}\" arch=\"{}\" os=\"{}\" host_pid=\"{}\" exe=\"{}\" cwd=\"{}\" log=\"{}\" - Immediate startup metadata captured successfully\n",
                metadata.timestamp,
                metadata.app_version,
                metadata.architecture,
                metadata.os,
                metadata.host_pid,
                metadata.exe_path,
                metadata.current_working_dir,
                metadata.log_path,
            );
            let _ = file.write_all(entry.as_bytes());
            let _ = file.flush();
        }

        // Install early-stage panic hook
        Self::install_panic_hook();

        metadata
    }

    /// Installs a panic hook to capture unexpected early-stage crashes and panic traces with exit code 101
    pub fn install_panic_hook() {
        let prev_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |panic_info| {
            let log_file = Self::resolve_startup_log_path();
            let timestamp = logger::chrono_iso_timestamp();

            let payload = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
                s.clone()
            } else {
                "Box<Any> unknown panic payload".to_string()
            };

            let location = if let Some(loc) = panic_info.location() {
                format!("{}:{}:{}", loc.file(), loc.line(), loc.column())
            } else {
                "unknown location".to_string()
            };

            let panic_msg = format!(
                "[{}] [FATAL] [CRASHED] component=\"AgenticOS.exe\" exit_code=\"101\" location=\"{}\" - Early-stage unhandled panic captured: {}\n",
                timestamp, location, payload
            );

            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_file) {
                let _ = file.write_all(panic_msg.as_bytes());
                let _ = file.flush();
            }

            prev_hook(panic_info);
        }));
    }

    /// Logs critical exit codes and termination metadata directly to startup.log
    pub fn log_critical_exit(
        component: &str,
        exit_code: Option<i32>,
        status: &str,
        message: &str,
        details: Option<&str>,
    ) {
        let log_file = Self::resolve_startup_log_path();
        let timestamp = logger::chrono_iso_timestamp();
        let version = env!("CARGO_PKG_VERSION");
        let arch = std::env::consts::ARCH;
        let os = std::env::consts::OS;

        let exit_code_str = match exit_code {
            Some(code) => format!("{}", code),
            None => "SIGNAL_OR_UNKNOWN".to_string(),
        };

        let formatted = format!(
            "[{}] [CRITICAL] [{}] component=\"{}\" exit_code=\"{}\" version=\"{}\" arch=\"{}\" os=\"{}\" - {}{}\n",
            timestamp,
            status.to_uppercase(),
            component,
            exit_code_str,
            version,
            arch,
            os,
            message,
            details.map(|d| format!(" | details: {}", d)).unwrap_or_default()
        );

        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_file) {
            let _ = file.write_all(formatted.as_bytes());
            let _ = file.flush();
        }

        // Also record in global Logger instance
        Logger::global().log_with_exit(
            if exit_code == Some(0) { "INFO" } else { "ERROR" },
            status,
            component,
            exit_code,
            message,
            details,
        );
    }
}

/// Information about the monitored backend kernel process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelProcessInfo {
    pub pid: u32,
    pub binary_path: String,
    pub working_directory: String,
    pub log_path: String,
    pub status: String,
    pub started_at: String,
}

/// Response returned from the non-blocking health check
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

/// Dedicated Rust service in src-tauri/src/main.rs that utilizes std::process::Command
/// to safely manage the lifecycle of the internal AgenticOS kernel, implement a
/// non-blocking health-check loop on 127.0.0.1:8001/healthz, and ensure the child
/// process is terminated when the parent application exits.
pub struct KernelLifecycleService {
    child: Arc<Mutex<Option<Child>>>,
    active_pid: Arc<Mutex<Option<u32>>>,
    binary_path: Arc<Mutex<Option<String>>>,
    working_dir: Arc<Mutex<Option<String>>>,
}

impl KernelLifecycleService {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            active_pid: Arc::new(Mutex::new(None)),
            binary_path: Arc::new(Mutex::new(None)),
            working_dir: Arc::new(Mutex::new(None)),
        }
    }

    /// Resolves the absolute installation directory
    pub fn resolve_installation_path(&self, app: &AppHandle) -> PathBuf {
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

    /// Resolves the internal kernel binary or sidecar path
    pub fn resolve_kernel_binary(
        &self,
        app: &AppHandle,
        custom_path: Option<String>,
    ) -> Result<(PathBuf, PathBuf), String> {
        let install_dir = self.resolve_installation_path(app);

        // Custom override if provided
        if let Some(ref path_str) = custom_path {
            let p = PathBuf::from(path_str);
            if p.is_file() && p.exists() {
                let working_dir = p.parent().unwrap_or(&install_dir).to_path_buf();
                return Ok((p, working_dir));
            }
        }

        // Search candidates inside installation directory
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

        // Check bundled Python runtime sidecar
        let python_candidates = [
            install_dir.join("python").join("python.exe"),
            install_dir.join("python").join("bin").join("python3"),
        ];

        for p in &python_candidates {
            if p.exists() && p.is_file() {
                return Ok((p.clone(), install_dir.clone()));
            }
        }

        // Development/staging fallback
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
            "AgenticOS backend kernel binary not found in installation path ({:?})",
            install_dir
        ))
    }

    /// Safely launches the internal AgenticOS kernel using std::process::Command with a
    /// controlled working directory set to the installation path, capturing stdout/stderr,
    /// monitoring the child process, and logging diagnostics to startup.log
    pub fn start_kernel(
        &self,
        app: &AppHandle,
        custom_path: Option<String>,
    ) -> Result<KernelProcessInfo, String> {
        let logger = Logger::global();

        // 1. Terminate any previous child process
        self.terminate_child();

        // 2. Resolve internal binary and installation working directory
        let (binary_path, install_path) = self.resolve_kernel_binary(app, custom_path)
            .map_err(|e| {
                logger.error("FAILED", "", &format!("Failed resolving kernel binary: {}", e), None);
                e
            })?;

        let binary_str = binary_path.to_string_lossy().to_string();
        let install_str = install_path.to_string_lossy().to_string();

        logger.info(
            "LAUNCHING",
            &binary_str,
            &format!("Spawning backend process in working directory: {}", install_str),
        );

        // 3. Prepare log directory and files: capture stdout/stderr to %LOCALAPPDATA%\AgenticOS\logs\startup.log
        let log_dir = Logger::resolve_log_dir();
        fs::create_dir_all(&log_dir).map_err(|e| format!("Failed creating log dir: {}", e))?;
        let startup_log_path = log_dir.join("startup.log");

        let stdout_log = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&startup_log_path)
            .map_err(|e| format!("Failed to open stdout log {:?}: {}", startup_log_path, e))?;

        let stderr_log = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&startup_log_path)
            .map_err(|e| format!("Failed to open stderr log {:?}: {}", startup_log_path, e))?;

        // 4. Safely configure Command with controlled working directory
        let mut cmd = Command::new(&binary_path);
        cmd.current_dir(&install_path);
        cmd.stdout(Stdio::from(stdout_log));
        cmd.stderr(Stdio::from(stderr_log));

        // Set absolute environment variables pointing to bundled runtime resources
        let hybrid_dir = install_path.join("AgenticosHybrid");
        let python_dir = install_path.join("python");
        let hybrid_src = hybrid_dir.join("src");

        cmd.env("AGENTICOS_INSTALL_DIR", &install_path);
        cmd.env("AGENTICOS_HYBRID_DIR", &hybrid_dir);
        cmd.env("AGENTICOS_PYTHON_DIR", &python_dir);

        if hybrid_src.exists() {
            cmd.env("PYTHONPATH", &hybrid_src);
        }

        // If Python sidecar is detected, set PYTHONPATH and args
        if binary_str.ends_with("python.exe") || binary_str.ends_with("python3") {
            cmd.env("PYTHONPATH", &hybrid_src);
            cmd.args(&["-m", "agentic_os", "serve", "--host", "127.0.0.1", "--port", "8001"]);
        }

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        // 5. Spawn child process
        match cmd.spawn() {
            Ok(child) => {
                let pid = child.id();
                let log_str = kernel_log_path.to_string_lossy().to_string();

                logger.info(
                    "RUNNING",
                    &binary_str,
                    &format!("Kernel process successfully spawned with PID {} in working directory {}", pid, install_str),
                );

                *self.active_pid.lock().unwrap() = Some(pid);
                *self.binary_path.lock().unwrap() = Some(binary_str.clone());
                *self.working_dir.lock().unwrap() = Some(install_str.clone());
                *self.child.lock().unwrap() = Some(child);

                // Spawn non-blocking background task to monitor child process lifecycle
                let child_arc = self.child.clone();
                let pid_arc = self.active_pid.clone();
                let app_clone = app.clone();
                let mon_bin = binary_str.clone();
                let mon_install = install_str.clone();

                tauri::async_runtime::spawn(async move {
                    loop {
                        tokio::time::sleep(Duration::from_millis(500)).await;

                        let mut guard = child_arc.lock().unwrap_or_else(|e| e.into_inner());
                        if let Some(ref mut child_proc) = *guard {
                            if child_proc.id() == pid {
                                match child_proc.try_wait() {
                                    Ok(Some(exit_status)) => {
                                        let exit_code = exit_status.code();
                                        let err_msg = format!(
                                            "Backend child process (PID {}) terminated unexpectedly with exit code: {:?}",
                                            pid, exit_code
                                        );

                                        StartupDiagnosticsLogger::log_critical_exit(
                                            &mon_bin,
                                            exit_code,
                                            "CRASHED",
                                            &err_msg,
                                            Some("Child kernel process exited unexpectedly."),
                                        );

                                        *pid_arc.lock().unwrap_or_else(|e| e.into_inner()) = None;
                                        let _ = app_clone.emit("agenticos://kernel_crashed", &err_msg);
                                        break;
                                    }
                                    Ok(None) => {
                                        // Process is active and healthy
                                    }
                                    Err(e) => {
                                        let err_msg = format!("Error monitoring backend process PID {}: {}", pid, e);
                                        StartupDiagnosticsLogger::log_critical_exit(
                                            &mon_install,
                                            None,
                                            "FAILED",
                                            &err_msg,
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
                logger.error("FAILED", &binary_str, &err_msg, Some("Verify file permissions and runtime environment."));
                Err(err_msg)
            }
        }
    }

    /// Non-blocking automated health check loop on 127.0.0.1:8001/healthz
    pub async fn run_nonblocking_health_check_loop(
        &self,
        app: &AppHandle,
        timeout_secs: u64,
    ) -> bool {
        let install_str = self.working_dir.lock().unwrap().clone().unwrap_or_default();
        let health_service = HealthCheckService::new(
            Some("http://127.0.0.1:8001/healthz".to_string()),
            Some(timeout_secs),
        );

        health_service.poll_until_ready(app, &install_str).await
    }

    /// Safely terminates the child process and ensures clean exit
    pub fn terminate_child(&self) {
        let mut guard = self.child.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(mut child) = guard.take() {
            let pid = child.id();
            let logger = Logger::global();
            logger.info("SHUTDOWN", "", &format!("Terminating child process PID {}", pid));
            let _ = child.kill();
            let exit_status = child.wait().ok();
            let exit_code = exit_status.and_then(|s| s.code());
            logger.log_backend_exit(
                "STOPPED",
                "",
                exit_code,
                &format!("Child process PID {} terminated cleanly.", pid),
            );
        }
        *self.active_pid.lock().unwrap_or_else(|e| e.into_inner()) = None;
    }

    /// Gets current monitored process info
    pub fn get_process_info(&self) -> Option<KernelProcessInfo> {
        let pid_opt = *self.active_pid.lock().unwrap();
        if let Some(pid) = pid_opt {
            let path = self.binary_path.lock().unwrap().clone().unwrap_or_default();
            let install = self.working_dir.lock().unwrap().clone().unwrap_or_default();
            let log = Logger::global().log_path().to_string_lossy().to_string();
            Some(KernelProcessInfo {
                pid,
                binary_path: path,
                working_directory: install,
                log_path: log,
                status: "ACTIVE".to_string(),
                started_at: "monitored".to_string(),
            })
        } else {
            None
        }
    }
}

// IPC Commands
#[tauri::command]
pub async fn launch_kernel(
    app: AppHandle,
    lifecycle_service: tauri::State<'_, Arc<KernelLifecycleService>>,
    custom_path: Option<String>,
) -> Result<KernelProcessInfo, String> {
    lifecycle_service.start_kernel(&app, custom_path)
}

#[tauri::command]
pub async fn launch_agenticos_kernel(
    app: AppHandle,
    lifecycle_service: tauri::State<'_, Arc<KernelLifecycleService>>,
    custom_path: Option<String>,
) -> Result<KernelProcessInfo, String> {
    lifecycle_service.start_kernel(&app, custom_path)
}

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
                "Health check failed on 127.0.0.1:8001/healthz ({}ms): {}",
                elapsed, e
            ))
        }
    }
}

#[tauri::command]
pub async fn get_monitored_kernel(
    lifecycle_service: tauri::State<'_, Arc<KernelLifecycleService>>,
) -> Result<Option<KernelProcessInfo>, String> {
    Ok(lifecycle_service.get_process_info())
}

#[tauri::command]
pub fn get_startup_metadata() -> Result<StartupMetadata, String> {
    let log_file = StartupDiagnosticsLogger::resolve_startup_log_path();
    let exe_path = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "UNKNOWN_EXE_PATH".to_string());
    let cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "UNKNOWN_CWD".to_string());
    let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| {
        std::env::var("HOME").unwrap_or_else(|_| "UNKNOWN".to_string())
    });

    Ok(StartupMetadata {
        timestamp: logger::chrono_iso_timestamp(),
        app_name: "AgenticOS Desktop Mission Control".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        os_family: std::env::consts::FAMILY.to_string(),
        architecture: std::env::consts::ARCH.to_string(),
        exe_path,
        current_working_dir: cwd,
        localappdata_dir: localappdata,
        log_path: log_file.to_string_lossy().to_string(),
        host_pid: std::process::id(),
        target_triple: format!("{}-{}-{}", std::env::consts::ARCH, std::env::consts::OS, std::env::consts::FAMILY),
    })
}

fn main() {
    // 1. Immediately capture startup metadata, configure panic hook, and record to %LOCALAPPDATA%\AgenticOS\logs\startup.log
    let startup_meta = StartupDiagnosticsLogger::init_and_log_startup();

    let logger = Logger::global();
    let kernel_service = Arc::new(KernelService::new());
    let lifecycle_service = Arc::new(KernelLifecycleService::new());
    let lifecycle_clone = lifecycle_service.clone();

    logger.info(
        "INIT",
        &startup_meta.exe_path,
        &format!(
            "AgenticOS Desktop Mission Control initializing on {} ({}) v{}",
            startup_meta.os, startup_meta.architecture, startup_meta.app_version
        ),
    );

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(kernel_service)
        .manage(lifecycle_service)
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let lifecycle = lifecycle_clone.clone();

            // Background non-blocking task:
            // Safely launches the internal AgenticOS kernel using std::process::Command with
            // a controlled working directory set to the installation path, and executes a
            // non-blocking health-check loop on 127.0.0.1:8001/healthz
            tauri::async_runtime::spawn(async move {
                let install_dir = lifecycle.resolve_installation_path(&app_handle);
                let install_str = install_dir.to_string_lossy().to_string();

                Logger::global().info(
                    "STARTUP",
                    &install_str,
                    "Runtime setup starting. Launching internal kernel with controlled working directory...",
                );

                // 1. Launch kernel using std::process::Command
                match lifecycle.start_kernel(&app_handle, None) {
                    Ok(info) => {
                        Logger::global().info(
                            "RUNNING",
                            &install_str,
                            &format!("Backend process spawned with PID {}. Starting non-blocking health-check loop...", info.pid),
                        );
                    }
                    Err(e) => {
                        let err_msg = format!("Failed launching backend kernel: {}", e);
                        StartupDiagnosticsLogger::log_critical_exit(
                            "agenticos-kernel",
                            Some(1),
                            "LAUNCH_FAILED",
                            &err_msg,
                            Some("Kernel binary resolution or spawn failure occurred."),
                        );
                        let _ = app_handle.emit("agenticos://startup_failed", &err_msg);
                        if let Some(main_window) = app_handle.get_webview_window("main") {
                            let _ = main_window.show();
                        }
                        return;
                    }
                }

                // 2. Non-blocking health-check loop on 127.0.0.1:8001/healthz
                let is_healthy = lifecycle.run_nonblocking_health_check_loop(&app_handle, 15).await;

                if is_healthy {
                    Logger::global().info(
                        "READY",
                        &install_str,
                        "Backend kernel verified healthy. Revealing main application window.",
                    );
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        let _ = main_window.show();
                        let _ = main_window.set_focus();
                    }
                } else {
                    StartupDiagnosticsLogger::log_critical_exit(
                        "agenticos-kernel",
                        None,
                        "TIMEOUT",
                        "Non-blocking health check timed out on 127.0.0.1:8001/healthz after 15 seconds.",
                        Some("Showing forensic diagnostic UI for remote debugging."),
                    );
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        let _ = main_window.show();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            launch_kernel,
            launch_agenticos_kernel,
            check_health,
            get_monitored_kernel,
            get_startup_metadata,
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
        ]);

    let app = match builder.build(tauri::generate_context!()) {
        Ok(app) => app,
        Err(e) => {
            let err_msg = format!("Failed to build Tauri desktop application context: {}", e);
            StartupDiagnosticsLogger::log_critical_exit(
                "AgenticOS.exe",
                Some(1),
                "FATAL_BUILD",
                &err_msg,
                Some("Early-stage Tauri builder context creation failed."),
            );
            panic!("{}", err_msg);
        }
    };

    // Main event loop: Ensures the child process is terminated when the parent application exits
    let exit_lifecycle = app.state::<Arc<KernelLifecycleService>>().inner().clone();
    app.run(move |_app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                StartupDiagnosticsLogger::log_critical_exit(
                    "AgenticOS.exe",
                    Some(0),
                    "SHUTDOWN",
                    "Application exit requested. Cleaning up child processes.",
                    None,
                );
                exit_lifecycle.terminate_child();
            }
            tauri::RunEvent::Exit => {
                StartupDiagnosticsLogger::log_critical_exit(
                    "AgenticOS.exe",
                    Some(0),
                    "EXIT",
                    "Application exit final event completed.",
                    None,
                );
                exit_lifecycle.terminate_child();
            }
            _ => {}
        }
    });
}
