#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Manager};

static GLOBAL_KERNEL_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
static GLOBAL_KERNEL_PID: Mutex<Option<u32>> = Mutex::new(None);
static GLOBAL_KERNEL_PATH: Mutex<Option<String>> = Mutex::new(None);
static GLOBAL_LOG_PATH: Mutex<Option<String>> = Mutex::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelProcessInfo {
    pub pid: u32,
    pub binary_path: String,
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

fn get_default_log_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(app_data).join("AgenticOS").join("logs");
        }
    }
    #[cfg(not(windows))]
    {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join(".agenticos").join("logs");
        }
    }
    PathBuf::from("logs")
}

fn append_startup_log(msg: &str) {
    let log_dir = get_default_log_dir();
    let _ = fs::create_dir_all(&log_dir);
    let log_file = log_dir.join("startup.log");
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(log_file) {
        let timestamp = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = writeln!(f, "[{}s] {}", timestamp, msg);
    }
}

/// Safely resolves the absolute internal path to the AgenticOS kernel binary
fn resolve_absolute_kernel_path(app: &AppHandle, custom_path: Option<String>) -> Result<PathBuf, String> {
    // 1. If explicit custom path is passed, check it first
    if let Some(ref path_str) = custom_path {
        let p = PathBuf::from(path_str);
        if p.is_absolute() && p.exists() && p.is_file() {
            return Ok(p);
        }
        if let Ok(canonical) = p.canonicalize() {
            if canonical.exists() && canonical.is_file() {
                return Ok(canonical);
            }
        }
    }

    // 2. Tauri internal resource directory
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join("agenticos-kernel.exe"),
            resource_dir.join("bin").join("agenticos-kernel.exe"),
            resource_dir.join("build-windows").join("bin").join("agenticos-kernel.exe"),
            resource_dir.join("agenticos-kernel"),
        ];
        for c in &candidates {
            if c.exists() && c.is_file() {
                if let Ok(canonical) = c.canonicalize() {
                    return Ok(canonical);
                }
                return Ok(c.clone());
            }
        }
    }

    // 3. Current executable directory (installation root)
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            let candidates = [
                parent.join("agenticos-kernel.exe"),
                parent.join("bin").join("agenticos-kernel.exe"),
                parent.join("..").join("build-windows").join("bin").join("agenticos-kernel.exe"),
                parent.join("agenticos-kernel"),
            ];
            for c in &candidates {
                if c.exists() && c.is_file() {
                    if let Ok(canonical) = c.canonicalize() {
                        return Ok(canonical);
                    }
                    return Ok(c.clone());
                }
            }
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
            if let Ok(canonical) = c.canonicalize() {
                return Ok(canonical);
            }
            return Ok(c.clone());
        }
    }

    Err("AgenticOS kernel binary not found in resource directory, installation folder, or workspace.".to_string())
}

/// Safely launches the AgenticOS kernel binary from an absolute internal path,
/// monitors its PID, and captures stdout/stderr to a log file.
#[tauri::command]
pub async fn launch_kernel(
    app: AppHandle,
    custom_path: Option<String>,
) -> Result<KernelProcessInfo, String> {
    // 1. Resolve absolute internal path
    let absolute_path = resolve_absolute_kernel_path(&app, custom_path)
        .map_err(|e| {
            append_startup_log(&format!("ERROR: Failed to resolve kernel path: {}", e));
            e
        })?;

    append_startup_log(&format!("Resolved absolute kernel binary path: {:?}", absolute_path));

    // 2. Setup logging directory and files
    let log_dir = get_default_log_dir();
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

    // 3. Terminate any previously running kernel instance
    {
        let mut child_guard = GLOBAL_KERNEL_PROCESS.lock().unwrap();
        if let Some(mut existing_child) = child_guard.take() {
            let _ = existing_child.kill();
            let _ = existing_child.wait();
            append_startup_log("Cleaned up existing kernel process before restart.");
        }
    }

    // 4. Construct Command with absolute internal path
    let mut cmd = Command::new(&absolute_path);
    if let Some(parent) = absolute_path.parent() {
        cmd.current_dir(parent);
    }
    cmd.stdout(Stdio::from(stdout_log));
    cmd.stderr(Stdio::from(stderr_log));

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW = 0x08000000 to keep UI clean
        cmd.creation_flags(0x08000000);
    }

    // 5. Safely spawn and monitor PID
    match cmd.spawn() {
        Ok(child) => {
            let pid = child.id();
            let started_at = format!("{:?}", Instant::now());
            let path_str = absolute_path.to_string_lossy().to_string();
            let log_str = kernel_log_path.to_string_lossy().to_string();

            append_startup_log(&format!(
                "Kernel binary spawned successfully! PID: {} | Path: {} | Log: {}",
                pid, path_str, log_str
            ));

            *GLOBAL_KERNEL_PID.lock().unwrap() = Some(pid);
            *GLOBAL_KERNEL_PATH.lock().unwrap() = Some(path_str.clone());
            *GLOBAL_LOG_PATH.lock().unwrap() = Some(log_str.clone());
            *GLOBAL_KERNEL_PROCESS.lock().unwrap() = Some(child);

            Ok(KernelProcessInfo {
                pid,
                binary_path: path_str,
                log_path: log_str,
                status: "RUNNING".to_string(),
                started_at,
            })
        }
        Err(e) => {
            let err_msg = format!("Failed to spawn kernel binary at {:?}: {}", absolute_path, e);
            append_startup_log(&format!("ERROR: {}", err_msg));
            Err(err_msg)
        }
    }
}

/// Performs an HTTP GET request to 127.0.0.1:8001/healthz and validates the kernel health
#[tauri::command]
pub async fn check_health() -> Result<HealthResponse, String> {
    let start = Instant::now();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(2000))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let url = "http://127.0.0.1:8001/healthz";
    append_startup_log(&format!("Checking health endpoint: {}", url));

    match client.get(url).send().await {
        Ok(resp) => {
            let http_code = resp.status().as_u16();
            let duration_ms = start.elapsed().as_millis() as u64;

            if resp.status().is_success() {
                let text = resp.text().await.unwrap_or_default();
                let mut subsystems = HashMap::new();
                let mut service = None;
                let mut phase = None;
                let mut health = None;
                let mut uptime = None;

                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                    service = v.get("service").and_then(|s| s.as_str()).map(String::from);
                    phase = v.get("phase").and_then(|s| s.as_str()).map(String::from);
                    health = v.get("health").and_then(|s| s.as_str()).map(String::from);
                    uptime = v.get("uptime_seconds").and_then(|u| u.as_f64());

                    if let Some(sub) = v.get("subsystems").and_then(|s| s.as_object()) {
                        for (k, val) in sub {
                            subsystems.insert(k.clone(), val.as_str().unwrap_or("ok").to_string());
                        }
                    }
                }

                Ok(HealthResponse {
                    status: "ok".to_string(),
                    service,
                    phase,
                    health,
                    uptime_seconds: uptime,
                    subsystems,
                    raw_json: Some(text),
                    http_code,
                    duration_ms,
                })
            } else {
                Err(format!(
                    "Kernel healthz responded with HTTP error code: {}",
                    http_code
                ))
            }
        }
        Err(e) => {
            let elapsed = start.elapsed().as_millis() as u64;
            Err(format!(
                "Failed to connect to 127.0.0.1:8001/healthz after {}ms: {}",
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
        let log = GLOBAL_LOG_PATH.lock().unwrap().clone().unwrap_or_default();
        Ok(Some(KernelProcessInfo {
            pid,
            binary_path: path,
            log_path: log,
            status: "ACTIVE".to_string(),
            started_at: "monitored".to_string(),
        }))
    } else {
        Ok(None)
    }
}

fn main() {
    let kernel_service = Arc::new(agentic_os_lib::KernelService::new());
    let service_clone = kernel_service.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(kernel_service)
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let service = service_clone.clone();

            // Background task: launches kernel and verifies health
            tauri::async_runtime::spawn(async move {
                append_startup_log("AgenticOS Desktop runtime setup starting...");
                let _ = service.start_kernel(Some(&app_handle));
                let is_healthy = service.run_health_check_loop(15).await;
                append_startup_log(&format!("Initial health check result: healthy={}", is_healthy));
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
        .run(tauri::generate_context!())
        .expect("error while running AgenticOS Desktop application");
}
