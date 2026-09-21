/*
 * AgenticOS Desktop Mission Control — Native Windows Supervisor
 * Version: 1.0.0-rc10 (Final Windows Production Build)
 *
 * ARCHITECTURE
 *   AgenticOS.exe (this supervisor)
 *       |
 *       +-- spawns agenticos-kernel.exe (native C HTTP backend, ports 8001 + 3000)
 *       |
 *       +-- polls http://127.0.0.1:<kernelPort>/healthz until healthy or timeout
 *       |
 *       +-- launches dedicated browser window in --app mode pointing to frontend
 *       |
 *       +-- shows VISIBLE splash window during the entire startup lifecycle
 *       |
 *       +-- on any failure, shows a native Win32 failure dialog with diagnostic
 *           codes (BACKEND_NOT_FOUND, BROWSER_LAUNCH_FAILED, HEALTH_CHECK_TIMEOUT, etc.)
 *           and the absolute path to the startup log file.
 *
 * CRITICAL CONTRACT
 *   - NEVER fail silently. Every failure path must produce a visible native window
 *     AND a written entry in %LOCALAPPDATA%\AgenticOS\logs\startup.log.
 *   - NEVER depend on bash / WSL / Git Bash / Python / npm / cargo / vite at runtime.
 *   - NEVER use development paths. All resources resolved from the installed exe directory.
 *   - The supervisor itself owns a VISIBLE window so the user always sees "something"
 *     the moment they click AgenticOS.
 *
 * BUILD
 *   x86_64-w64-mingw32-gcc -O2 -municode -mwindows \
 *       -o AgenticOS.exe agenticos_main.c \
 *       -lwininet -lshlwapi -luser32 -lshell32 -ladvapi32 -lgdi32
 *   (or cl.exe /O2 /DUNICODE /D_UNICODE agenticos_main.c /link ...)
 */

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

/* ---- Constants -------------------------------------------------------- */
#define APP_NAME         L"AgenticOS Mission Control"
#define APP_VERSION      L"1.0.0-rc10"
#define KERNEL_PORT_DEF  8001
#define FRONTEND_PORT_DEF 3000
#define HEALTH_TIMEOUT_S 20
#define WM_TRAYICON      (WM_USER + 101)
#define IDT_SUPERVISOR   201
#define IDT_BROWSER_GUARD 202
#define IDT_HEALTH_POLL   203

/* ---- Diagnostic codes (returned in failure UI and written to log) ----- */
#define ERR_NONE                 0
#define ERR_BACKEND_NOT_FOUND    1   /* agenticos-kernel.exe missing on disk */
#define ERR_BACKEND_START_FAILED 2   /* CreateProcessW failed */
#define ERR_BACKEND_CRASHED      3   /* backend exited before becoming healthy */
#define ERR_HEALTH_CHECK_TIMEOUT 4   /* /healthz never returned 200 within timeout */
#define ERR_BROWSER_LAUNCH_FAILED 5  /* find_browser() returned FALSE AND ShellExecuteW failed */
#define ERR_BROWSER_EXITED_EARLY  6  /* browser process exited within 3 seconds */
#define ERR_SINGLE_INSTANCE_BLOCKED 7
#define ERR_WEBVIEW2_UNAVAILABLE  8  /* reserved for future WebView2 fallback */

/* ---- Global state ----------------------------------------------------- */
static WCHAR g_app_dir[MAX_PATH]        = {0};
static WCHAR g_log_dir[MAX_PATH]        = {0};
static WCHAR g_startup_log[MAX_PATH]    = {0};
static WCHAR g_kernel_log[MAX_PATH]     = {0};
static WCHAR g_runtime_manifest[MAX_PATH] = {0};
static WCHAR g_diagnostic_text[8192]    = {0};
static WCHAR g_error_reason[512]        = {0};
static WCHAR g_ui_url[512]              = L"http://127.0.0.1:3000";
static WCHAR g_status_text[256]         = L"Initializing AgenticOS...";

static HANDLE g_job_object     = NULL;
static PROCESS_INFORMATION g_kernel_pi = {0};
static PROCESS_INFORMATION g_ui_pi     = {0};
static HWND   g_supervisor_hwnd = NULL;
static HWND   g_splash_hwnd     = NULL;
static NOTIFYICONDATAW g_nid    = {0};
static BOOL   g_tray_active     = FALSE;
static int   g_kernel_port      = KERNEL_PORT_DEF;
static int   g_frontend_port    = FRONTEND_PORT_DEF;
static int   g_last_error_code  = ERR_NONE;
static BOOL  g_browser_launched_ok = FALSE;
static time_t g_backend_start_time = 0;

/* Forward declarations */
static void  write_log(const WCHAR *format, ...);
static BOOL  run_startup_sequence(void);
static void  launch_ui(void);
static void  cleanup_and_exit(int code);
static void  set_status(const WCHAR *text);
static void  set_error(int code, const WCHAR *reason);
static void  build_diagnostic_text(const WCHAR *phase);
static BOOL  verify_browser_alive(void);
static BOOL CALLBACK SetChildFontProc(HWND hChild, LPARAM lParam);  /* forward decl */
static void  pump_messages_briefly(DWORD ms);

/* =========================================================================
 *   Logging
 * ========================================================================= */
static void write_log(const WCHAR *format, ...) {
    FILE *f = _wfopen(g_startup_log, L"a, ccs=UTF-8");
    if (!f) return;

    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    WCHAR time_buf[64];
    wcsftime(time_buf, sizeof(time_buf) / sizeof(WCHAR),
             L"%Y-%m-%dT%H:%M:%S", tm_info);

    fwprintf(f, L"[%s] ", time_buf);

    va_list args;
    va_start(args, format);
    vfwprintf(f, format, args);
    va_end(args);

    fwprintf(f, L"\n");
    fclose(f);
}

static void ensure_dir(const WCHAR *dir) { CreateDirectoryW(dir, NULL); }

/* Pump window messages for a brief period so the splash window stays
 * responsive during the synchronous startup loop. */
static void pump_messages_briefly(DWORD ms) {
    MSG msg;
    DWORD start = GetTickCount();
    while (GetTickCount() - start < ms) {
        if (PeekMessageW(&msg, NULL, 0, 0, PM_REMOVE)) {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        } else {
            Sleep(10);
        }
    }
}

/* =========================================================================
 *   Status / Error / Diagnostic
 * ========================================================================= */
static void set_status(const WCHAR *text) {
    wcsncpy(g_status_text, text, 255);
    g_status_text[255] = L'\0';
    write_log(L"STATUS: %s", g_status_text);
    if (g_splash_hwnd) InvalidateRect(g_splash_hwnd, NULL, TRUE);
}

static void set_error(int code, const WCHAR *reason) {
    g_last_error_code = code;
    wcsncpy(g_error_reason, reason, 511);
    g_error_reason[511] = L'\0';
    write_log(L"ERROR [code=%d]: %s", code, reason);
}

static const WCHAR *error_code_name(int code) {
    switch (code) {
        case ERR_NONE:                    return L"OK";
        case ERR_BACKEND_NOT_FOUND:       return L"BACKEND_NOT_FOUND";
        case ERR_BACKEND_START_FAILED:    return L"BACKEND_START_FAILED";
        case ERR_BACKEND_CRASHED:         return L"BACKEND_CRASHED";
        case ERR_HEALTH_CHECK_TIMEOUT:    return L"HEALTH_CHECK_TIMEOUT";
        case ERR_BROWSER_LAUNCH_FAILED:   return L"BROWSER_LAUNCH_FAILED";
        case ERR_BROWSER_EXITED_EARLY:    return L"BROWSER_EXITED_EARLY";
        case ERR_SINGLE_INSTANCE_BLOCKED: return L"SINGLE_INSTANCE_BLOCKED";
        case ERR_WEBVIEW2_UNAVAILABLE:    return L"WEBVIEW2_UNAVAILABLE";
        default:                          return L"UNKNOWN";
    }
}

static void build_diagnostic_text(const WCHAR *phase) {
    DWORD kernel_pid = g_kernel_pi.dwProcessId;
    DWORD browser_pid = g_ui_pi.dwProcessId;

    WCHAR exe_path[MAX_PATH] = {0};
    GetModuleFileNameW(NULL, exe_path, MAX_PATH);

    WCHAR cwd[MAX_PATH] = {0};
    GetCurrentDirectoryW(MAX_PATH, cwd);

    const WCHAR *code_name = error_code_name(g_last_error_code);

    _snwprintf(g_diagnostic_text, 8191,
        L"Phase:               %s\r\n"
        L"Application:         %s v%s\r\n"
        L"Diagnostic Code:     %s (%d)\r\n"
        L"Operating System:    Windows x64\r\n"
        L"Architecture:        x86_64 PE32+\r\n"
        L"Executable Path:     %s\r\n"
        L"Working Directory:   %s\r\n"
        L"Install Directory:   %s\r\n"
        L"Backend Binary:      %s\\agenticos-kernel.exe\r\n"
        L"Backend PID:         %lu\r\n"
        L"Backend Status:      %s\r\n"
        L"Kernel Port:         %d\r\n"
        L"Frontend Port:       %d\r\n"
        L"Health URL:          http://127.0.0.1:%d/healthz\r\n"
        L"Frontend URL:        %s\r\n"
        L"Browser PID:         %lu\r\n"
        L"Browser Verified:    %s\r\n"
        L"Error Reason:        %s\r\n"
        L"Startup Log:         %s\r\n"
        L"Kernel Log:          %s\r\n",
        phase,
        APP_NAME, APP_VERSION,
        code_name, g_last_error_code,
        exe_path,
        cwd,
        g_app_dir,
        g_app_dir,
        kernel_pid,
        (kernel_pid ? L"STARTED" : L"NOT_STARTED"),
        g_kernel_port, g_frontend_port,
        g_kernel_port,
        g_ui_url,
        browser_pid,
        (g_browser_launched_ok ? L"YES" : L"NO"),
        (wcslen(g_error_reason) ? g_error_reason : L"(no error)"),
        g_startup_log,
        g_kernel_log);
    g_diagnostic_text[8191] = L'\0';
}

/* =========================================================================
 *   Runtime manifest (kernel_port, frontend_port)
 * ========================================================================= */
static void read_runtime_manifest(void) {
    FILE *f = _wfopen(g_runtime_manifest, L"r, ccs=UTF-8");
    if (!f) return;

    char line[512];
    while (fgets(line, sizeof(line), (FILE *)f)) {
        int port = 0;
        if (sscanf(line, " \"kernelPort\": %d", &port) == 1 && port > 0) {
            g_kernel_port = port;
        } else if (sscanf(line, " \"frontendPort\": %d", &port) == 1 && port > 0) {
            g_frontend_port = port;
            _snwprintf(g_ui_url, 511, L"http://127.0.0.1:%d", port);
            g_ui_url[511] = L'\0';
        }
    }
    fclose(f);
}

/* =========================================================================
 *   Health check (HTTP GET /healthz on 127.0.0.1:<kernel_port>)
 * ========================================================================= */
static BOOL check_backend_health(void) {
    WCHAR health_url[256];
    _snwprintf(health_url, 255, L"http://127.0.0.1:%d/healthz", g_kernel_port);
    health_url[255] = L'\0';

    HINTERNET hInternet = InternetOpenW(L"AgenticOS-Supervisor/1.0",
                                          INTERNET_OPEN_TYPE_DIRECT,
                                          NULL, NULL, 0);
    if (!hInternet) return FALSE;

    DWORD timeout = 1500;
    InternetSetOptionW(hInternet, INTERNET_OPTION_CONNECT_TIMEOUT,
                       &timeout, sizeof(timeout));
    InternetSetOptionW(hInternet, INTERNET_OPTION_RECEIVE_TIMEOUT,
                       &timeout, sizeof(timeout));

    HINTERNET hUrl = InternetOpenUrlW(hInternet, health_url, NULL, 0,
                                       INTERNET_FLAG_RELOAD |
                                       INTERNET_FLAG_NO_CACHE_WRITE, 0);
    if (!hUrl) { InternetCloseHandle(hInternet); return FALSE; }

    DWORD statusCode = 0;
    DWORD statusSize = sizeof(statusCode);
    BOOL queryOk = HttpQueryInfoW(hUrl,
                                   HTTP_QUERY_STATUS_CODE | HTTP_QUERY_FLAG_NUMBER,
                                   &statusCode, &statusSize, NULL);

    char buffer[2048] = {0};
    DWORD bytesRead = 0;
    BOOL readOk = InternetReadFile(hUrl, buffer, sizeof(buffer) - 1, &bytesRead);

    InternetCloseHandle(hUrl);
    InternetCloseHandle(hInternet);

    if (queryOk && statusCode == 200 && readOk && bytesRead > 0) {
        if (strstr(buffer, "\"status\"") &&
            (strstr(buffer, "\"ok\"") || strstr(buffer, "\"healthy\""))) {
            return TRUE;
        }
    }
    return FALSE;
}

/* =========================================================================
 *   Browser discovery (Edge preferred, Chrome acceptable)
 * ========================================================================= */
static BOOL find_browser(WCHAR *path, DWORD max_len, BOOL *is_edge) {
    *is_edge = FALSE;

    /* 1. Microsoft Edge via HKLM App Paths */
    HKEY hKey;
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE,
            L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe",
            0, KEY_READ | KEY_WOW64_64KEY, &hKey) == ERROR_SUCCESS) {
        DWORD len = max_len * sizeof(WCHAR);
        if (RegQueryValueExW(hKey, NULL, NULL, NULL, (LPBYTE)path, &len) == ERROR_SUCCESS) {
            RegCloseKey(hKey);
            if (PathFileExistsW(path)) { *is_edge = TRUE; return TRUE; }
        }
        RegCloseKey(hKey);
    }

    /* 2. Edge in Program Files */
    WCHAR prog_files[MAX_PATH];
    if (SHGetFolderPathW(NULL, CSIDL_PROGRAM_FILESX86, NULL, 0, prog_files) == S_OK) {
        _snwprintf(path, max_len, L"%s\\Microsoft\\Edge\\Application\\msedge.exe", prog_files);
        path[max_len - 1] = L'\0';
        if (PathFileExistsW(path)) { *is_edge = TRUE; return TRUE; }
    }
    if (SHGetFolderPathW(NULL, CSIDL_PROGRAM_FILES, NULL, 0, prog_files) == S_OK) {
        _snwprintf(path, max_len, L"%s\\Microsoft\\Edge\\Application\\msedge.exe", prog_files);
        path[max_len - 1] = L'\0';
        if (PathFileExistsW(path)) { *is_edge = TRUE; return TRUE; }
    }

    /* 3. Google Chrome via HKLM App Paths */
    if (RegOpenKeyExW(HKEY_LOCAL_MACHINE,
            L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe",
            0, KEY_READ | KEY_WOW64_64KEY, &hKey) == ERROR_SUCCESS) {
        DWORD len = max_len * sizeof(WCHAR);
        if (RegQueryValueExW(hKey, NULL, NULL, NULL, (LPBYTE)path, &len) == ERROR_SUCCESS) {
            RegCloseKey(hKey);
            if (PathFileExistsW(path)) return TRUE;
        }
        RegCloseKey(hKey);
    }

    /* 4. Chrome in Program Files */
    if (SHGetFolderPathW(NULL, CSIDL_PROGRAM_FILESX86, NULL, 0, prog_files) == S_OK) {
        _snwprintf(path, max_len, L"%s\\Google\\Chrome\\Application\\chrome.exe", prog_files);
        path[max_len - 1] = L'\0';
        if (PathFileExistsW(path)) return TRUE;
    }

    return FALSE;
}

/* =========================================================================
 *   Backend launch (agenticos-kernel.exe)
 * ========================================================================= */
static BOOL start_backend(DWORD *out_pid) {
    WCHAR kernel_exe[MAX_PATH];

    /* Search candidates in installation tree */
    const WCHAR *rel_paths[] = {
        L"agenticos-kernel.exe",
        L"bin\\agenticos-kernel.exe",
        L"build-windows\\bin\\agenticos-kernel.exe",
        NULL
    };
    BOOL found = FALSE;
    for (int i = 0; rel_paths[i]; i++) {
        _snwprintf(kernel_exe, MAX_PATH, L"%s\\%s", g_app_dir, rel_paths[i]);
        kernel_exe[MAX_PATH - 1] = L'\0';
        if (PathFileExistsW(kernel_exe)) { found = TRUE; break; }
    }

    if (!found) {
        WCHAR reason[512];
        _snwprintf(reason, 511,
            L"Kernel binary missing. Searched: %s\\agenticos-kernel.exe (and bin\\, build-windows\\bin\\)",
            g_app_dir);
        reason[511] = L'\0';
        set_error(ERR_BACKEND_NOT_FOUND, reason);
        return FALSE;
    }

    write_log(L"Executing Kernel binary: %s", kernel_exe);

    SECURITY_ATTRIBUTES sa;
    sa.nLength = sizeof(sa);
    sa.lpSecurityDescriptor = NULL;
    sa.bInheritHandle = TRUE;

    HANDLE hLogFile = CreateFileW(g_kernel_log, FILE_APPEND_DATA,
        FILE_SHARE_READ | FILE_SHARE_WRITE, &sa, OPEN_ALWAYS,
        FILE_ATTRIBUTE_NORMAL, NULL);

    STARTUPINFOW si = {0};
    si.cb = sizeof(si);
    if (hLogFile != INVALID_HANDLE_VALUE) {
        si.dwFlags |= STARTF_USESTDHANDLES;
        si.hStdOutput = hLogFile;
        si.hStdError = hLogFile;
    }

    BOOL created = CreateProcessW(
        kernel_exe, NULL, NULL, NULL, TRUE,
        CREATE_NO_WINDOW, NULL, g_app_dir, &si, &g_kernel_pi);

    if (hLogFile != INVALID_HANDLE_VALUE) CloseHandle(hLogFile);

    if (!created) {
        DWORD err = GetLastError();
        WCHAR reason[512];
        _snwprintf(reason, 511,
            L"CreateProcessW failed for agenticos-kernel.exe (Win32 Error: %lu)",
            err);
        reason[511] = L'\0';
        set_error(ERR_BACKEND_START_FAILED, reason);
        return FALSE;
    }

    *out_pid = g_kernel_pi.dwProcessId;
    g_backend_start_time = time(NULL);
    write_log(L"Kernel process spawned (PID: %lu) working_dir=%s",
              *out_pid, g_app_dir);

    if (g_job_object) {
        AssignProcessToJobObject(g_job_object, g_kernel_pi.hProcess);
    }

    return TRUE;
}

/* =========================================================================
 *   Browser launch
 * ========================================================================= */
static void launch_ui(void) {
    WCHAR browser_path[MAX_PATH];
    BOOL is_edge = FALSE;

    /* Ensure the URL reflects any runtime manifest updates. */
    read_runtime_manifest();

    if (find_browser(browser_path, MAX_PATH, &is_edge)) {
        write_log(L"Launching dedicated desktop UI via %s", browser_path);

        WCHAR data_dir[MAX_PATH];
        _snwprintf(data_dir, MAX_PATH, L"%s\\webview", g_log_dir);
        data_dir[MAX_PATH - 1] = L'\0';
        ensure_dir(data_dir);

        /* Note: --name is NOT a valid Chrome/Edge flag and has been removed. */
        WCHAR cmdline[2048];
        _snwprintf(cmdline, 2047,
            L"\"%s\" --app=%s --window-size=1440,900 --user-data-dir=\"%s\" "
            L"--no-first-run --no-default-browser-check --disable-features=Translate "
            L"--new-window",
            browser_path, g_ui_url, data_dir);
        cmdline[2047] = L'\0';

        STARTUPINFOW ui_si = {0};
        ui_si.cb = sizeof(ui_si);
        ui_si.dwFlags = STARTF_USESHOWWINDOW;
        ui_si.wShowWindow = SW_SHOWNORMAL;

        /* IMPORTANT: do NOT add the browser to g_job_object. Chromium sandbox
         * manages its own child jobs; if we tie it to ours, it crashes immediately. */
        if (CreateProcessW(NULL, cmdline, NULL, NULL, FALSE,
                          0, NULL, g_app_dir, &ui_si, &g_ui_pi)) {
            write_log(L"Browser launched (Launcher PID: %lu)",
                      g_ui_pi.dwProcessId);
            /* We do NOT mark success yet — verify_browser_alive() will
             * confirm the process is still running 3 seconds later. */
            return;
        } else {
            DWORD err = GetLastError();
            write_log(L"CreateProcessW failed for browser (Win32 Error: %lu). "
                      L"Falling back to ShellExecuteW.", err);
            /* Fall through to ShellExecuteW */
        }
    } else {
        write_log(L"No Edge/Chrome binary located. Falling back to default browser.");
    }

    /* Fallback: ask the OS to open the URL with whatever is registered. */
    HINSTANCE h = ShellExecuteW(NULL, L"open", g_ui_url, NULL, NULL, SW_SHOWNORMAL);
    INT_PTR rc = (INT_PTR)h;
    if (rc <= 32) {
        WCHAR reason[512];
        _snwprintf(reason, 511,
            L"Browser launch failed. ShellExecuteW returned %lld. "
            L"Install Microsoft Edge or Google Chrome, then click Retry.",
            (long long)rc);
        reason[511] = L'\0';
        set_error(ERR_BROWSER_LAUNCH_FAILED, reason);
        return;
    }

    /* ShellExecuteW succeeded — but we have no handle to verify liveness.
     * Mark as launched-ok; if it turns out no browser actually opened, the
     * user will see the splash window with a retry button. */
    g_browser_launched_ok = TRUE;
    write_log(L"ShellExecuteW opened default browser for %s", g_ui_url);
}

/* Verify the browser process is still alive 3 seconds after launch.
 * Called from a timer posted by the supervisor. */
static BOOL verify_browser_alive(void) {
    if (g_ui_pi.hProcess == NULL) {
        /* ShellExecuteW path — cannot verify; assume success. */
        return g_browser_launched_ok;
    }

    DWORD exit_code = 0;
    if (GetExitCodeProcess(g_ui_pi.hProcess, &exit_code)) {
        if (exit_code == STILL_ACTIVE) {
            g_browser_launched_ok = TRUE;
            return TRUE;
        }
        /* Browser exited prematurely — likely a bad flag or a crashed profile. */
        WCHAR reason[512];
        _snwprintf(reason, 511,
            L"Browser process exited prematurely with code %lu. "
            L"This usually means a corrupted --user-data-dir or a browser crash.",
            exit_code);
        reason[511] = L'\0';
        set_error(ERR_BROWSER_EXITED_EARLY, reason);
        return FALSE;
    }
    return FALSE;
}

/* =========================================================================
 *   Clipboard helper
 * ========================================================================= */
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
    MessageBoxW(hwnd,
        L"Startup diagnostic trace copied to Windows clipboard.",
        L"AgenticOS", MB_OK | MB_ICONINFORMATION);
}

/* =========================================================================
 *   SPLASH WINDOW (visible from the moment AgenticOS.exe is launched)
 * ========================================================================= */
#define IDC_SPLASH_STATUS   5001
#define IDC_SPLASH_DETAIL   5002
#define IDC_SPLASH_OPENLOG  5003
#define IDC_SPLASH_OPENBROWSER 5004
#define IDC_SPLASH_RETRY    5005
#define IDC_SPLASH_CLOSE    5006

static HFONT g_splash_font = NULL;
static HFONT g_splash_title_font = NULL;

static LRESULT CALLBACK SplashWndProc(HWND hwnd, UINT msg,
                                       WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            g_splash_title_font = CreateFontW(
                22, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE,
                DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");
            g_splash_font = CreateFontW(
                14, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE,
                DEFAULT_CHARSET, OUT_DEFAULT_PRECIS,
                CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
                DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");

            CreateWindowW(L"STATIC", L"AgenticOS — Starting",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 20, 460, 30, hwnd, NULL, NULL, NULL);

            CreateWindowW(L"STATIC", L"Version 1.0.0-rc10",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 52, 460, 18, hwnd, NULL, NULL, NULL);

            CreateWindowW(L"STATIC", L"Status:",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 90, 60, 18, hwnd, NULL, NULL, NULL);

            CreateWindowW(L"STATIC", g_status_text,
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                90, 90, 394, 18, hwnd,
                (HMENU)IDC_SPLASH_STATUS, NULL, NULL);

            CreateWindowW(L"EDIT", g_diagnostic_text,
                WS_CHILD | WS_VISIBLE | WS_BORDER | WS_VSCROLL |
                ES_MULTILINE | ES_READONLY | ES_AUTOVSCROLL,
                24, 120, 460, 180, hwnd,
                (HMENU)IDC_SPLASH_DETAIL, NULL, NULL);

            CreateWindowW(L"BUTTON", L"Open Log",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                24, 312, 100, 32, hwnd,
                (HMENU)IDC_SPLASH_OPENLOG, NULL, NULL);

            CreateWindowW(L"BUTTON", L"Open Browser",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                132, 312, 120, 32, hwnd,
                (HMENU)IDC_SPLASH_OPENBROWSER, NULL, NULL);

            CreateWindowW(L"BUTTON", L"Retry",
                WS_CHILD | WS_VISIBLE | BS_DEFPUSHBUTTON,
                262, 312, 100, 32, hwnd,
                (HMENU)IDC_SPLASH_RETRY, NULL, NULL);

            CreateWindowW(L"BUTTON", L"Close",
                WS_CHILD | WS_VISIBLE | BS_PUSHBUTTON,
                372, 312, 100, 32, hwnd,
                (HMENU)IDC_SPLASH_CLOSE, NULL, NULL);

            EnumChildWindows(hwnd, SetChildFontProc, (LPARAM)g_splash_font);

            /* Apply title font to the first STATIC */
            HWND hTitle = GetWindow(hwnd, GW_CHILD);
            if (hTitle) SendMessageW(hTitle, WM_SETFONT,
                                     (WPARAM)g_splash_title_font, TRUE);
            return 0;
        }

        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC hdc = BeginPaint(hwnd, &ps);
            /* Solid background */
            RECT rc; GetClientRect(hwnd, &rc);
            HBRUSH bg = CreateSolidBrush(RGB(245, 247, 250));
            FillRect(hdc, &rc, bg);
            DeleteObject(bg);
            EndPaint(hwnd, &ps);
            return 0;
        }

        case WM_COMMAND: {
            switch (LOWORD(wParam)) {
                case IDC_SPLASH_OPENLOG:
                    ShellExecuteW(NULL, L"open", g_startup_log, NULL,
                                   NULL, SW_SHOWNORMAL);
                    break;
                case IDC_SPLASH_OPENBROWSER:
                    ShellExecuteW(NULL, L"open", g_ui_url, NULL,
                                   NULL, SW_SHOWNORMAL);
                    break;
                case IDC_SPLASH_RETRY: {
                    /* Kill existing backend, then restart sequence */
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
                    g_browser_launched_ok = FALSE;
                    g_last_error_code = ERR_NONE;
                    g_error_reason[0] = L'\0';
                    SetTimer(hwnd, IDT_HEALTH_POLL, 250, NULL);
                    SetTimer(hwnd, IDT_BROWSER_GUARD, 3000, NULL);
                    run_startup_sequence();
                    break;
                }
                case IDC_SPLASH_CLOSE:
                case IDCANCEL:
                    DestroyWindow(hwnd);
                    break;
            }
            return 0;
        }

        case WM_TIMER:
            if (wParam == IDT_HEALTH_POLL) {
                /* Periodic health probe — refresh splash status text */
                SetWindowTextW(GetDlgItem(hwnd, IDC_SPLASH_STATUS),
                               g_status_text);
                SetWindowTextW(GetDlgItem(hwnd, IDC_SPLASH_DETAIL),
                               g_diagnostic_text);
            } else if (wParam == IDT_BROWSER_GUARD) {
                KillTimer(hwnd, IDT_BROWSER_GUARD);
                if (verify_browser_alive()) {
                    write_log(L"Browser verified alive. Hiding splash window.");
                    ShowWindow(hwnd, SW_HIDE);
                } else {
                    build_diagnostic_text(L"BROWSER_VERIFY");
                    SetWindowTextW(GetDlgItem(hwnd, IDC_SPLASH_STATUS),
                                   L"Browser verification failed");
                    SetWindowTextW(GetDlgItem(hwnd, IDC_SPLASH_DETAIL),
                                   g_diagnostic_text);
                }
            }
            return 0;

        case WM_CLOSE:
            ShowWindow(hwnd, SW_HIDE);
            return 0;

        case WM_DESTROY:
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static HWND create_splash_window(HINSTANCE hInstance) {
    WNDCLASSW wc = {0};
    wc.lpfnWndProc   = SplashWndProc;
    wc.hInstance     = hInstance;
    wc.lpszClassName = L"AgenticOS_Splash";
    wc.hbrBackground = (HBRUSH)(COLOR_BTNFACE + 1);
    wc.hCursor       = LoadCursorW(NULL, IDC_ARROW);
    RegisterClassW(&wc);

    int sw = GetSystemMetrics(SM_CXSCREEN);
    int sh = GetSystemMetrics(SM_CYSCREEN);
    int w = 520, h = 400;

    HWND hwnd = CreateWindowExW(
        WS_EX_APPWINDOW | WS_EX_TOPMOST,
        wc.lpszClassName,
        L"AgenticOS — Desktop Mission Control",
        WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
        (sw - w) / 2, (sh - h) / 2, w, h,
        NULL, NULL, hInstance, NULL);

    ShowWindow(hwnd, SW_SHOWNORMAL);
    UpdateWindow(hwnd);
    return hwnd;
}

/* =========================================================================
 *   Failure Dialog (kept for compatibility / explicit diagnostic mode)
 * ========================================================================= */
#define IDC_BTN_COPY   1001
#define IDC_BTN_LOG    1002
#define IDC_BTN_RETRY  1003
#define IDC_BTN_CLOSE  1004

static BOOL CALLBACK SetChildFontProc(HWND hChild, LPARAM lParam) {
    SendMessageW(hChild, WM_SETFONT, lParam, TRUE);
    return TRUE;
}

static LRESULT CALLBACK FailureDlgProc(HWND hwnd, UINT msg,
                                        WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE: {
            CreateWindowW(L"STATIC", L"AgenticOS could not start.",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 20, 560, 30, hwnd, NULL, NULL, NULL);
            CreateWindowW(L"STATIC",
                L"Component: Backend Kernel / Browser Launch\nStatus: FAILED",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 58, 560, 40, hwnd, NULL, NULL, NULL);
            CreateWindowW(L"STATIC", L"Error Reason:",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 105, 560, 18, hwnd, NULL, NULL, NULL);
            CreateWindowW(L"STATIC", g_error_reason,
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 126, 560, 44, hwnd, NULL, NULL, NULL);
            CreateWindowW(L"STATIC", L"Diagnostic Details & Environment Trace:",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 175, 560, 18, hwnd, NULL, NULL, NULL);
            CreateWindowW(L"EDIT", g_diagnostic_text,
                WS_CHILD | WS_VISIBLE | WS_BORDER | WS_VSCROLL |
                ES_MULTILINE | ES_READONLY | ES_AUTOVSCROLL,
                24, 198, 555, 175, hwnd, NULL, NULL, NULL);
            CreateWindowW(L"STATIC", L"Log File:",
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                24, 385, 70, 20, hwnd, NULL, NULL, NULL);
            CreateWindowW(L"STATIC", g_startup_log,
                WS_CHILD | WS_VISIBLE | SS_LEFT,
                95, 385, 484, 20, hwnd, NULL, NULL, NULL);
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
            HFONT hFont = (HFONT)GetStockObject(DEFAULT_GUI_FONT);
            EnumChildWindows(hwnd, SetChildFontProc, (LPARAM)hFont);
            return 0;
        }
        case WM_COMMAND: {
            switch (LOWORD(wParam)) {
                case IDC_BTN_COPY: copy_diagnostic_to_clipboard(hwnd); break;
                case IDC_BTN_LOG:
                    ShellExecuteW(NULL, L"open", g_startup_log, NULL,
                                   NULL, SW_SHOWNORMAL);
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

static INT_PTR show_failure_ui(void) {
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
        620, 510, NULL, NULL, wc.hInstance, NULL);

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

/* =========================================================================
 *   Tray icon & supervisor window
 * ========================================================================= */
#define IDM_TRAY_OPEN    3001
#define IDM_TRAY_LOG     3002
#define IDM_TRAY_RESTART 3003
#define IDM_TRAY_EXIT    3004
#define IDM_TRAY_SPLASH   3005

static LRESULT CALLBACK SupervisorWndProc(HWND hwnd, UINT msg,
                                          WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_CREATE:
            SetTimer(hwnd, IDT_SUPERVISOR, 1000, NULL);
            return 0;

        case WM_TIMER:
            if (wParam == IDT_SUPERVISOR) {
                if (g_kernel_pi.hProcess) {
                    DWORD exit_code = 0;
                    if (GetExitCodeProcess(g_kernel_pi.hProcess, &exit_code)
                        && exit_code != STILL_ACTIVE) {
                        write_log(L"SUPERVISOR: Kernel exited with code %lu",
                                   exit_code);
                        CloseHandle(g_kernel_pi.hProcess);
                        CloseHandle(g_kernel_pi.hThread);
                        memset(&g_kernel_pi, 0, sizeof(g_kernel_pi));

                        WCHAR reason[256];
                        _snwprintf(reason, 255,
                            L"Kernel exited unexpectedly (Code: %lu)",
                            exit_code);
                        reason[255] = L'\0';
                        set_error(ERR_BACKEND_CRASHED, reason);
                        build_diagnostic_text(L"KERNEL_CRASHED");
                        if (g_splash_hwnd) {
                            ShowWindow(g_splash_hwnd, SW_SHOWNORMAL);
                            SetWindowTextW(
                                GetDlgItem(g_splash_hwnd, IDC_SPLASH_STATUS),
                                L"Kernel crashed");
                            SetWindowTextW(
                                GetDlgItem(g_splash_hwnd, IDC_SPLASH_DETAIL),
                                g_diagnostic_text);
                        } else {
                            show_failure_ui();
                        }
                    }
                }
            }
            return 0;

        case WM_TRAYICON:
            if (lParam == WM_LBUTTONDBLCLK || lParam == WM_LBUTTONUP) {
                if (g_splash_hwnd) {
                    ShowWindow(g_splash_hwnd, SW_SHOWNORMAL);
                    SetForegroundWindow(g_splash_hwnd);
                } else {
                    launch_ui();
                }
            } else if (lParam == WM_RBUTTONUP) {
                POINT pt;
                GetCursorPos(&pt);
                HMENU hMenu = CreatePopupMenu();
                AppendMenuW(hMenu, MF_STRING, IDM_TRAY_OPEN,
                             L"Open AgenticOS Mission Control");
                AppendMenuW(hMenu, MF_STRING, IDM_TRAY_SPLASH,
                             L"Show Diagnostics");
                AppendMenuW(hMenu, MF_SEPARATOR, 0, NULL);

                WCHAR status_item[128];
                _snwprintf(status_item, 127,
                    L"Kernel Port: %d  |  Frontend Port: %d",
                    g_kernel_port, g_frontend_port);
                status_item[127] = L'\0';
                AppendMenuW(hMenu, MF_STRING | MF_GRAYED, 0, status_item);

                AppendMenuW(hMenu, MF_STRING, IDM_TRAY_LOG,
                             L"Open Startup Log");
                AppendMenuW(hMenu, MF_STRING, IDM_TRAY_RESTART,
                             L"Restart Kernel");
                AppendMenuW(hMenu, MF_SEPARATOR, 0, NULL);
                AppendMenuW(hMenu, MF_STRING, IDM_TRAY_EXIT,
                             L"Exit AgenticOS");

                SetForegroundWindow(hwnd);
                TrackPopupMenu(hMenu, TPM_RIGHTBUTTON,
                                pt.x, pt.y, 0, hwnd, NULL);
                DestroyMenu(hMenu);
            }
            return 0;

        case WM_COMMAND:
            switch (LOWORD(wParam)) {
                case IDM_TRAY_OPEN: launch_ui(); break;
                case IDM_TRAY_SPLASH:
                    if (g_splash_hwnd) {
                        ShowWindow(g_splash_hwnd, SW_SHOWNORMAL);
                        SetForegroundWindow(g_splash_hwnd);
                    }
                    break;
                case IDM_TRAY_LOG:
                    ShellExecuteW(NULL, L"open", g_startup_log,
                                   NULL, NULL, SW_SHOWNORMAL);
                    break;
                case IDM_TRAY_RESTART: {
                    write_log(L"SUPERVISOR: Restart requested from tray.");
                    if (g_kernel_pi.hProcess) {
                        TerminateProcess(g_kernel_pi.hProcess, 0);
                        CloseHandle(g_kernel_pi.hProcess);
                        CloseHandle(g_kernel_pi.hThread);
                        memset(&g_kernel_pi, 0, sizeof(g_kernel_pi));
                    }
                    Sleep(500);
                    run_startup_sequence();
                    break;
                }
                case IDM_TRAY_EXIT: cleanup_and_exit(0); break;
            }
            return 0;

        case WM_DESTROY:
            KillTimer(hwnd, IDT_SUPERVISOR);
            if (g_tray_active) {
                Shell_NotifyIconW(NIM_DELETE, &g_nid);
                g_tray_active = FALSE;
            }
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(hwnd, msg, wParam, lParam);
}

static void init_supervisor_tray(HINSTANCE hInstance) {
    WNDCLASSW wc = {0};
    wc.lpfnWndProc = SupervisorWndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = L"AgenticOS_Supervisor";
    RegisterClassW(&wc);

    /* NOTE: still a message-only window for tray event routing, but
     * the splash window is the user-visible surface. */
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

/* =========================================================================
 *   Startup sequence (synchronous, called from main thread)
 * ========================================================================= */
static BOOL run_startup_sequence(void) {
    time_t start_time = time(NULL);
    write_log(L"============================================================");
    write_log(L"AgenticOS Desktop Mission Control Startup (v%s)", APP_VERSION);
    write_log(L"Executable Directory: %s", g_app_dir);
    write_log(L"Logs Directory:       %s", g_log_dir);
    write_log(L"Frontend URL target:  %s", g_ui_url);
    write_log(L"============================================================");

    set_status(L"Resolving backend binary...");

    DWORD pid = 0;
    if (!start_backend(&pid)) {
        build_diagnostic_text(L"BACKEND_START");
        return FALSE;
    }

    set_status(L"Backend launched — waiting for /healthz...");
    write_log(L"Polling /healthz (target: http://127.0.0.1:%d/healthz, timeout: %ds)",
              g_kernel_port, HEALTH_TIMEOUT_S);

    BOOL is_healthy = FALSE;
    int total_polls = HEALTH_TIMEOUT_S * 4;  /* 250ms each */
    for (int i = 0; i < total_polls; i++) {
        read_runtime_manifest();

        /* Check if backend died */
        DWORD exit_code = 0;
        if (GetExitCodeProcess(g_kernel_pi.hProcess, &exit_code)
            && exit_code != STILL_ACTIVE) {
            WCHAR reason[256];
            _snwprintf(reason, 255,
                L"Kernel terminated prematurely with exit code %lu",
                exit_code);
            reason[255] = L'\0';
            set_error(ERR_BACKEND_CRASHED, reason);
            break;
        }

        if (check_backend_health()) {
            is_healthy = TRUE;
            break;
        }

        /* Update splash status */
        WCHAR status_buf[256];
        _snwprintf(status_buf, 255,
            L"Waiting for backend... (%d/%ds)",
            i / 4, HEALTH_TIMEOUT_S);
        status_buf[255] = L'\0';
        set_status(status_buf);

        /* Pump messages so the splash window repaints. */
        pump_messages_briefly(250);
    }

    double elapsed = difftime(time(NULL), start_time);

    if (!is_healthy) {
        if (wcslen(g_error_reason) == 0) {
            WCHAR reason[256];
            _snwprintf(reason, 255,
                L"Backend health check timed out after %.1f seconds on port %d.",
                elapsed, g_kernel_port);
            reason[255] = L'\0';
            set_error(ERR_HEALTH_CHECK_TIMEOUT, reason);
        }
        build_diagnostic_text(L"HEALTH_TIMEOUT");
        return FALSE;
    }

    write_log(L"Backend HEALTHY after %.2fs. Kernel port=%d, Frontend port=%d",
              elapsed, g_kernel_port, g_frontend_port);
    set_status(L"Backend healthy — launching browser window...");

    /* Launch the UI window. */
    launch_ui();

    /* Give the browser a moment to spawn, then verify. */
    if (g_ui_pi.hProcess) {
        /* Wait briefly for the browser to settle. */
        WaitForSingleObject(g_ui_pi.hProcess, 1500);
        if (verify_browser_alive()) {
            write_log(L"Browser verified alive. Splash will hide.");
            g_browser_launched_ok = TRUE;
            build_diagnostic_text(L"READY");
            return TRUE;
        } else {
            build_diagnostic_text(L"BROWSER_VERIFY");
            return FALSE;
        }
    }

    /* ShellExecuteW path — assume success. */
    if (g_browser_launched_ok) {
        build_diagnostic_text(L"READY");
        return TRUE;
    }

    build_diagnostic_text(L"BROWSER_LAUNCH");
    return FALSE;
}

/* =========================================================================
 *   Cleanup & exit
 * ========================================================================= */
static void cleanup_and_exit(int code) {
    write_log(L"Shutting down AgenticOS Mission Control (exit code %d)...", code);

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

    if (g_splash_font) DeleteObject(g_splash_font);
    if (g_splash_title_font) DeleteObject(g_splash_title_font);

    ExitProcess(code);
}

/* =========================================================================
 *   WinMain
 * ========================================================================= */
int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance,
                    LPWSTR lpCmdLine, int nCmdShow) {
    (void)hPrevInstance;
    (void)lpCmdLine;

    /* 1. Single-instance mutex (multi-launch just focuses existing). */
    HANDLE hMutex = CreateMutexW(NULL, TRUE,
        L"Global\\AgenticOS_MissionControl_Instance_Mutex_v1");
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        HWND existing = FindWindowW(L"AgenticOS_Supervisor",
                                     L"AgenticOS Supervisor");
        if (existing) {
            PostMessageW(existing, WM_COMMAND,
                          MAKEWPARAM(IDM_TRAY_OPEN, 0), 0);
        } else {
            ShellExecuteW(NULL, L"open", L"http://127.0.0.1:3000",
                           NULL, NULL, SW_SHOWNORMAL);
        }
        return 0;
    }

    /* 2. Resolve install directory (where AgenticOS.exe lives). */
    GetModuleFileNameW(NULL, g_app_dir, MAX_PATH);
    PathRemoveFileSpecW(g_app_dir);

    /* 3. Resolve %LOCALAPPDATA%\AgenticOS for logs, workspace, security. */
    WCHAR local_app_data[MAX_PATH];
    if (SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0,
                          local_app_data) == S_OK) {
        _snwprintf(g_log_dir, MAX_PATH, L"%s\\AgenticOS", local_app_data);
        g_log_dir[MAX_PATH - 1] = L'\0';
        ensure_dir(g_log_dir);

        _snwprintf(g_log_dir, MAX_PATH, L"%s\\AgenticOS\\logs",
                    local_app_data);
        g_log_dir[MAX_PATH - 1] = L'\0';
        ensure_dir(g_log_dir);

        WCHAR ws_dir[MAX_PATH];
        _snwprintf(ws_dir, MAX_PATH, L"%s\\AgenticOS\\workspace",
                    local_app_data);
        ws_dir[MAX_PATH - 1] = L'\0';
        ensure_dir(ws_dir);

        WCHAR sec_dir[MAX_PATH];
        _snwprintf(sec_dir, MAX_PATH, L"%s\\AgenticOS\\security",
                    local_app_data);
        sec_dir[MAX_PATH - 1] = L'\0';
        ensure_dir(sec_dir);
    } else {
        _snwprintf(g_log_dir, MAX_PATH, L"%s\\logs", g_app_dir);
        g_log_dir[MAX_PATH - 1] = L'\0';
        ensure_dir(g_log_dir);
    }

    _snwprintf(g_startup_log, MAX_PATH, L"%s\\startup.log", g_log_dir);
    g_startup_log[MAX_PATH - 1] = L'\0';
    _snwprintf(g_kernel_log, MAX_PATH, L"%s\\kernel.log", g_log_dir);
    g_kernel_log[MAX_PATH - 1] = L'\0';
    _snwprintf(g_runtime_manifest, MAX_PATH, L"%s\\..\\runtime.json",
                g_log_dir);
    g_runtime_manifest[MAX_PATH - 1] = L'\0';

    /* 4. Job object: auto-kill kernel if supervisor dies. */
    g_job_object = CreateJobObjectW(NULL, NULL);
    if (g_job_object) {
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION jeli = {0};
        jeli.BasicLimitInformation.LimitFlags =
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE |
            JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK;
        SetInformationJobObject(g_job_object,
            JobObjectExtendedLimitInformation, &jeli, sizeof(jeli));
    }

    /* 5. Splash window — visible to the user IMMEDIATELY. */
    g_splash_hwnd = create_splash_window(hInstance);
    set_status(L"AgenticOS starting...");

    /* 6. Tray icon (for power-user access). */
    init_supervisor_tray(hInstance);

    /* 7. Run startup sequence. */
    BOOL ok = run_startup_sequence();

    /* 8. Pump messages on the supervisor so tray events are processed. */
    MSG msg;
    while (GetMessageW(&msg, NULL, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    cleanup_and_exit(ok ? 0 : 1);
    return 0;
}
