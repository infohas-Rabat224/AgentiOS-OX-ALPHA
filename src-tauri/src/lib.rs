pub mod commands;

pub use commands::credential_vault::{
    vault_delete_secret, vault_get_secret, vault_has_secret, vault_list_keys, vault_store_secret,
};
pub use commands::download::download_github_release_asset;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::download::download_github_release_asset,
            commands::credential_vault::vault_store_secret,
            commands::credential_vault::vault_get_secret,
            commands::credential_vault::vault_delete_secret,
            commands::credential_vault::vault_list_keys,
            commands::credential_vault::vault_has_secret,
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgenticOS Tauri desktop application");
}
