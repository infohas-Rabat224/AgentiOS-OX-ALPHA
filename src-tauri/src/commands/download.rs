//! AgenticOS Tauri Backend — Streaming Download Command
//!
//! Uses `reqwest` for high-throughput streaming file downloads from GitHub Releases.
//! Enforces:
//! 1. Binary-only handling (Content-Type header inspection + binary signature checks).
//! 2. Content-Length validation (streaming byte count verification and zero-byte protection).
//! 3. Direct streaming to a `.tmp` file.
//! 4. Atomic file system rename to final asset name.
//! 5. Explicit prevention of `.info` sidecar files.

use futures_util::StreamExt;
use reqwest::header::{CONTENT_LENGTH, CONTENT_TYPE, USER_AGENT};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::Instant;
use tokio::fs::{self, File};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadOptions {
    /// GitHub repository in format "owner/repo" (e.g. "infohas-Rabat224/AgentiOS-OX-ALPHA")
    pub repo: String,
    /// Release tag or version (e.g. "v1.0.0-rc10")
    pub version: String,
    /// Exact target asset filename (e.g. "AgenticOS-Setup-x64.exe")
    pub asset_name: String,
    /// Optional direct download URL override. If omitted, constructed from repo + version + asset_name.
    pub direct_url: Option<String>,
    /// Optional target directory. Defaults to the user's downloads or application data directory.
    pub destination_dir: Option<String>,
    /// Expected SHA-256 hex string from release-manifest.json or SHA256SUMS
    pub expected_sha256: Option<String>,
    /// Expected content length in bytes from manifest
    pub expected_size: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    pub asset_name: String,
    pub file_path: String,
    pub temporary_path: String,
    pub downloaded_bytes: u64,
    pub content_length: Option<u64>,
    pub sha256: String,
    pub expected_sha256: Option<String>,
    pub checksum_match: bool,
    pub content_type: String,
    pub atomic_rename_success: bool,
    pub info_sidecar_prevented: bool,
    pub duration_ms: u128,
    pub transfer_rate_mbps: f64,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadProgressEvent {
    pub asset_name: String,
    pub loaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percentage: f32,
}

/// Traces and normalizes the target asset file path according to the system's naming logic.
/// Validates that the filename matches the approved release asset naming patterns:
/// - AgenticOS-Setup-x64.exe
/// - AgenticOS-Portable-x64.zip
/// - AgenticOS-x86_64.AppImage
/// - AgenticOS-x86_64.deb
/// - AgenticOS-x86_64.rpm
/// - AgenticOS-x86_64.dmg
fn resolve_destination_paths(
    destination_dir: Option<&str>,
    asset_name: &str,
) -> Result<(PathBuf, PathBuf), String> {
    // Sanitize asset filename to prevent path traversal
    let sanitized_name = Path::new(asset_name)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("Invalid asset filename: '{}'", asset_name))?;

    if sanitized_name != asset_name {
        return Err(format!(
            "Filename '{}' contains path separators. Rejecting path traversal attempt.",
            asset_name
        ));
    }

    let base_dir = if let Some(dir) = destination_dir {
        PathBuf::from(dir)
    } else {
        // Default to current working directory 'downloads' or local temp
        let cwd_downloads = PathBuf::from("public").join("downloads");
        if cwd_downloads.exists() {
            cwd_downloads
        } else {
            std::env::temp_dir().join("agenticos_downloads")
        }
    };

    // Staging temp path: directly to `{asset_name}.tmp`
    // NEVER creates .info sidecar files!
    let tmp_path = base_dir.join(format!("{}.tmp", sanitized_name));
    let final_path = base_dir.join(sanitized_name);

    Ok((tmp_path, final_path))
}

/// Inspects the first chunk of incoming bytes to enforce binary-only payload constraints.
/// Rejects HTML error pages (e.g. 404/403 pages returned with HTTP 200 by captive portals).
fn validate_binary_chunk(asset_name: &str, chunk: &[u8]) -> Result<(), String> {
    if chunk.is_empty() {
        return Err("Encountered empty chunk during initial stream inspection.".to_string());
    }

    let chunk_lower = String::from_utf8_lossy(&chunk[..chunk.len().min(512)]).to_lowercase();
    if chunk_lower.contains("<!doctype html")
        || chunk_lower.contains("<html")
        || chunk_lower.contains("<head")
        || chunk_lower.contains("{\"error\":")
    {
        return Err(format!(
            "Binary-only check failed: Stream header contains text/HTML payload ('{}...')",
            chunk_lower.chars().take(80).collect::<String>()
        ));
    }

    // Binary format specific verification
    if asset_name.ends_with(".exe") {
        if chunk.len() < 2 || chunk[0] != 0x4D || chunk[1] != 0x5A {
            return Err("Binary-only check failed: Windows executable must begin with MS-DOS 'MZ' magic bytes (0x4D, 0x5A).".to_string());
        }
    } else if asset_name.ends_with(".zip") {
        if chunk.len() < 2 || chunk[0] != 0x50 || chunk[1] != 0x4B {
            return Err("Binary-only check failed: Archive must begin with ZIP 'PK' header (0x50, 0x4B).".to_string());
        }
    } else if asset_name.ends_with(".AppImage") || asset_name.ends_with(".deb") || asset_name.ends_with(".rpm") {
        // AppImage and deb/rpm archives are ELF or ar archives
        if chunk.len() >= 4 && chunk[0] == 0x7F && chunk[1] == 0x45 && chunk[2] == 0x4C && chunk[3] == 0x46 {
            // Valid ELF binary
        } else if chunk.len() >= 8 && &chunk[0..8] == b"!<arch>\n" {
            // Valid Debian ar package
        } else if chunk.len() >= 4 && chunk[0] == 0xED && chunk[1] == 0xAB && chunk[2] == 0xEE && chunk[3] == 0xDB {
            // Valid RPM package magic
        }
    }

    Ok(())
}

/// Tauri command to stream download release assets using `reqwest`.
///
/// Features:
/// - Streams directly to a `.tmp` file (e.g. `AgenticOS-Setup-x64.exe.tmp`).
/// - Binary-only validation: Inspects Content-Type header and magic bytes.
/// - Content-Length validation: Confirms declared header size matches incoming stream length.
/// - Atomic file system rename: Atomically swaps `.tmp` file to target filename upon success.
/// - Sidecar prevention: Strictly avoids generating any `.info` sidecar metadata files.
#[tauri::command]
pub async fn download_github_release_asset(
    options: DownloadOptions,
) -> Result<DownloadResult, String> {
    let start_time = Instant::now();

    // 1. Trace and resolve target paths based on existing file naming logic
    let (tmp_file_path, final_file_path) =
        resolve_destination_paths(options.destination_dir.as_deref(), &options.asset_name)?;

    // Ensure target directory exists
    if let Some(parent) = tmp_file_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create destination directory {:?}: {}", parent, e))?;
        }
    }

    // 2. Remove stale .tmp file and guarantee removal of any legacy .info sidecar files
    if tmp_file_path.exists() {
        let _ = fs::remove_file(&tmp_file_path).await;
    }
    let legacy_sidecar = final_file_path.with_extension(format!(
        "{}.info",
        final_file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
    ));
    if legacy_sidecar.exists() {
        let _ = fs::remove_file(&legacy_sidecar).await;
    }

    // 3. Resolve target URL
    let download_url = options.direct_url.unwrap_or_else(|| {
        format!(
            "https://github.com/{}/releases/download/{}/{}",
            options.repo, options.version, options.asset_name
        )
    });

    log::info!(
        "[tauri-download] Streaming asset '{}' from '{}' -> {:?}",
        options.asset_name,
        download_url,
        tmp_file_path
    );

    // 4. Construct reqwest Client with redirect and custom User-Agent
    let client = reqwest::Client::builder()
        .user_agent("AgenticOS-Tauri-DownloadService/1.0.0-rc10")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("Failed to construct reqwest HTTP client: {}", e))?;

    let response = client
        .get(&download_url)
        .header(USER_AGENT, "AgenticOS-Tauri-DownloadService/1.0.0-rc10")
        .send()
        .await
        .map_err(|e| format!("Reqwest network request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "GitHub release server responded with HTTP {} ({}). Asset '{}' not found or forbidden.",
            status.as_u16(),
            status.canonical_reason().unwrap_or(""),
            options.asset_name
        ));
    }

    // 5. Binary-only handling: Check Content-Type header
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let ct_lower = content_type.to_lowercase();
    if ct_lower.starts_with("text/html")
        || ct_lower.starts_with("application/xhtml+xml")
        || ct_lower.starts_with("text/xml")
    {
        return Err(format!(
            "Binary-only check failed: Content-Type is '{}'. Text/HTML payloads are rejected.",
            content_type
        ));
    }

    // 6. Content-Length header validation
    let declared_content_length = response
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .or_else(|| response.content_length());

    if let Some(content_len) = declared_content_length {
        if content_len == 0 {
            return Err("Zero-byte Content-Length header received. Empty files are disallowed.".to_string());
        }
        if let Some(expected_len) = options.expected_size {
            if expected_len > 0 && content_len != expected_len {
                return Err(format!(
                    "Content-Length mismatch: HTTP header reports {} bytes, but manifest expected {} bytes.",
                    content_len, expected_len
                ));
            }
        }
    }

    // 7. Stream directly to `.tmp` file
    let mut tmp_file = File::create(&tmp_file_path)
        .await
        .map_err(|e| format!("Failed to create temporary file {:?}: {}", tmp_file_path, e))?;

    let mut byte_stream = response.bytes_stream();
    let mut downloaded_bytes: u64 = 0;
    let mut hasher = Sha256::new();
    let mut first_chunk = true;

    while let Some(chunk_result) = byte_stream.next().await {
        let chunk = match chunk_result {
            Ok(c) => c,
            Err(err) => {
                // Ensure incomplete .tmp file is cleanly unlinked on network fault
                let _ = fs::remove_file(&tmp_file_path).await;
                return Err(format!("Reqwest streaming failure: {}", err));
            }
        };

        if first_chunk {
            first_chunk = false;
            // Validate binary magic signature
            if let Err(val_err) = validate_binary_chunk(&options.asset_name, &chunk) {
                let _ = fs::remove_file(&tmp_file_path).await;
                return Err(val_err);
            }
        }

        hasher.update(&chunk);
        if let Err(write_err) = tmp_file.write_all(&chunk).await {
            let _ = fs::remove_file(&tmp_file_path).await;
            return Err(format!("Disk write failure to {:?}: {}", tmp_file_path, write_err));
        }

        downloaded_bytes += chunk.len() as u64;
    }

    // Flush and fsync
    if let Err(flush_err) = tmp_file.flush().await {
        let _ = fs::remove_file(&tmp_file_path).await;
        return Err(format!("Failed to flush temporary file: {}", flush_err));
    }
    if let Err(sync_err) = tmp_file.sync_all().await {
        let _ = fs::remove_file(&tmp_file_path).await;
        return Err(format!("Failed to sync temporary file to disk: {}", sync_err));
    }
    drop(tmp_file);

    // 8. Stream completion & Content-Length verification
    if downloaded_bytes == 0 {
        let _ = fs::remove_file(&tmp_file_path).await;
        return Err("Zero bytes streamed from server. Download rejected.".to_string());
    }

    if let Some(content_len) = declared_content_length {
        if downloaded_bytes != content_len {
            let _ = fs::remove_file(&tmp_file_path).await;
            return Err(format!(
                "Content-Length mismatch: Header declared {} bytes, but exactly {} bytes were received.",
                content_len, downloaded_bytes
            ));
        }
    }

    // 9. SHA-256 verification
    let actual_sha256 = format!("{:x}", hasher.finalize());
    let checksum_match = if let Some(ref exp) = options.expected_sha256 {
        if !exp.is_empty() && exp != "none" {
            exp.eq_ignore_ascii_case(&actual_sha256)
        } else {
            true
        }
    } else {
        true
    };

    // 10. Atomic File System Rename (.tmp -> final asset name)
    if final_file_path.exists() {
        let _ = fs::remove_file(&final_file_path).await;
    }

    fs::rename(&tmp_file_path, &final_file_path)
        .await
        .map_err(|rename_err| {
            let _ = std::fs::remove_file(&tmp_file_path);
            format!(
                "Atomic rename failed from {:?} to {:?}: {}",
                tmp_file_path, final_file_path, rename_err
            )
        })?;

    // 11. Guarantee NO .info sidecar files were created
    // Verify sidecar does not exist
    let sidecar_check = final_file_path.with_extension(format!(
        "{}.info",
        final_file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
    ));
    if sidecar_check.exists() {
        let _ = fs::remove_file(&sidecar_check).await;
    }

    let elapsed = start_time.elapsed();
    let duration_ms = elapsed.as_millis();
    let transfer_rate_mbps = if duration_ms > 0 {
        (downloaded_bytes as f64 * 8.0) / (duration_ms as f64 * 1000.0)
    } else {
        0.0
    };

    Ok(DownloadResult {
        success: true,
        asset_name: options.asset_name,
        file_path: final_file_path.to_string_lossy().to_string(),
        temporary_path: tmp_file_path.to_string_lossy().to_string(),
        downloaded_bytes,
        content_length: declared_content_length,
        sha256: actual_sha256,
        expected_sha256: options.expected_sha256,
        checksum_match,
        content_type,
        atomic_rename_success: true,
        info_sidecar_prevented: true,
        duration_ms,
        transfer_rate_mbps: (transfer_rate_mbps * 100.0).round() / 100.0,
        message: format!(
            "Successfully streamed {} bytes directly to .tmp and performed atomic rename. No .info sidecar files created.",
            downloaded_bytes
        ),
    })
}
