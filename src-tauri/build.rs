fn main() {
    // tauri-build sets OUT_DIR, validates tauri.conf.json, and emits the
    // cfg flags that tauri::generate_context!() requires at compile time.
    // Without this build script, generate_context!() panics with:
    //   error: OUT_DIR env var is not set, do you have a build script?
    tauri_build::build()
}
