use crate::logger::Logger;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// Expected schema from 127.0.0.1:8001/healthz
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelHealthPayload {
    pub status: String,
    #[serde(default)]
    pub service: Option<String>,
    #[serde(default)]
    pub phase: Option<String>,
    #[serde(default)]
    pub health: Option<String>,
    #[serde(default)]
    pub uptime_seconds: Option<f64>,
    #[serde(default)]
    pub kernel_port: Option<u16>,
    #[serde(default)]
    pub frontend_port: Option<u16>,
    #[serde(default)]
    pub subsystems: HashMap<String, String>,
}

/// Result of schema validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthValidationResult {
    pub is_valid: bool,
    pub http_code: u16,
    pub latency_ms: u64,
    pub schema: Option<KernelHealthPayload>,
    pub validation_errors: Vec<String>,
    pub raw_response: String,
}

impl KernelHealthPayload {
    /// Strictly validates that the response adheres to AgenticOS Kernel Health Schema
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // 1. Validate status
        let s = self.status.to_lowercase();
        if s != "ok" && s != "healthy" {
            errors.push(format!(
                "Field 'status' expected 'ok' or 'healthy', found '{}'",
                self.status
            ));
        }

        // 2. Validate service / identity identifier
        if self.service.is_none() && self.health.is_none() {
            errors.push("Missing service or health identification in payload".to_string());
        }

        // 3. Validate uptime if provided
        if let Some(uptime) = self.uptime_seconds {
            if uptime < 0.0 {
                errors.push(format!("Field 'uptime_seconds' is negative: {}", uptime));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

pub struct HealthCheckService {
    target_url: String,
    timeout: Duration,
    poll_interval: Duration,
}

impl HealthCheckService {
    pub fn new(target_url: Option<String>, timeout_secs: Option<u64>) -> Self {
        Self {
            target_url: target_url.unwrap_or_else(|| "http://127.0.0.1:8001/healthz".to_string()),
            timeout: Duration::from_secs(timeout_secs.unwrap_or(15)),
            poll_interval: Duration::from_millis(250),
        }
    }

    /// Performs a single HTTP GET request to 127.0.0.1:8001/healthz and validates the schema
    pub async fn check_once(&self) -> Result<KernelHealthPayload, String> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(1500))
            .build()
            .map_err(|e| format!("Failed to create reqwest client: {}", e))?;

        let resp = client
            .get(&self.target_url)
            .send()
            .await
            .map_err(|e| format!("Connection error to {}: {}", self.target_url, e))?;

        let status = resp.status();
        if !status.is_success() {
            return Err(format!("HTTP error {}: {}", status.as_u16(), status));
        }

        let raw_text = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read response body: {}", e))?;

        let payload: KernelHealthPayload = serde_json::from_str(&raw_text)
            .map_err(|e| format!("Response schema JSON deserialization failed: {}", e))?;

        if let Err(errors) = payload.validate() {
            return Err(format!("Schema validation failed: {}", errors.join("; ")));
        }

        Ok(payload)
    }

    /// Automated health-check polling loop that polls 127.0.0.1:8001/healthz,
    /// validates response schema, logs structured diagnostics, and signals the UI
    pub async fn poll_until_ready(
        &self,
        app_handle: &AppHandle,
        installation_path: &str,
    ) -> bool {
        let logger = Logger::global();
        let start_time = Instant::now();
        let mut attempts = 0;

        logger.info(
            "POLLING",
            installation_path,
            &format!(
                "Starting automated health check polling on {} (Timeout: {}s)",
                self.target_url,
                self.timeout.as_secs()
            ),
        );

        while start_time.elapsed() < self.timeout {
            attempts += 1;

            match self.check_once().await {
                Ok(payload) => {
                    let elapsed = start_time.elapsed().as_secs_f64();
                    let msg = format!(
                        "Kernel health verified on {} after {:.2}s (attempts: {}). Service: {}, Health: {}",
                        self.target_url,
                        elapsed,
                        attempts,
                        payload.service.as_deref().unwrap_or("agentic_os.kernel_daemon"),
                        payload.health.as_deref().unwrap_or("healthy")
                    );

                    logger.log(
                        "INFO",
                        "READY",
                        installation_path,
                        &msg,
                        Some(&format!("uptime_seconds: {:?}", payload.uptime_seconds)),
                    );

                    // Signal the UI that the kernel is ready and reveal the window
                    let _ = app_handle.emit("agenticos://startup_ready", &payload);

                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        let _ = main_window.show();
                        let _ = main_window.set_focus();
                    }

                    return true;
                }
                Err(e) => {
                    // Diagnostic trace: log periodically or on first attempt
                    if attempts == 1 || attempts % 10 == 0 {
                        logger.warn(
                            "STARTING",
                            installation_path,
                            &format!("Polling {} attempt {}: {}", self.target_url, attempts, e),
                            None,
                        );
                    }
                }
            }

            tokio::time::sleep(self.poll_interval).await;
        }

        // Timeout reached without valid schema response
        let elapsed = start_time.elapsed().as_secs_f64();
        let failure_reason = format!(
            "Health check timed out after {:.2}s ({} attempts). Response schema at {} was unreachable or invalid.",
            elapsed, attempts, self.target_url
        );

        logger.error(
            "FAILED",
            installation_path,
            &failure_reason,
            Some("Ensure port 8001 is free and agenticos-kernel binary has execution permissions."),
        );

        // Signal UI with failure payload
        let mut fail_subsystems = HashMap::new();
        fail_subsystems.insert("container".to_string(), "offline".to_string());
        fail_subsystems.insert("lifecycle".to_string(), "failed".to_string());
        fail_subsystems.insert("omniroute".to_string(), "offline".to_string());

        let failure_payload = KernelHealthPayload {
            status: "failed".to_string(),
            service: Some("agentic_os.kernel_daemon".to_string()),
            phase: Some("startup_timeout".to_string()),
            health: Some("unhealthy".to_string()),
            uptime_seconds: Some(0.0),
            kernel_port: Some(8001),
            frontend_port: Some(3000),
            subsystems: fail_subsystems,
        };

        let _ = app_handle.emit("agenticos://startup_failed", &failure_payload);

        // Ensure window is visible so user sees forensic diagnostic panel
        if let Some(main_window) = app_handle.get_webview_window("main") {
            let _ = main_window.show();
        }

        false
    }
}
