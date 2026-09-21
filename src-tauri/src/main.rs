#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Delegate to the library's run() function, which sets up the Tauri
    // builder, registers all IPC commands, spawns the backend kernel,
    // polls /healthz, and runs the main event loop.
    //
    // All command registration lives in src/lib.rs's invoke_handler. The
    // previous version of this file duplicated the invoke_handler list,
    // which caused cargo check to fail with:
    //   error[E0255]: the name `__tauri_command_name_launch_kernel` is
    //   defined multiple times
    agentic_os_lib::run();
}
