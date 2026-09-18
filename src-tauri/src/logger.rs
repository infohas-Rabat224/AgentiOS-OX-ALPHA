use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

/// Structured Diagnostic Record matching enterprise audit specifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticRecord {
    pub timestamp: String,
    pub level: String,     // "INFO" | "WARN" | "ERROR" | "DEBUG"
    pub status: String,    // "INIT" | "STARTING" | "HEALTHY" | "READY" | "FAILED" | "STOPPED" | "SHUTDOWN"
    pub version: String,   // Application version e.g. "1.0.0-rc10"
    pub os_arch: String,   // OS Architecture e.g. "x86_64"
    pub os: String,        // OS e.g. "windows"
    pub os_version: String,
    pub path: String,      // Installation path or binary path
    pub backend_exit_code: Option<i32>, // Backend process exit code if terminated/crashed
    pub message: String,
    pub details: Option<String>,
}

/// Global Logger instance for thread-safe structured logging to %LOCALAPPDATA%\AgenticOS\logs\startup.log
pub struct Logger {
    log_dir: PathBuf,
    log_file: PathBuf,
    version: String,
    os_name: String,
    os_arch: String,
    lock: Mutex<()>,
}

static LOGGER_INSTANCE: std::sync::OnceLock<Logger> = std::sync::OnceLock::new();

impl Logger {
    /// Resolves %LOCALAPPDATA%\AgenticOS\logs\startup.log on Windows or fallback path
    pub fn resolve_log_dir() -> PathBuf {
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

    /// Initializes or retrieves the global Logger singleton
    pub fn global() -> &'static Logger {
        LOGGER_INSTANCE.get_or_init(|| {
            let log_dir = Self::resolve_log_dir();
            let _ = fs::create_dir_all(&log_dir);
            let log_file = log_dir.join("startup.log");

            let os_name = std::env::consts::OS.to_string();
            let os_arch = std::env::consts::ARCH.to_string();
            let version = env!("CARGO_PKG_VERSION").to_string();

            Logger {
                log_dir,
                log_file,
                version,
                os_name,
                os_arch,
                lock: Mutex::new(()),
            }
        })
    }

    /// Returns the absolute path to startup.log
    pub fn log_path(&self) -> PathBuf {
        self.log_file.clone()
    }

    /// Writes a structured diagnostic entry to startup.log, including application version,
    /// OS architecture, and backend exit codes
    pub fn log_with_exit(
        &self,
        level: &str,
        status: &str,
        path: &str,
        backend_exit_code: Option<i32>,
        message: &str,
        details: Option<&str>,
    ) {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());

        let timestamp = chrono_iso_timestamp();
        let os_family = std::env::consts::FAMILY.to_string();

        let record = DiagnosticRecord {
            timestamp: timestamp.clone(),
            level: level.to_uppercase(),
            status: status.to_uppercase(),
            version: self.version.clone(),
            os_arch: self.os_arch.clone(),
            os: self.os_name.clone(),
            os_version: os_family,
            path: path.to_string(),
            backend_exit_code,
            message: message.to_string(),
            details: details.map(String::from),
        };

        // Ensure parent directory exists
        let _ = fs::create_dir_all(&self.log_dir);

        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&self.log_file) {
            let exit_code_str = match record.backend_exit_code {
                Some(code) => format!("{}", code),
                None => "NONE".to_string(),
            };

            let formatted_line = format!(
                "[{}] [{}] [{}] version=\"{}\" arch=\"{}\" os=\"{}\" exit_code=\"{}\" path=\"{}\" - {}{}\n",
                record.timestamp,
                record.level,
                record.status,
                record.version,
                record.os_arch,
                record.os,
                exit_code_str,
                record.path,
                record.message,
                match &record.details {
                    Some(d) => format!(" | details: {}", d),
                    None => String::new(),
                }
            );

            let _ = file.write_all(formatted_line.as_bytes());
            let _ = file.flush();
        }
    }

    /// Standard log entry (without exit code)
    pub fn log(&self, level: &str, status: &str, path: &str, message: &str, details: Option<&str>) {
        self.log_with_exit(level, status, path, None, message, details);
    }

    /// Convenience: Log INFO entry
    pub fn info(&self, status: &str, path: &str, message: &str) {
        self.log("INFO", status, path, message, None);
    }

    /// Convenience: Log WARNING entry
    pub fn warn(&self, status: &str, path: &str, message: &str, details: Option<&str>) {
        self.log("WARN", status, path, message, details);
    }

    /// Convenience: Log ERROR entry for silent failure visibility
    pub fn error(&self, status: &str, path: &str, message: &str, details: Option<&str>) {
        self.log("ERROR", status, path, message, details);
    }

    /// Convenience: Log backend exit / termination with exit code
    pub fn log_backend_exit(&self, status: &str, path: &str, exit_code: Option<i32>, message: &str) {
        let level = if exit_code == Some(0) || exit_code.is_none() {
            "INFO"
        } else {
            "ERROR"
        };
        self.log_with_exit(
            level,
            status,
            path,
            exit_code,
            message,
            Some("Backend child process lifecycle state change recorded for remote debugging."),
        );
    }

    /// Reads recent lines from startup.log
    pub fn read_recent_logs(&self, max_lines: usize) -> Result<String, String> {
        if !self.log_file.exists() {
            return Ok("No startup.log found yet.".to_string());
        }
        let content = fs::read_to_string(&self.log_file)
            .map_err(|e| format!("Failed to read startup.log: {}", e))?;

        let lines: Vec<&str> = content.lines().collect();
        let start = if lines.len() > max_lines {
            lines.len() - max_lines
        } else {
            0
        };
        Ok(lines[start..].join("\n"))
    }
}

/// Helper function to generate an ISO-8601 formatted timestamp string
pub fn chrono_iso_timestamp() -> String {
    let now = SystemTime::now();
    let duration = now
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let millis = duration.subsec_millis();

    let days = (secs / 86400) as i64;
    let day_secs = (secs % 86400) as u32;

    let hour = day_secs / 3600;
    let minute = (day_secs % 3600) / 60;
    let second = day_secs % 60;

    let (year, month, day) = days_to_ymd(days);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        year, month, day, hour, minute, second, millis
    )
}

fn days_to_ymd(days: i64) -> (i32, u32, u32) {
    let mut d = days + 719468;
    let era = if d >= 0 { d } else { d - 146096 } / 146097;
    let doe = (d - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { y + 1 } else { y };
    (year as i32, month, day)
}
