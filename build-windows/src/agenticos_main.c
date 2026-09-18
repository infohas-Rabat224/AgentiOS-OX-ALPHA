#define UNICODE
#define _UNICODE
#include <windows.h>
#include <wininet.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <shellapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#pragma comment(lib, "wininet.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "gdi32.lib")

#define APP_NAME L"AgenticOS Mission Control"
#define APP_VERSION L"1.0.0-rc10"
#define TIMEOUT_SECONDS 15
#define WM_TRAYICON (WM_USER + 101)
#define IDT_SUPERVISOR_TIMER 201

// Global Configuration & Paths
static WCHAR g_app_dir[MAX_PATH] = {0};
static WCHAR g_log_dir[MAX_PATH] = {0};
static WCHAR g_startup_log[MAX_PATH] = {0};
static WCHAR g_kernel_log[MAX_PATH] = {0};
static WCHAR g_runtime_manifest[MAX_PATH] = {0};
static WCHAR g_diagnostic_text[8192] = {0};
static WCHAR g_error_reason[512] = {0};
static WCHAR g_ui_url[512] = L"http://127.0.0.1:3000";

static HANDLE g_job_object = NULL;
static PROCESS_INFORMATION g_kernel_pi = {0};
static PROCESS_INFORMATION g_ui_pi = {0};
static HWND g_supervisor_hwnd = NULL;
static NOTIFYICONDATAW g_nid = {0};
static BOOL g_tray_active = FALSE;
static int g_kernel_port = 8001;
static int g_frontend_port = 3000;

// Forward declarations
static void write_log(const WCHAR *format, ...);
static BOOL run_startup_sequence();
static INT_PTR show_failure_ui();
static void launch_ui();
static void cleanup_and_exit(int code);

// Write timestamped entry to startup.log
static void write_log(const WCHAR *format, ...) {
    FILE *f = _wfopen(g_startup_log, L"a, ccs=UTF-8");
    if (!f) return;

    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    WCHAR time_buf[64];
    wcsftime(time_buf, sizeof(time_buf) / sizeof(WCHAR), L"%Y-%m-%d %H:%M:%S", tm_info);

    fwprintf(f, L"[%s] ", time_buf);

    va_list args;
    va_start(args, format);
    vfwprintf(f, format, args);
    va_end(args);

    fwprintf(f, L"\n");
    fclose(f);
}

// Ensure directory exists
static void ensure_dir(const WCHAR *dir) {
    CreateDirectoryW(dir, NULL);
}

// Read port from runtime manifest if written by kernel
static void read_runtime_manifest() {
    FILE *f = _wfopen(g_runtime_manifest, L"r, ccs=UTF-8");
    if (!f) return;

    char line[512];
    while (fgets(line, sizeof(line), (FILE *)f)) {
        int port = 0;
        if (sscanf(line, " \"kernelPort\": %d", &port) == 1) {
            g_kernel_port = port;
        } else if (sscanf(line, " \"frontendPort\": %d", &port) == 1) {
            g_frontend_port = port;
            wnsprintfW(g_ui_url, sizeof(g_ui_url) / sizeof(WCHAR), L"http://127.0.0.1:%d", port);
        }
    }
    fclose(f);
}

// Check Health Endpoint (http://127.0.0.1:<kernel_port>/healthz)
static BOOL check_backend_health() {
    WCHAR health_url[256];
    wnsprintfW(health_url, sizeof(health_url) / sizeof(WCHAR), L"http://127.0.0.1:%d/healthz", g_kernel_port);

    HINTERNET hInternet = InternetOpenW(L"AgenticOS-Supervisor/1.0", INTERNET_OPEN_TYPE_DIRECT, NULL, NULL, 0);
    if (!hInternet) return FALSE;

    DWORD timeout = 1200;
    InternetSetOptionW(hInternet, INTERNET_OPTION_CONNECT_TIMEOUT, &timeout, sizeof(timeout));
    InternetSetOptionW(hInternet, INTERNET_OPTION_RECEIVE_TIMEOUT, &timeout, sizeof(timeout));

    HINTERNET hUrl = InternetOpenUrlW(hInternet, health_url, NULL, 0, INTERNET_FLAG_RELOAD | INTERNET_FLAG_NO_CACHE_WRITE, 0);
    if (!hUrl) {
        InternetCloseHandle(hInternet);
        return FALSE;
    }

    DWORD statusCode = 0;
    DWORD statusSize = sizeof(statusCode);
    BOOL queryOk = HttpQueryInfoW(hUrl, HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER, &statusCode, &statusSize, NULL);

    char buffer[2048] = {0};
    DWORD bytesRead = 0;
    BOOL readOk = InternetReadFile(hUrl, buffer, sizeof(buffer) - 1, &bytesRead);

    InternetCloseHandle(hUrl);
    InternetCloseHandle(hInternet);

    if (queryOk && statusCode == 200 && readOk && bytesRead > 0) {
        if (strstr(buffer, "\"status\"") && (strstr(buffer, "\"ok\"") || strstr(buffer, "\"healthy\""))) {
            return TRUE;
        }
    }
    return FALSE;
}

// Copy Diagnostic to Windows Clipboard
static void copy_diagnostic_to_clipboard(HWND hwnd) {
    if (!OpenClipboard(hwnd)) return;
    EmptyClipboard();

    size_t len = (wcslen(g_diagnostic_text) + 1) * sizeof(WCHAR);
    HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, len);
    if (hMem) {
        memcpy(GlobalLock(hMem), g_diagnostic_text, len);
        GlobalUnlock(hMem);
        SetClipboardData(CF_UNICODETEXT, hMem);
    }
    CloseClipboard();
    MessageBoxW(hwnd, L"Startup diagnostic trace copied to Windows clipboard.", L"AgenticOS", MB_OK | MB_ICONINFORMATION);
}

// Failure Dialog Proc
#define IDC_BTN_COPY   1001
#define IDC_BTN_LOG    1002
#define IDC_BTN_RETRY  1003
#define IDC_BTN_CLOSE  1004

static BOOL CALLBACK SetChildFontProc(HWND hChild, LPARAM lParam) {
    SendMessageW(hChild, WM_SETFONT, lParam, TRUE);
    return TRUE;
}

static LRESULT CALLBACK FailureDlgProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            // Title Header
            HWND hTitle = CreateWindowW(L"STATIC", L"AgenticOS could not start.",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 20, 560, 30, hwnd, NULL, NULL, NULL);

            // Subsystem Badge
            CreateWindowW(L"STATIC", L"Component: Backend Kernel\nStatus: FAILED",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 58, 560, 40, hwnd, NULL, NULL, NULL);

            // Reason Header
            CreateWindowW(L"STATIC", L"Error Reason:",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 105, 560, 18, hwnd, NULL, NULL, NULL);

            CreateWindowW(L"STATIC", g_error_reason,
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 126, 560, 44, hwnd, NULL, NULL, NULL);

            // Diagnostic Trace Box
            CreateWindowW(L"STATIC", L"Diagnostic Details & Environment Trace:",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 175, 560, 18, hwnd, NULL, NULL, NULL);

            HWND hEdit = CreateWindowW(L"EDIT", g_diagnostic_text,
                WS_CHILD | WS_VISIBLE | WS_BORDER | WS_VSCROLL | ES_MULTILINE | ES_READONLY | ES_AUTOVSCROLL,
                24, 198, 555, 175, hwnd, NULL, NULL, NULL);

            // Log file label
            CreateWindowW(L"STATIC", L"Log File:",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 385, 70, 20, hwnd, NULL, NULL, NULL);

            CreateWindowW(L"STATIC", g_startup_log,
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                95, 385, 484, 20, hwnd, NULL, NULL, NULL);

            // Action Buttons
            CreateWindowW(L"BUTTON", L"Copy Diagnostic",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                24, 420, 135, 34, hwnd, (HMENU)IDC_BTN_COPY, NULL, NULL);

            CreateWindowW(L"BUTTON", L"Open Log",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                170, 420, 110, 34, hwnd, (HMENU)IDC_BTN_LOG, NULL, NULL);

            CreateWindowW(L"BUTTON", L"Retry Startup",
                WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON,
                340, 420, 120, 34, hwnd, (HMENU)IDC_BTN_RETRY, NULL, NULL);

            CreateWindowW(L"BUTTON", L"Close",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                470, 420, 110, 34, hwnd, (HMENU)IDC_BTN_CLOSE, NULL, NULL);

            // Set system font for child controls
            HFONT hFont = (HFONT)GetStockObject(DEFAULT_GUI_FONT);
            EnumChildWindows(hwnd, SetChildFontProc, (LPARAM)hFont);

            return 0;
        }

        case WM_COMMAND: {
            switch (LOWORD(wParam)) {
                case IDC_BTN_COPY:
                    copy_diagnostic_to_clipboard(hwnd);
                    break;
                case IDC_BTN_LOG:
                    ShellExecuteW(NULL, L"open", g_startup_log, NULL, NULL, SW_SHOWNORMAL);
                    break;
                case IDC_BTN_RETRY:
                    SetWindowLongPtrW(hwnd, GWLP_USERDATA, 1);
                    DestroyWindow(hwnd);
                    break;
                case IDC_BTN_CLOSE:
                case IDCANCEL:
                    SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
                    DestroyWindow(hwnd);
                    break;
            }
            return 0;
        }

        case WM_CLOSE:
            SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
            DestroyWindow(hwnd);
            return 0;

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

// Show Failure Dialog
static INT_PTR show_failure_ui() {
    WNDCLASSW wc = {0};
    wc.lpfnWndProc = FailureDlgProc;
    wc.hInstance = GetModuleHandleW(NULL);
    wc.lpszClassName = L"AgenticOS_Failure_Dialog";
    wc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
    wc.hCursor = LoadCursorW(NULL, IDC_ARROW);
    RegisterClassW(&wc);

    HWND hwnd = CreateWindowExW(
        WS_EX_DLGMODALFRAME | WS_EX_TOPMOST,
        wc.lpszClassName,
        L"AgenticOS — Startup Diagnostics",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
        (GetSystemMetrics(SM_CXSCREEN) - 620) / 2,
        (GetSystemMetrics(SM_CYSCREEN) - 510) / 2,
        620, 510,
        NULL, NULL, wc.hInstance, NULL);

    ShowWindow(hwnd, SW_SHOW);
    UpdateWindow(hwnd);

    MSG msg;
    while (GetMessageW(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    INT_PTR result = (INT_PTR)GetWindowLongPtrW(hwnd, GWLP_USERDATA);
    UnregisterClassW(wc.lpszClassName, wc.hInstance);
    return result;
}

// Find modern browser executable (Edge, Chrome, Brave)
static BOOL find_browser(WCHAR *path, DWORD max_len, BOOL *is_edge) {
    *is_edge = FALSE;

    // 1. Check MS Edge via App Paths
    HKEY hKey;
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
        DWORD len = max_len * sizeof(WCHAR);
        if (RegQueryValueExW(hKey, NULL, NULL, NULL, (LPBYTE)path, &len) == ERROR_SUCCESS) {
            RegCloseKey(hKey);
            if (PathFileExistsW(path)) {
                *is_edge = TRUE;
                return TRUE;
            }
        }
        RegCloseKey(hKey);
    }

    // 2. Check Standard Program Files Edge
    WCHAR prog_files[MAX_PATH];
    if (SHGetFolderPathW(NULL, CSIDL_PROGRAM_FILESX86, NULL, 0, prog_files) == S_OK) {
        wnsprintfW(path, max_len, L"%s\\Microsoft\\Edge\\Application\\msedge.exe", prog_files);
        if (PathFileExistsW(path)) {
            *is_edge = TRUE;
            return TRUE;
        }
    }
    if (SHGetFolderPathW(NULL, CSIDL_PROGRAM_FILES, NULL, 0, prog_files) == S_OK) {
        wnsprintfW(path, max_len, L"%s\\Microsoft\\Edge\\Application\\msedge.exe", prog_files);
        if (PathFileExistsW(path)) {
            *is_edge = TRUE;
            return TRUE;
        }
    }

    // 3. Check Google Chrome via App Paths
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE, L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe", 0, KEY_READ, &hKey) == ERROR_SUCCESS) {
        DWORD len = max_len * sizeof(WCHAR);
        if (RegQueryValueExW(hKey, NULL, NULL, NULL, (LPBYTE)path, &len) == ERROR_SUCCESS) {
            RegCloseKey(hKey);
            if (PathFileExistsW(path)) return TRUE;
        }
        RegCloseKey(hKey);
    }

    return FALSE;
}

// Start Backend Process
static BOOL start_backend(DWORD *out_pid) {
    WCHAR kernel_exe[MAX_PATH];
    wnsprintfW(kernel_exe, MAX_PATH, L"%s\\agenticos-kernel.exe", g_app_dir);

    if (!PathFileExistsW(kernel_exe)) {
        wnsprintfW(kernel_exe, MAX_PATH, L"%s\\bin\\agenticos-kernel.exe", g_app_dir);
    }

    if (!PathFileExistsW(kernel_exe)) {
        wnsprintfW(g_error_reason, sizeof(g_error_reason) / sizeof(WCHAR),
            L"Kernel binary missing: %s\\agenticos-kernel.exe", g_app_dir);
        write_log(L"ERROR: %s", g_error_reason);
        return FALSE;
    }

    write_log(L"Executing Kernel binary: %s", kernel_exe);

    // Setup redirect pipes for logging
    SECURITY_ATTRIBUTES sa;
    sa.nLength = sizeof(sa);
    sa.lpSecurityDescriptor = NULL;
    sa.bInheritHandle = TRUE;

    HANDLE hLogFile = CreateFileW(g_kernel_log, FILE_APPEND_DATA, FILE_SHARE_READ | FILE_SHARE_WRITE, &sa, OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);

    STARTUPINFOW si = {0};
    si.cb = sizeof(si);
    if (hLogFile != INVALID_HANDLE_VALUE) {
        si.dwFlags |= STARTF_USESTDHANDLES;
        si.hStdOutput = hLogFile;
        si.hStdError = hLogFile;
    }

    // Launch hidden background console for the backend
    BOOL created = CreateProcessW(
        kernel_exe,
        NULL,
        NULL,
        NULL,
        TRUE,
        CREATE_NO_WINDOW,
        NULL,
        g_app_dir,
        &si,
        &g_kernel_pi);

    if (hLogFile != INVALID_HANDLE_VALUE) {
        CloseHandle(hLogFile);
    }

    if (!created) {
        DWORD err = GetLastError();
        wnsprintfW(g_error_reason, sizeof(g_error_reason) / sizeof(WCHAR),
            L"CreateProcessW failed for agenticos-kernel.exe (Error: %lu)", err);
        write_log(L"ERROR: %s", g_error_reason);
        return FALSE;
    }

    *out_pid = g_kernel_pi.dwProcessId;
    write_log(L"Kernel process spawned successfully (PID: %lu)", *out_pid);

    // Assign to Job Object so it auto-terminates when AgenticOS terminates
    if (g_job_object) {
        AssignProcessToJobObject(g_job_object, g_kernel_pi.hProcess);
    }

    return TRUE;
}

// Supervisor Window Procedure (Handles System Tray & Process Heartbeat)
#define IDM_TRAY_OPEN    3001
#define IDM_TRAY_LOG     3002
#define IDM_TRAY_RESTART 3003
#define IDM_TRAY_EXIT    3004

static LRESULT CALLBACK SupervisorWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE:
            SetTimer(hwnd, IDT_SUPERVISOR_TIMER, 1000, NULL);
            return 0;

        case WM_TIMER:
            if (wParam == IDT_SUPERVISOR_TIMER) {
                // Check if kernel is still running
                if (g_kernel_pi.hProcess) {
                    DWORD exitCode = 0;
                    if (GetExitCodeProcess(g_kernel_pi.hProcess, &exitCode) && exitCode != STILL_ACTIVE) {
                        write_log(L"SUPERVISOR: Kernel exited unexpectedly with code %lu", exitCode);
                        // Clean handles and notify tray
                        CloseHandle(g_kernel_pi.hProcess);
                        CloseHandle(g_kernel_pi.hThread);
                        memset(&g_kernel_pi, 0, sizeof(g_kernel_pi));

                        wnsprintfW(g_error_reason, sizeof(g_error_reason) / sizeof(WCHAR),
                            L"Kernel exited unexpectedly (Code: %lu)", exitCode);
                        show_failure_ui();
                    }
                }
            }
            return 0;

        case WM_TRAYICON:
            if (lParam == WM_LBUTTONDBLCLK || lParam == WM_LBUTTONUP) {
                launch_ui();
            } else if (lParam == WM_RBUTTONUP) {
                POINT pt;
                GetCursorPos(&pt);
                HMENU hMenu = CreatePopupMenu();
                AppendMenuW(hMenu, MF_STRING, IDM_TRAY_OPEN, L"Open AgenticOS Mission Control");
                AppendMenuW(hMenu, MF_SEPARATOR, 0, NULL);

                WCHAR status_item[128];
                wnsprintfW(status_item, sizeof(status_item) / sizeof(WCHAR),
                    L"Kernel Status: Active (Port %d)", g_kernel_port);
                AppendMenuW(hMenu, MF_STRING | MF_GRAYED, 0, status_item);

                AppendMenuW(hMenu, MF_STRING, IDM_TRAY_LOG, L"Open Startup Log");
                AppendMenuW(hMenu, MF_STRING, IDM_TRAY_RESTART, L"Restart Kernel");
                AppendMenuW(hMenu, MF_SEPARATOR, 0, NULL);
                AppendMenuW(hMenu, MF_STRING, IDM_TRAY_EXIT, L"Exit AgenticOS");

                SetForegroundWindow(hwnd);
                TrackPopupMenu(hMenu, TPM_RIGHTBUTTON, pt.x, pt.y, 0, hwnd, NULL);
                DestroyMenu(hMenu);
            }
            return 0;

        case WM_COMMAND:
            switch (LOWORD(wParam)) {
                case IDM_TRAY_OPEN:
                    launch_ui();
                    break;
                case IDM_TRAY_LOG:
                    ShellExecuteW(NULL, L"open", g_startup_log, NULL, NULL, SW_SHOWNORMAL);
                    break;
                case IDM_TRAY_RESTART:
                    write_log(L"SUPERVISOR: Restart requested from tray menu.");
                    if (g_kernel_pi.hProcess) {
                        TerminateProcess(g_kernel_pi.hProcess, 0);
                        CloseHandle(g_kernel_pi.hProcess);
                        CloseHandle(g_kernel_pi.hThread);
                        memset(&g_kernel_pi, 0, sizeof(g_kernel_pi));
                    }
                    Sleep(500);
                    run_startup_sequence();
                    break;
                case IDM_TRAY_EXIT:
                    cleanup_and_exit(0);
                    break;
            }
            return 0;

        case WM_DESTROY:
            KillTimer(hwnd, IDT_SUPERVISOR_TIMER);
            if (g_tray_active) {
                Shell_NotifyIconW(NIM_DELETE, &g_nid);
                g_tray_active = FALSE;
            }
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

// Setup background supervisor window & tray icon
static void init_supervisor_tray(HINSTANCE hInstance) {
    WNDCLASSW wc = {0};
    wc.lpfnWndProc = SupervisorWndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = L"AgenticOS_Supervisor";
    RegisterClassW(&wc);

    g_supervisor_hwnd = CreateWindowExW(
        0, wc.lpszClassName, L"AgenticOS Supervisor",
        0, 0, 0, 0, 0, HWND_MESSAGE, NULL, hInstance, NULL);

    memset(&g_nid, 0, sizeof(g_nid));
    g_nid.cbSize = sizeof(g_nid);
    g_nid.hWnd = g_supervisor_hwnd;
    g_nid.uID = 1;
    g_nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
    g_nid.uCallbackMessage = WM_TRAYICON;
    g_nid.hIcon = LoadIconW(NULL, IDI_APPLICATION);
    wcscpy(g_nid.szTip, L"AgenticOS Desktop Mission Control");

    Shell_NotifyIconW(NIM_ADD, &g_nid);
    g_tray_active = TRUE;
}

// Launch dedicated desktop window
static void launch_ui() {
    WCHAR browser_path[MAX_PATH];
    BOOL is_edge = FALSE;

    if (find_browser(browser_path, MAX_PATH, &is_edge)) {
        write_log(L"Launching dedicated desktop UI window via (%s)", browser_path);

        WCHAR data_dir[MAX_PATH];
        wnsprintfW(data_dir, MAX_PATH, L"%s\\webview", g_log_dir);
        ensure_dir(data_dir);

        WCHAR cmdline[2048];
        wnsprintfW(cmdline, sizeof(cmdline) / sizeof(WCHAR),
            L"\"%s\" --app=\"%s\" --window-size=1440,900 --user-data-dir=\"%s\" --no-first-run --no-default-browser-check --disable-features=Translate --name=\"AgenticOS\"",
            browser_path, g_ui_url, data_dir);

        STARTUPINFOW ui_si = {0};
        ui_si.cb = sizeof(ui_si);
        // Note: Do NOT assign browser to g_job_object! Chromium sandbox manages its own child jobs.
        if (CreateProcessW(NULL, cmdline, NULL, NULL, FALSE, 0, NULL, g_app_dir, &ui_si, &g_ui_pi)) {
            write_log(L"Dedicated Desktop UI window launched (Launcher PID: %lu)", g_ui_pi.dwProcessId);
        } else {
            write_log(L"CreateProcessW failed for app mode, falling back to ShellExecute.");
            ShellExecuteW(NULL, L"open", g_ui_url, NULL, NULL, SW_SHOWNORMAL);
        }
    } else {
        write_log(L"Opening system default browser for: %s", g_ui_url);
        ShellExecuteW(NULL, L"open", g_ui_url, NULL, NULL, SW_SHOWNORMAL);
    }
}

// Startup Sequence Implementation
static BOOL run_startup_sequence() {
    time_t start_time = time(NULL);
    write_log(L"============================================================");
    write_log(L"AgenticOS Desktop Mission Control Startup (v%s)", APP_VERSION);
    write_log(L"Executable Directory: %s", g_app_dir);
    write_log(L"Logs Directory:       %s", g_log_dir);
    write_log(L"============================================================");

    // 1. Launch native backend daemon
    DWORD pid = 0;
    if (!start_backend(&pid)) {
        wnsprintfW(g_diagnostic_text, sizeof(g_diagnostic_text) / sizeof(WCHAR),
            L"Application Version: %s\n"
            L"Operating System:    Windows x64\n"
            L"Executable Path:     %s\\AgenticOS.exe\n"
            L"Backend Binary:      %s\\agenticos-kernel.exe\n"
            L"Backend Status:      FAILED (Could not launch binary)\n"
            L"Reason:              %s\n"
            L"Startup Log:         %s\n",
            APP_VERSION, g_app_dir, g_app_dir, g_error_reason, g_startup_log);
        return FALSE;
    }

    // 2. Poll health endpoint until healthy or timeout
    write_log(L"Polling Backend Health (Target: http://127.0.0.1:8001/healthz, Timeout: %d s)...", TIMEOUT_SECONDS);
    BOOL is_healthy = FALSE;
    for (int i = 0; i < TIMEOUT_SECONDS * 4; i++) {
        // Read updated runtime manifest if generated
        read_runtime_manifest();

        // Check if backend died unexpectedly
        DWORD exitCode = 0;
        if (GetExitCodeProcess(g_kernel_pi.hProcess, &exitCode) && exitCode != STILL_ACTIVE) {
            wnsprintfW(g_error_reason, sizeof(g_error_reason) / sizeof(WCHAR),
                L"Kernel terminated prematurely with exit code: %lu", exitCode);
            write_log(L"ERROR: %s", g_error_reason);
            break;
        }

        if (check_backend_health()) {
            is_healthy = TRUE;
            break;
        }
        Sleep(250);
    }

    double elapsed = difftime(time(NULL), start_time);

    if (!is_healthy) {
        if (wcslen(g_error_reason) == 0) {
            wnsprintfW(g_error_reason, sizeof(g_error_reason) / sizeof(WCHAR),
                L"Backend health check timed out after %.1f seconds on port %d.", elapsed, g_kernel_port);
        }
        write_log(L"ERROR: %s", g_error_reason);

        wnsprintfW(g_diagnostic_text, sizeof(g_diagnostic_text) / sizeof(WCHAR),
            L"Application Version: %s\n"
            L"Operating System:    Windows x64\n"
            L"Executable Path:     %s\\AgenticOS.exe\n"
            L"Backend Executable:  %s\\agenticos-kernel.exe\n"
            L"Backend PID:         %lu\n"
            L"Kernel Port:         %d\n"
            L"Frontend Port:       %d\n"
            L"Health URL:          http://127.0.0.1:%d/healthz\n"
            L"Health Status:       FAILED (Connection refused or timeout)\n"
            L"Duration:            %.2f seconds\n"
            L"Error Reason:        %s\n"
            L"Startup Log:         %s\n"
            L"Kernel Log:          %s\n",
            APP_VERSION, g_app_dir, g_app_dir, pid, g_kernel_port, g_frontend_port,
            g_kernel_port, elapsed, g_error_reason, g_startup_log, g_kernel_log);
        return FALSE;
    }

    write_log(L"Backend Health verified in %.2f seconds (STATUS: HEALTHY). Kernel Port: %d, Frontend Port: %d.",
        elapsed, g_kernel_port, g_frontend_port);

    // 3. Launch dedicated UI window
    launch_ui();

    write_log(L"AgenticOS Desktop Mission Control is ONLINE and operational.");
    return TRUE;
}

// Clean up all resources and terminate cleanly
static void cleanup_and_exit(int code) {
    write_log(L"Shutting down AgenticOS Mission Control...");

    if (g_tray_active) {
        Shell_NotifyIconW(NIM_DELETE, &g_nid);
        g_tray_active = FALSE;
    }

    if (g_kernel_pi.hProcess) {
        TerminateProcess(g_kernel_pi.hProcess, 0);
        CloseHandle(g_kernel_pi.hProcess);
        CloseHandle(g_kernel_pi.hThread);
        memset(&g_kernel_pi, 0, sizeof(g_kernel_pi));
    }

    if (g_ui_pi.hProcess) {
        CloseHandle(g_ui_pi.hProcess);
        CloseHandle(g_ui_pi.hThread);
        memset(&g_ui_pi, 0, sizeof(g_ui_pi));
    }

    if (g_job_object) {
        CloseHandle(g_job_object);
        g_job_object = NULL;
    }

    ExitProcess(code);
}

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPWSTR lpCmdLine, int nCmdShow) {
    // 1. Single-Instance Check
    HANDLE hSingleMutex = CreateMutexW(NULL, TRUE, L"Global\\AgenticOS_MissionControl_Instance_Mutex");
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        // Find existing window or notify
        HWND existing = FindWindowW(L"AgenticOS_Supervisor", L"AgenticOS Supervisor");
        if (existing) {
            PostMessageW(existing, WM_COMMAND, MAKEWPARAM(IDM_TRAY_OPEN, 0), 0);
        } else {
            ShellExecuteW(NULL, L"open", L"http://127.0.0.1:3000", NULL, NULL, SW_SHOWNORMAL);
        }
        return 0;
    }

    // 2. Resolve Application Directory
    GetModuleFileNameW(NULL, g_app_dir, MAX_PATH);
    PathRemoveFileSpecW(g_app_dir);

    // 3. Setup Logs & Workspace Directories in %LOCALAPPDATA%\AgenticOS
    WCHAR local_app_data[MAX_PATH];
    if (SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, local_app_data) == S_OK) {
        wnsprintfW(g_log_dir, MAX_PATH, L"%s\\AgenticOS", local_app_data);
        ensure_dir(g_log_dir);
        wnsprintfW(g_log_dir, MAX_PATH, L"%s\\AgenticOS\\logs", local_app_data);
        ensure_dir(g_log_dir);
        WCHAR ws_dir[MAX_PATH];
        wnsprintfW(ws_dir, MAX_PATH, L"%s\\AgenticOS\\workspace", local_app_data);
        ensure_dir(ws_dir);
        WCHAR sec_dir[MAX_PATH];
        wnsprintfW(sec_dir, MAX_PATH, L"%s\\AgenticOS\\security", local_app_data);
        ensure_dir(sec_dir);
    } else {
        wnsprintfW(g_log_dir, MAX_PATH, L"%s\\logs", g_app_dir);
        ensure_dir(g_log_dir);
    }

    wnsprintfW(g_startup_log, MAX_PATH, L"%s\\startup.log", g_log_dir);
    wnsprintfW(g_kernel_log, MAX_PATH, L"%s\\kernel.log", g_log_dir);
    wnsprintfW(g_runtime_manifest, MAX_PATH, L"%s\\..\\runtime.json", g_log_dir);

    // 4. Create Job Object with KILL_ON_JOB_CLOSE for kernel backend
    g_job_object = CreateJobObjectW(NULL, NULL);
    if (g_job_object) {
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION jeli = {0};
        jeli.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK;
        SetInformationJobObject(g_job_object, JobObjectExtendedLimitInformation, &jeli, sizeof(jeli));
    }

    // 5. Initialize Supervisor & System Tray Companion
    init_supervisor_tray(hInstance);

    // 6. Run Startup Sequence with Retry Loop
    while (TRUE) {
        g_error_reason[0] = L'\0';
        g_diagnostic_text[0] = L'\0';

        if (run_startup_sequence()) {
            break;
        } else {
            // Show Failure UI
            INT_PTR retry = show_failure_ui();
            if (retry == 1) {
                // User clicked Retry
                if (g_kernel_pi.hProcess) {
                    TerminateProcess(g_kernel_pi.hProcess, 0);
                    CloseHandle(g_kernel_pi.hProcess);
                    CloseHandle(g_kernel_pi.hThread);
                    memset(&g_kernel_pi, 0, sizeof(g_kernel_pi));
                }
                Sleep(500);
                continue;
            } else {
                cleanup_and_exit(1);
                return 1;
            }
        }
    }

    // 7. Supervisor Message Pump (Keeps backend alive while app is active)
    MSG msg;
    while (GetMessageW(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    cleanup_and_exit(0);
    return 0;
}
