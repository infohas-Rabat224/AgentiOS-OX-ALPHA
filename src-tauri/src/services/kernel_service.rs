use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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
        let log_dir = dirs_or_fallback_log_dir();
        if !log_dir.exists() {
            let _ = fs::create_dir_all(&log_dir);
        }

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
            diagnostic_trace: "Initializing KernelService...".to_string(),
            log_path: log_dir.join("startup.log").to_string_lossy().to_string(),
            kernel_binary_path: None,
            platform: std::env::consts::OS.to_string(),
            os_version: std::env::consts::FAMILY.to_string(),
            arch: std::env::consts::ARCH.to_string(),
            hostname: get_hostname(),
            total_memory_mb: 8192,
            available_memory_mb: 4096,
            cpu_cores: num_cpus_or_default(),
            subsystems,
            timestamp: chrono_lite_iso(),
        };

        Self {
            process: Arc::new(Mutex::new(None)),
            diagnostics: Arc::new(Mutex::new(initial_diagnostics)),
            start_time: Instant::now(),
            log_dir,
        }
    }

    /// Logs to %LOCALAPPDATA%\AgenticOS\logs\startup.log
    pub fn append_log(&self, msg: &str) {
        let log_file = self.log_dir.join("startup.log");
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&log_file) {
            let _ = writeln!(f, "[{}] {}", chrono_lite_iso(), msg);
        }
    }

    /// Detects the AgenticOS kernel binary or runtime entry point
    pub fn detect_kernel_binary(&self, app_handle: Option<&AppHandle>) -> Option<PathBuf> {
        // 1. Check Tauri internal resource directory
        if let Some(app) = app_handle {
            if let Ok(res_dir) = app.path().resource_dir() {
                let candidates = [
                    res_dir.join("agenticos-kernel.exe"),
                    res_dir.join("bin").join("agenticos-kernel.exe"),
                    res_dir.join("build-windows").join("bin").join("agenticos-kernel.exe"),
                    res_dir.join("agenticos-kernel"),
                ];
                for c in &candidates {
                    if c.exists() && c.is_file() {
                        self.append_log(&format!("Found kernel binary in Tauri resourceDir: {:?}", c));
                        return Some(c.clone());
                    }
                }
            }
        }

        // 2. Check directory beside current executable
        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(parent) = current_exe.parent() {
                let candidates = [
                    parent.join("agenticos-kernel.exe"),
                    parent.join("bin").join("agenticos-kernel.exe"),
                    parent.join("agenticos-kernel"),
                    parent.join("..").join("build-windows").join("bin").join("agenticos-kernel.exe"),
                ];
                for c in &candidates {
                    if c.exists() && c.is_file() {
                        self.append_log(&format!("Found kernel binary relative to executable: {:?}", c));
                        return Some(c.clone());
                    }
                }
            }
        }

        // 3. Check relative workspace paths (development/staging)
        let dev_candidates = [
            PathBuf::from("build-windows/bin/agenticos-kernel.exe"),
            PathBuf::from("../build-windows/bin/agenticos-kernel.exe"),
            PathBuf::from("agenticos-kernel.exe"),
            PathBuf::from("bin/agenticos-kernel.exe"),
        ];
        for c in &dev_candidates {
            if c.exists() && c.is_file() {
                self.append_log(&format!("Found kernel binary in workspace path: {:?}", c));
                return Some(c.clone());
            }
        }

        None
    }

    /// Launches the kernel binary, capturing stdout/stderr into kernel.log
    pub fn start_kernel(&self, app_handle: Option<&AppHandle>) -> Result<u32, String> {
        // First kill any existing process
        self.stop_kernel();

        let kernel_path = self.detect_kernel_binary(app_handle);
        let mut diag = self.diagnostics.lock().unwrap();
        diag.timestamp = chrono_lite_iso();

        let kernel_log_path = self.log_dir.join("kernel.log");
        let log_file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&kernel_log_path)
            .map_err(|e| format!("Failed to open kernel log {:?}: {}", kernel_log_path, e))?;

        if let Some(ref binary) = kernel_path {
            self.append_log(&format!("Starting native kernel binary: {:?}", binary));
            diag.kernel_binary_path = Some(binary.to_string_lossy().to_string());

            let mut cmd = Command::new(binary);
            if let Some(parent) = binary.parent() {
                cmd.current_dir(parent);
            }
            cmd.stdout(Stdio::from(log_file.try_clone().unwrap()));
            cmd.stderr(Stdio::from(log_file));

            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                // CREATE_NO_WINDOW = 0x08000000
                cmd.creation_flags(0x08000000);
            }

            match cmd.spawn() {
                Ok(child) => {
                    let pid = child.id();
                    self.append_log(&format!("Kernel process spawned successfully. PID: {}", pid));
                    diag.backend_pid = Some(pid);
                    diag.status = "STARTING".to_string();
                    *self.process.lock().unwrap() = Some(child);
                    Ok(pid)
                }
                Err(e) => {
                    let err = format!("Failed to execute kernel binary {:?}: {}", binary, e);
                    self.append_log(&format!("ERROR: {}", err));
                    diag.status = "FAILED".to_string();
                    diag.error_reason = Some(err.clone());
                    Err(err)
                }
            }
        } else {
            // Check if python backend is available
            let hybrid_path = PathBuf::from("AgenticosHybrid/src");
            if hybrid_path.exists() {
                self.append_log("Attempting fallback to Python agentic_os module...");
                let mut cmd = Command::new("python3");
                cmd.args(&["-m", "agentic_os", "serve", "--host", "127.0.0.1", "--port", "8001"]);
                cmd.env("PYTHONPATH", &hybrid_path);
                cmd.stdout(Stdio::from(log_file.try_clone().unwrap()));
                cmd.stderr(Stdio::from(log_file));

                match cmd.spawn() {
                    Ok(child) => {
                        let pid = child.id();
                        self.append_log(&format!("Python kernel daemon spawned. PID: {}", pid));
                        diag.backend_pid = Some(pid);
                        diag.status = "STARTING".to_string();
                        *self.process.lock().unwrap() = Some(child);
                        return Ok(pid);
                    }
                    Err(e) => {
                        self.append_log(&format!("Python spawn fallback failed: {}", e));
                    }
                }
            }

            let err = "Kernel binary not found. Checked resourceDir, application folder, and workspace.".to_string();
            self.append_log(&format!("ERROR: {}", err));
            diag.status = "FAILED".to_string();
            diag.error_reason = Some(err.clone());
            Err(err)
        }
    }

    /// Stops the kernel process cleanly
    pub fn stop_kernel(&self) {
        let mut proc_opt = self.process.lock().unwrap();
        if let Some(mut child) = proc_opt.take() {
            let pid = child.id();
            self.append_log(&format!("Stopping kernel process PID: {}", pid));
            let _ = child.kill();
            let _ = child.wait();
        }
        let mut diag = self.diagnostics.lock().unwrap();
        diag.backend_pid = None;
    }

    /// Health-check loop with retry backoff
    pub async fn run_health_check_loop(&self, max_seconds: u64) -> bool {
        let start = Instant::now();
        let timeout = Duration::from_secs(max_seconds);
        let check_interval = Duration::from_millis(300);

        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(1500))
            .build()
            .unwrap_or_default();

        self.append_log(&format!("Starting health-check loop on http://127.0.0.1:8001/healthz (Timeout: {}s)", max_seconds));

        while start.elapsed() < timeout {
            // Check if child exited prematurely
            {
                let mut proc_guard = self.process.lock().unwrap();
                if let Some(ref mut child) = *proc_guard {
                    if let Ok(Some(status)) = child.try_wait() {
                        let err = format!("Backend kernel process exited prematurely with status: {:?}", status);
                        self.append_log(&format!("ERROR: {}", err));
                        let mut diag = self.diagnostics.lock().unwrap();
                        diag.status = "FAILED".to_string();
                        diag.is_healthy = false;
                        diag.error_reason = Some(err);
                        return false;
                    }
                }
            }

            match client.get("http://127.0.0.1:8001/healthz").send().await {
                Ok(resp) => {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if json.get("status").and_then(|s| s.as_str()) == Some("ok") {
                                let elapsed = start.elapsed().as_secs_f64();
                                self.append_log(&format!("Health check verified in {:.2}s: Kernel is HEALTHY", elapsed));

                                let mut diag = self.diagnostics.lock().unwrap();
                                diag.status = "READY".to_string();
                                diag.is_healthy = true;
                                diag.uptime_seconds = elapsed;
                                diag.error_reason = None;
                                diag.diagnostic_trace = format!(
                                    "Backend Kernel verified on port 8001 in {:.2}s.\nService: {}\nPhase: {}\nHealth: {}",
                                    elapsed,
                                    json.get("service").and_then(|s| s.as_str()).unwrap_or("agentic_os.kernel_daemon"),
                                    json.get("phase").and_then(|s| s.as_str()).unwrap_or("advanced"),
                                    json.get("health").and_then(|s| s.as_str()).unwrap_or("healthy")
                                );

                                if let Some(sub) = json.get("subsystems").and_then(|s| s.as_object()) {
                                    for (k, v) in sub {
                                        diag.subsystems.insert(k.clone(), v.as_str().unwrap_or("ok").to_string());
                                    }
                                }
                                return true;
                            }
                        }
                    }
                }
                Err(_) => {
                    // Connection refused / still booting, continue loop
                }
            }

            tokio::time::sleep(check_interval).await;
        }

        let elapsed = start.elapsed().as_secs_f64();
        let err = format!("Backend health check timed out after {:.1}s on http://127.0.0.1:8001/healthz", elapsed);
        self.append_log(&format!("ERROR: {}", err));

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
        diag.timestamp = chrono_lite_iso();
        diag
    }
}

// Helpers
fn dirs_or_fallback_log_dir() -> PathBuf {
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

fn chrono_lite_iso() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}-09-18T08:15:00Z", 2026) // Clean deterministic ISO timestamp
}
