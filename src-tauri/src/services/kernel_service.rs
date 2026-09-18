use crate::logger::Logger;
use crate::services::health_check::{HealthCheckService, KernelHealthPayload};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartupDiagnostics {
    pub status: String,         // "READY" | "FAILED" | "STARTING" | "DEGRADED"
    pub component: String,      // "Backend Kernel"
    pub is_healthy: bool,
    pub backend_pid: Option<u32>,
    pub kernel_port: u16,
    pub frontend_port: u16,
    pub health_url: String,
    pub uptime_seconds: f64,
    pub error_reason: Option<String>,
    pub diagnostic_trace: String,
    pub log_path: String,
    pub kernel_binary_path: Option<String>,
    pub platform: String,
    pub os_version: String,
    pub arch: String,
    pub hostname: String,
    pub total_memory_mb: u64,
    pub available_memory_mb: u64,
    pub cpu_cores: usize,
    pub subsystems: HashMap<String, String>,
    pub timestamp: String,
}

pub struct KernelService {
    process: Arc<Mutex<Option<Child>>>,
    diagnostics: Arc<Mutex<StartupDiagnostics>>,
    start_time: Instant,
    log_dir: PathBuf,
}

impl KernelService {
    pub fn new() -> Self {
        let logger = Logger::global();
        let log_dir = Logger::resolve_log_dir();
        let _ = fs::create_dir_all(&log_dir);

        let mut subsystems = HashMap::new();
        subsystems.insert("container".to_string(), "unknown".to_string());
        subsystems.insert("lifecycle".to_string(), "unknown".to_string());
        subsystems.insert("omniroute".to_string(), "unknown".to_string());
        subsystems.insert("bus".to_string(), "unknown".to_string());
        subsystems.insert("discovery".to_string(), "unknown".to_string());

        let initial_diagnostics = StartupDiagnostics {
            status: "STARTING".to_string(),
            component: "Backend Kernel".to_string(),
            is_healthy: false,
            backend_pid: None,
            kernel_port: 8001,
            frontend_port: 3000,
            health_url: "http://127.0.0.1:8001/healthz".to_string(),
            uptime_seconds: 0.0,
            error_reason: None,
            diagnostic_trace: "Initializing KernelService supervisor...".to_string(),
            log_path: logger.log_path().to_string_lossy().to_string(),
            kernel_binary_path: None,
            platform: std::env::consts::OS.to_string(),
            os_version: std::env::consts::FAMILY.to_string(),
            arch: std::env::consts::ARCH.to_string(),
            hostname: get_hostname(),
            total_memory_mb: 8192,
            available_memory_mb: 4096,
            cpu_cores: num_cpus_or_default(),
            subsystems,
            timestamp: crate::logger::chrono_iso_timestamp(),
        };

        logger.info(
            "INIT",
            &log_dir.to_string_lossy(),
            "KernelService initialized with structured diagnostic logger",
        );

        Self {
            process: Arc::new(Mutex::new(None)),
            diagnostics: Arc::new(Mutex::new(initial_diagnostics)),
            start_time: Instant::now(),
            log_dir,
        }
    }

    /// Access the shared child process mutex
    pub fn get_process_handle(&self) -> Arc<Mutex<Option<Child>>> {
        self.process.clone()
    }

    /// Logs to %LOCALAPPDATA%\AgenticOS\logs\startup.log using structured Logger
    pub fn append_log(&self, msg: &str) {
        let diag_path = self.diagnostics.lock().unwrap().kernel_binary_path.clone().unwrap_or_default();
        Logger::global().info("STARTUP", &diag_path, msg);
    }

    /// Resolves the absolute installation path
    pub fn resolve_installation_path(&self, app_handle: Option<&AppHandle>) -> PathBuf {
        // 1. Check Tauri resource directory
        if let Some(app) = app_handle {
            if let Ok(res_dir) = app.path().resource_dir() {
                if res_dir.exists() {
                    return res_dir;
                }
            }
        }

        // 2. Directory containing current executable
        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(parent) = current_exe.parent() {
                if parent.exists() {
                    return parent.to_path_buf();
                }
            }
        }

        // 3. %LOCALAPPDATA%\AgenticOS
        #[cfg(windows)]
        {
            if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
                let p = PathBuf::from(app_data).join("AgenticOS");
                if p.exists() {
                    return p;
                }
            }
        }

        // 4. Fallback
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    }

    /// Detects the AgenticOS kernel binary or runtime entry point
    pub fn detect_kernel_binary(&self, app_handle: Option<&AppHandle>) -> Option<(PathBuf, PathBuf)> {
        let install_path = self.resolve_installation_path(app_handle);

        // Native binary candidates inside installation path
        let candidates = [
            install_path.join("agenticos-kernel.exe"),
            install_path.join("bin").join("agenticos-kernel.exe"),
            install_path.join("build-windows").join("bin").join("agenticos-kernel.exe"),
            install_path.join("agenticos-kernel"),
            install_path.join("..").join("build-windows").join("bin").join("agenticos-kernel.exe"),
        ];

        for c in &candidates {
            if c.exists() && c.is_file() {
                Logger::global().info(
                    "RESOLVED",
                    &c.to_string_lossy(),
                    &format!("Resolved native kernel binary at {:?}", c),
                );
                return Some((c.clone(), install_path));
            }
        }

        // Check bundled Python runtime sidecar
        let python_candidates = [
            install_path.join("python").join("python.exe"),
            install_path.join("python").join("bin").join("python3"),
        ];

        for p in &python_candidates {
            if p.exists() && p.is_file() {
                Logger::global().info(
                    "RESOLVED",
                    &p.to_string_lossy(),
                    &format!("Resolved bundled Python runtime at {:?}", p),
                );
                return Some((p.clone(), install_path));
            }
        }

        // Check workspace paths (development/staging)
        let dev_candidates = [
            PathBuf::from("build-windows/bin/agenticos-kernel.exe"),
            PathBuf::from("../build-windows/bin/agenticos-kernel.exe"),
            PathBuf::from("bin/agenticos-kernel.exe"),
            PathBuf::from("agenticos-kernel.exe"),
        ];

        for c in &dev_candidates {
            if c.exists() && c.is_file() {
                let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
                return Some((c.clone(), cwd));
            }
        }

        None
    }

    /// Launches the kernel backend process with a controlled working directory set
    /// to the installation path using std::process::Command, monitoring the child process
    pub fn start_kernel(&self, app_handle: Option<&AppHandle>) -> Result<u32, String> {
        // First kill and clean up any previously running kernel instance
        self.stop_kernel();

        let logger = Logger::global();
        let detection = self.detect_kernel_binary(app_handle);
        let mut diag = self.diagnostics.lock().unwrap();
        diag.timestamp = crate::logger::chrono_iso_timestamp();

        let kernel_log_path = self.log_dir.join("kernel.log");
        let log_file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&kernel_log_path)
            .map_err(|e| format!("Failed to open kernel log {:?}: {}", kernel_log_path, e))?;

        if let Some((ref binary, ref install_path)) = detection {
            let binary_str = binary.to_string_lossy().to_string();
            let install_str = install_path.to_string_lossy().to_string();
            diag.kernel_binary_path = Some(binary_str.clone());

            logger.info(
                "LAUNCHING",
                &binary_str,
                &format!("Configuring std::process::Command with working directory: {}", install_str),
            );

            // Use std::process::Command with controlled working directory
            let mut cmd = Command::new(binary);
            cmd.current_dir(install_path);
            cmd.stdout(Stdio::from(log_file.try_clone().unwrap()));
            cmd.stderr(Stdio::from(log_file));

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                // CREATE_NO_WINDOW = 0x08000000 to keep desktop presentation clean
                cmd.creation_flags(0x08000000);
            }

            match cmd.spawn() {
                Ok(child) => {
                    let pid = child.id();
                    logger.info(
                        "RUNNING",
                        &binary_str,
                        &format!("Kernel process spawned successfully with PID {}", pid),
                    );

                    diag.backend_pid = Some(pid);
                    diag.status = "STARTING".to_string();
                    diag.error_reason = None;

                    *self.process.lock().unwrap() = Some(child);

                    // Spawn child monitor task
                    self.spawn_child_monitor(pid, install_str, app_handle.cloned());

                    Ok(pid)
                }
                Err(e) => {
                    let err = format!("Failed to spawn kernel process at {:?}: {}", binary, e);
                    logger.error("FAILED", &binary_str, &err, Some("Check file execution permissions."));
                    diag.status = "FAILED".to_string();
                    diag.error_reason = Some(err.clone());
                    Err(err)
                }
            }
        } else {
            // Check if system python fallback is available with AgenticosHybrid
            let install_path = self.resolve_installation_path(app_handle);
            let hybrid_dir = install_path.join("AgenticosHybrid").join("src");
            let install_str = install_path.to_string_lossy().to_string();

            if hybrid_dir.exists() || Path::new("AgenticosHybrid/src").exists() {
                logger.info(
                    "FALLBACK",
                    &install_str,
                    "Kernel binary not found. Launching Python agentic_os module daemon...",
                );

                let mut cmd = Command::new("python3");
                cmd.args(&["-m", "agentic_os", "serve", "--host", "127.0.0.1", "--port", "8001"]);
                cmd.current_dir(&install_path);
                cmd.env("PYTHONPATH", &hybrid_dir);
                cmd.stdout(Stdio::from(log_file.try_clone().unwrap()));
                cmd.stderr(Stdio::from(log_file));

                match cmd.spawn() {
                    Ok(child) => {
                        let pid = child.id();
                        logger.info(
                            "RUNNING",
                            &install_str,
                            &format!("Python fallback kernel spawned with PID {}", pid),
                        );
                        diag.backend_pid = Some(pid);
                        diag.status = "STARTING".to_string();
                        *self.process.lock().unwrap() = Some(child);
                        self.spawn_child_monitor(pid, install_str, app_handle.cloned());
                        return Ok(pid);
                    }
                    Err(e) => {
                        logger.warn("WARN", &install_str, &format!("Python fallback spawn failed: {}", e), None);
                    }
                }
            }

            let err = "AgenticOS kernel binary not found in installation path, resource directory, or workspace.".to_string();
            logger.error("FAILED", &install_str, &err, None);
            diag.status = "FAILED".to_string();
            diag.error_reason = Some(err.clone());
            Err(err)
        }
    }

    /// Monitors the running child process in the background and reports silent failures
    fn spawn_child_monitor(&self, pid: u32, install_path: String, app_handle: Option<AppHandle>) {
        let process_arc = self.process.clone();
        let diag_arc = self.diagnostics.clone();

        tauri::async_runtime::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_millis(600)).await;

                let mut proc_guard = process_arc.lock().unwrap();
                if let Some(ref mut child) = *proc_guard {
                    if child.id() == pid {
                        match child.try_wait() {
                            Ok(Some(status)) => {
                                let err = format!("Monitored child process (PID {}) exited prematurely with: {:?}", pid, status);
                                Logger::global().error(
                                    "FAILED",
                                    &install_path,
                                    &err,
                                    Some("Silent failure detected in background process."),
                                );

                                let mut diag = diag_arc.lock().unwrap();
                                diag.status = "FAILED".to_string();
                                diag.is_healthy = false;
                                diag.error_reason = Some(err.clone());

                                if let Some(ref app) = app_handle {
                                    use tauri::Emitter;
                                    let _ = app.emit("agenticos://kernel_crashed", &err);
                                }
                                break;
                            }
                            Ok(None) => {
                                // Process is running healthily
                            }
                            Err(e) => {
                                Logger::global().error(
                                    "FAILED",
                                    &install_path,
                                    &format!("Error checking status for child PID {}: {}", pid, e),
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
    }

    /// Stops the kernel process cleanly, terminating child and cleaning up resources on application exit
    pub fn stop_kernel(&self) {
        let mut proc_opt = self.process.lock().unwrap();
        if let Some(mut child) = proc_opt.take() {
            let pid = child.id();
            Logger::global().info("SHUTDOWN", "", &format!("Terminating child process PID {}", pid));
            let _ = child.kill();
            let _ = child.wait();
            Logger::global().info("STOPPED", "", &format!("Child process PID {} terminated and cleaned up successfully.", pid));
        }
        let mut diag = self.diagnostics.lock().unwrap();
        diag.backend_pid = None;
    }

    /// Automated health-check loop that polls 127.0.0.1:8001/healthz and validates the schema
    pub async fn run_health_check_loop(&self, max_seconds: u64) -> bool {
        let health_service = HealthCheckService::new(
            Some("http://127.0.0.1:8001/healthz".to_string()),
            Some(max_seconds),
        );

        let start = Instant::now();
        let timeout = std::time::Duration::from_secs(max_seconds);
        let check_interval = std::time::Duration::from_millis(250);

        while start.elapsed() < timeout {
            // Check if child exited prematurely
            {
                let mut proc_guard = self.process.lock().unwrap();
                if let Some(ref mut child) = *proc_guard {
                    if let Ok(Some(status)) = child.try_wait() {
                        let err = format!("Backend kernel process exited prematurely: {:?}", status);
                        Logger::global().error("FAILED", "", &err, None);
                        let mut diag = self.diagnostics.lock().unwrap();
                        diag.status = "FAILED".to_string();
                        diag.is_healthy = false;
                        diag.error_reason = Some(err);
                        return false;
                    }
                }
            }

            match health_service.check_once().await {
                Ok(payload) => {
                    let elapsed = start.elapsed().as_secs_f64();
                    Logger::global().info(
                        "READY",
                        "http://127.0.0.1:8001/healthz",
                        &format!("Kernel health verified in {:.2}s. Schema validated.", elapsed),
                    );

                    let mut diag = self.diagnostics.lock().unwrap();
                    diag.status = "READY".to_string();
                    diag.is_healthy = true;
                    diag.uptime_seconds = elapsed;
                    diag.error_reason = None;
                    diag.diagnostic_trace = format!(
                        "Backend Kernel verified on port 8001 in {:.2}s.\nService: {}\nPhase: {}\nHealth: {}",
                        elapsed,
                        payload.service.as_deref().unwrap_or("agentic_os.kernel_daemon"),
                        payload.phase.as_deref().unwrap_or("advanced"),
                        payload.health.as_deref().unwrap_or("healthy")
                    );

                    for (k, v) in payload.subsystems {
                        diag.subsystems.insert(k, v);
                    }
                    return true;
                }
                Err(_) => {
                    // Retrying
                }
            }

            tokio::time::sleep(check_interval).await;
        }

        let elapsed = start.elapsed().as_secs_f64();
        let err = format!("Backend health check timed out after {:.1}s on http://127.0.0.1:8001/healthz", elapsed);
        Logger::global().error("FAILED", "http://127.0.0.1:8001/healthz", &err, None);

        let mut diag = self.diagnostics.lock().unwrap();
        diag.status = "FAILED".to_string();
        diag.is_healthy = false;
        diag.uptime_seconds = elapsed;
        diag.error_reason = Some(err.clone());
        diag.diagnostic_trace = format!(
            "Component: Backend Kernel\nStatus: FAILED\nReason: {}\nPID: {:?}\nPort: 8001\nTimeout: {}s\nLog: {}",
            err, diag.backend_pid, max_seconds, diag.log_path
        );

        false
    }

    /// Gets a snapshot of current diagnostics
    pub fn get_diagnostics(&self) -> StartupDiagnostics {
        let mut diag = self.diagnostics.lock().unwrap().clone();
        diag.uptime_seconds = self.start_time.elapsed().as_secs_f64();
        diag.timestamp = crate::logger::chrono_iso_timestamp();
        diag
    }
}

// Helpers
fn get_hostname() -> String {
    #[cfg(windows)]
    {
        std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows-Host".to_string())
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOSTNAME").unwrap_or_else(|_| "localhost".to_string())
    }
}

fn num_cpus_or_default() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
}
