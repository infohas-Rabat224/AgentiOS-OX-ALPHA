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
    pub version: String,   // e.g. "1.0.0-rc10"
    pub os: String,        // e.g. "windows-x86_64" or "linux-x86_64"
    pub os_version: String,
    pub path: String,      // Installation path or binary path
    pub message: String,
    pub details: Option<String>,
}

/// Global Logger instance for thread-safe structured logging to %LOCALAPPDATA%\AgenticOS\logs\startup.log
pub struct Logger {
    log_dir: PathBuf,
    log_file: PathBuf,
    version: String,
    os_info: String,
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

            let os = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);
            let version = env!("CARGO_PKG_VERSION").to_string();

            Logger {
                log_dir,
                log_file,
                version,
                os_info: os,
                lock: Mutex::new(()),
            }
        })
    }

    /// Returns the absolute path to startup.log
    pub fn log_path(&self) -> PathBuf {
        self.log_file.clone()
    }

    /// Writes a structured diagnostic entry to startup.log
    pub fn log(&self, level: &str, status: &str, path: &str, message: &str, details: Option<&str>) {
        let _guard = self.lock.lock().unwrap_or_else(|e| e.into_inner());

        let timestamp = chrono_iso_timestamp();
        let os_family = std::env::consts::FAMILY.to_string();

        let record = DiagnosticRecord {
            timestamp: timestamp.clone(),
            level: level.to_uppercase(),
            status: status.to_uppercase(),
            version: self.version.clone(),
            os: self.os_info.clone(),
            os_version: os_family,
            path: path.to_string(),
            message: message.to_string(),
            details: details.map(String::from),
        };

        // Ensure parent directory exists
        let _ = fs::create_dir_all(&self.log_dir);

        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&self.log_file) {
            // Write formatted structured line for readability and automated parser ingestion
            let formatted_line = format!(
                "[{}] [{}] [{}] version=\"{}\" os=\"{}\" path=\"{}\" - {}{}\n",
                record.timestamp,
                record.level,
                record.status,
                record.version,
                record.os,
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

    /// Reads recent lines from startup.log
    pub fn read_recent_logs(&self, max_lines: usize) -> Result<String, String> {
        if !self.log_file.exists() {
            return Ok("No startup.log found yet.".to_string());
        }
        let content = fs::read_to_string(&self.log_file)
            .map_err(|e| format!("Failed to read startup log: {}", e))?;
        
        let lines: Vec<&str> = content.lines().collect();
        if lines.len() <= max_lines {
            Ok(content)
        } else {
            let start = lines.len() - max_lines;
            Ok(lines[start..].join("\n"))
        }
    }
}

/// Helper function to generate an ISO 8601 timestamp
pub fn chrono_iso_timestamp() -> String {
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let total_secs = now.as_secs();
    
    // Convert to UTC components
    let seconds = total_secs % 60;
    let total_minutes = total_secs / 60;
    let minutes = total_minutes % 60;
    let total_hours = total_minutes / 60;
    let hours = total_hours % 24;
    let days_since_epoch = total_hours / 24;

    // Estimate date from days since Unix epoch (Jan 1, 1970)
    let (year, month, day) = days_to_ymd(days_since_epoch);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hours, minutes, seconds
    )
}

fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Gregorian calendar leap year calculation
    let mut d = days;
    let mut year = 1970;
    loop {
        let leap = is_leap_year(year);
        let days_in_year = if leap { 366 } else { 365 };
        if d < days_in_year {
            break;
        }
        d -= days_in_year;
        year += 1;
    }
    let leap = is_leap_year(year);
    let month_days = [
        31, if leap { 29 } else { 28 }, 31, 30, 31, 30,
        31, 31, 30, 31, 30, 31,
    ];
    let mut month = 1;
    for &md in &month_days {
        if d < md {
            break;
        }
        d -= md;
        month += 1;
    }
    let day = d + 1;
    (year, month, day)
}

fn is_leap_year(y: u64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
}
