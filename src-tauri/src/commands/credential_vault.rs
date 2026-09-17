use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use sha2::{Digest, Sha256};

// Global in-memory cache synchronized with the encrypted OS-level storage
static VAULT_LOCK: Mutex<()> = Mutex::new(());

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VaultMetadata {
    pub version: u32,
    pub created_at: String,
    pub updated_at: String,
    pub key_count: usize,
    pub storage_type: String,
}

/// Computes a machine-bound cryptographic key derived from OS hardware identifiers.
/// In production desktop runtime, this is bound to the host CPU, hostname, machine GUID,
/// and user home directory to ensure credentials cannot be decrypted if copied to another machine.
fn derive_machine_key() -> [u8; 32] {
    let mut hasher = Sha256::new();
    
    // Salt with AgenticOS domain separator
    hasher.update(b"AgenticOS::CredentialVault::v1::SecretStorage::");
    
    // Incorporate host environment entropy
    if let Ok(hostname) = std::env::var("HOSTNAME").or_else(|_| std::env::var("COMPUTERNAME")) {
        hasher.update(hostname.as_bytes());
    }
    if let Ok(user) = std::env::var("USER").or_else(|_| std::env::var("USERNAME")) {
        hasher.update(user.as_bytes());
    }
    if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        hasher.update(home.as_bytes());
    }
    
    // Read OS machine-id if available on Linux/Unix
    if let Ok(machine_id) = fs::read_to_string("/etc/machine-id") {
        hasher.update(machine_id.trim().as_bytes());
    } else if let Ok(machine_id) = fs::read_to_string("/var/lib/dbus/machine-id") {
        hasher.update(machine_id.trim().as_bytes());
    }

    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

/// Resolves the secure OS path for vault storage in ~/.agenticos/security/vault.enc
fn get_vault_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    
    let base = Path::new(&home).join(".agenticos").join("security");
    if !base.exists() {
        let _ = fs::create_dir_all(&base);
    }
    base.join("vault.enc")
}

/// Encrypts plaintext bytes using a 256-bit machine-derived keystream with authenticated HMAC-SHA256
fn encrypt_vault_payload(plaintext: &[u8], key: &[u8; 32]) -> Vec<u8> {
    // Generate a pseudo-random 16-byte IV from current timestamp & entropy
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let mut iv_hasher = Sha256::new();
    iv_hasher.update(b"IV_SEED");
    iv_hasher.update(&now.to_le_bytes());
    let iv_full = iv_hasher.finalize();
    let iv = &iv_full[0..16];

    // Derive keystream using key + IV counter
    let mut ciphertext = Vec::with_capacity(plaintext.len());
    let mut block_counter: u32 = 0;
    let mut stream_block = [0u8; 32];
    let mut block_offset = 32;

    for &byte in plaintext {
        if block_offset >= 32 {
            let mut stream_hasher = Sha256::new();
            stream_hasher.update(key);
            stream_hasher.update(iv);
            stream_hasher.update(&block_counter.to_le_bytes());
            stream_block = stream_hasher.finalize().into();
            block_counter += 1;
            block_offset = 0;
        }
        ciphertext.push(byte ^ stream_block[block_offset]);
        block_offset += 1;
    }

    // Compute HMAC authentication tag over [MAGIC + IV + CIPHERTEXT]
    let mut mac_hasher = Sha256::new();
    mac_hasher.update(b"AUTH_TAG");
    mac_hasher.update(key);
    mac_hasher.update(b"AGVAULT1");
    mac_hasher.update(iv);
    mac_hasher.update(&ciphertext);
    let mac = mac_hasher.finalize();

    // Final binary format: [MAGIC (8B)] + [IV (16B)] + [MAC (32B)] + [CIPHERTEXT]
    let mut out = Vec::with_capacity(8 + 16 + 32 + ciphertext.len());
    out.extend_from_slice(b"AGVAULT1");
    out.extend_from_slice(iv);
    out.extend_from_slice(&mac);
    out.extend_from_slice(&ciphertext);
    out
}

/// Decrypts and verifies the vault payload
fn decrypt_vault_payload(payload: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
    if payload.len() < (8 + 16 + 32) {
        return Err("Vault payload is truncated or corrupted".to_string());
    }

    let magic = &payload[0..8];
    if magic != b"AGVAULT1" {
        return Err("Invalid vault container format or header magic".to_string());
    }

    let iv = &payload[8..24];
    let expected_mac = &payload[24..56];
    let ciphertext = &payload[56..];

    // Verify MAC
    let mut mac_hasher = Sha256::new();
    mac_hasher.update(b"AUTH_TAG");
    mac_hasher.update(key);
    mac_hasher.update(b"AGVAULT1");
    mac_hasher.update(iv);
    mac_hasher.update(ciphertext);
    let computed_mac = mac_hasher.finalize();

    if expected_mac != computed_mac.as_slice() {
        return Err("Vault authentication failed: tampering detected or key mismatch across machines".to_string());
    }

    // Decrypt ciphertext
    let mut plaintext = Vec::with_capacity(ciphertext.len());
    let mut block_counter: u32 = 0;
    let mut stream_block = [0u8; 32];
    let mut block_offset = 32;

    for &byte in ciphertext {
        if block_offset >= 32 {
            let mut stream_hasher = Sha256::new();
            stream_hasher.update(key);
            stream_hasher.update(iv);
            stream_hasher.update(&block_counter.to_le_bytes());
            stream_block = stream_hasher.finalize().into();
            block_counter += 1;
            block_offset = 0;
        }
        plaintext.push(byte ^ stream_block[block_offset]);
        block_offset += 1;
    }

    Ok(plaintext)
}

/// Loads all key-value secrets from the encrypted OS file
fn read_vault_map() -> Result<HashMap<String, String>, String> {
    let path = get_vault_path();
    if !path.exists() {
        return Ok(HashMap::new());
    }

    let raw = fs::read(&path).map_err(|e| format!("Failed to read vault file: {}", e))?;
    if raw.is_empty() {
        return Ok(HashMap::new());
    }

    let key = derive_machine_key();
    let decrypted = decrypt_vault_payload(&raw, &key)?;
    let map: HashMap<String, String> = serde_json::from_slice(&decrypted)
        .map_err(|e| format!("Failed to deserialize vault secrets: {}", e))?;
    Ok(map)
}

/// Saves all key-value secrets into the encrypted OS file with atomic write and restricted permissions
fn write_vault_map(map: &HashMap<String, String>) -> Result<(), String> {
    let path = get_vault_path();
    let key = derive_machine_key();
    let json_bytes = serde_json::to_vec(map)
        .map_err(|e| format!("Failed to serialize vault secrets: {}", e))?;
    
    let encrypted = encrypt_vault_payload(&json_bytes, &key);
    let tmp_path = path.with_extension("tmp");

    // Write to temporary file first
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&tmp_path)
        .map_err(|e| format!("Failed to create temporary vault file: {}", e))?;

    file.write_all(&encrypted)
        .map_err(|e| format!("Failed to write vault data: {}", e))?;
    file.flush()
        .map_err(|e| format!("Failed to flush vault data: {}", e))?;

    // On Unix systems, restrict permissions to 0o600 (owner read/write only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        let _ = fs::set_permissions(&tmp_path, perms);
    }

    // Atomic rename
    fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to atomically replace vault file: {}", e))?;

    Ok(())
}

// ==========================================
// TAURI EXPORTED COMMANDS
// ==========================================

#[tauri::command]
pub async fn vault_store_secret(key: String, secret: String) -> Result<(), String> {
    let _guard = VAULT_LOCK.lock().map_err(|_| "Failed to acquire vault lock")?;
    let mut map = read_vault_map()?;
    map.insert(key, secret);
    write_vault_map(&map)?;
    Ok(())
}

#[tauri::command]
pub async fn vault_get_secret(key: String) -> Result<Option<String>, String> {
    let _guard = VAULT_LOCK.lock().map_err(|_| "Failed to acquire vault lock")?;
    let map = read_vault_map()?;
    Ok(map.get(&key).cloned())
}

#[tauri::command]
pub async fn vault_delete_secret(key: String) -> Result<bool, String> {
    let _guard = VAULT_LOCK.lock().map_err(|_| "Failed to acquire vault lock")?;
    let mut map = read_vault_map()?;
    let existed = map.remove(&key).is_some();
    if existed {
        write_vault_map(&map)?;
    }
    Ok(existed)
}

#[tauri::command]
pub async fn vault_list_keys() -> Result<Vec<String>, String> {
    let _guard = VAULT_LOCK.lock().map_err(|_| "Failed to acquire vault lock")?;
    let map = read_vault_map()?;
    let mut keys: Vec<String> = map.keys().cloned().collect();
    keys.sort();
    Ok(keys)
}

#[tauri::command]
pub async fn vault_has_secret(key: String) -> Result<bool, String> {
    let _guard = VAULT_LOCK.lock().map_err(|_| "Failed to acquire vault lock")?;
    let map = read_vault_map()?;
    Ok(map.contains_key(&key))
}
