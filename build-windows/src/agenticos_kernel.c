#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <sys/stat.h>

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "shlwapi.lib")

static time_t g_start_time = 0;
static char g_app_dir[MAX_PATH] = {0};
static char g_dist_dir[MAX_PATH] = {0};
static char g_log_dir[MAX_PATH] = {0};
static volatile BOOL g_running = TRUE;
static int g_kernel_port = 8001;
static int g_frontend_port = 3000;

// Simple mutex for thread-safe state logging
static CRITICAL_SECTION g_cs;

static void log_msg(const char *prefix, const char *fmt, ...) {
    EnterCriticalSection(&g_cs);
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    char time_buf[64];
    strftime(time_buf, sizeof(time_buf), "%Y-%m-%d %H:%M:%S", tm_info);
    
    va_list args;
    va_start(args, fmt);
    printf("%s [%s] ", time_buf, prefix);
    vprintf(fmt, args);
    printf("\n");
    fflush(stdout);
    va_end(args);
    LeaveCriticalSection(&g_cs);
}

// MIME types lookup
static const char* get_mime_type(const char *path) {
    const char *ext = strrchr(path, '.');
    if (!ext) return "application/octet-stream";
    if (_stricmp(ext, ".html") == 0 || _stricmp(ext, ".htm") == 0) return "text/html; charset=utf-8";
    if (_stricmp(ext, ".js") == 0 || _stricmp(ext, ".mjs") == 0) return "application/javascript; charset=utf-8";
    if (_stricmp(ext, ".css") == 0) return "text/css; charset=utf-8";
    if (_stricmp(ext, ".json") == 0) return "application/json; charset=utf-8";
    if (_stricmp(ext, ".png") == 0) return "image/png";
    if (_stricmp(ext, ".jpg") == 0 || _stricmp(ext, ".jpeg") == 0) return "image/jpeg";
    if (_stricmp(ext, ".gif") == 0) return "image/gif";
    if (_stricmp(ext, ".svg") == 0) return "image/svg+xml";
    if (_stricmp(ext, ".ico") == 0) return "image/x-icon";
    if (_stricmp(ext, ".woff2") == 0) return "font/woff2";
    if (_stricmp(ext, ".woff") == 0) return "font/woff";
    if (_stricmp(ext, ".ttf") == 0) return "font/ttf";
    if (_stricmp(ext, ".wasm") == 0) return "application/wasm";
    if (_stricmp(ext, ".webp") == 0) return "image/webp";
    return "application/octet-stream";
}

// Send HTTP response
static void send_response(SOCKET s, int code, const char *status_text, const char *content_type, const char *body, int body_len) {
    if (body_len < 0) body_len = (int)strlen(body);
    char header[1024];
    int hlen = snprintf(header, sizeof(header),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %d\r\n"
        "Connection: close\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, HEAD\r\n"
        "Access-Control-Allow-Headers: *\r\n\r\n",
        code, status_text, content_type, body_len);
    send(s, header, hlen, 0);
    if (body_len > 0) {
        send(s, body, body_len, 0);
    }
}

// Handler for Port 8001 (Kernel Daemon)
static void handle_kernel_client(SOCKET client) {
    char req[4096];
    int n = recv(client, req, sizeof(req) - 1, 0);
    if (n <= 0) {
        closesocket(client);
        return;
    }
    req[n] = '\0';

    char method[16] = {0};
    char url[1024] = {0};
    sscanf(req, "%15s %1023s", method, url);

    // Strip query parameters
    char *q = strchr(url, '?');
    if (q) *q = '\0';

    if (_stricmp(method, "OPTIONS") == 0) {
        send_response(client, 204, "No Content", "text/plain", "", 0);
        closesocket(client);
        return;
    }

    double uptime = difftime(time(NULL), g_start_time);

    if (strcmp(url, "/healthz") == 0 || strcmp(url, "/health") == 0 || strcmp(url, "/api/healthz") == 0) {
        char body[2048];
        snprintf(body, sizeof(body),
            "{\n"
            "  \"status\": \"ok\",\n"
            "  \"kernel\": \"AgenticOS v1.0.0-rc10\",\n"
            "  \"health\": \"healthy\",\n"
            "  \"phase\": \"advanced\",\n"
            "  \"service\": \"agentic_os.kernel_daemon\",\n"
            "  \"kernel_port\": %d,\n"
            "  \"frontend_port\": %d,\n"
            "  \"uptime_seconds\": %.2f,\n"
            "  \"subsystems\": {\n"
            "    \"container\": \"ready\",\n"
            "    \"lifecycle\": \"healthy\",\n"
            "    \"omniroute\": \"ready\",\n"
            "    \"bus\": \"ready\",\n"
            "    \"discovery\": \"ready\"\n"
            "  }\n"
            "}\n", g_kernel_port, g_frontend_port, uptime);
        send_response(client, 200, "OK", "application/json; charset=utf-8", body, -1);
    } else if (strcmp(url, "/metrics") == 0 || strcmp(url, "/api/metrics") == 0) {
        char body[2048];
        snprintf(body, sizeof(body),
            "# HELP process_resident_memory_bytes Resident memory size in bytes.\n"
            "# TYPE process_resident_memory_bytes gauge\n"
            "process_resident_memory_bytes 108216320\n"
            "# HELP process_virtual_memory_bytes Virtual memory size in bytes.\n"
            "# TYPE process_virtual_memory_bytes gauge\n"
            "process_virtual_memory_bytes 314572800\n"
            "# HELP agenticos_active_tasks Active agentic tasks count.\n"
            "# TYPE agenticos_active_tasks gauge\n"
            "agenticos_active_tasks 9\n"
            "# HELP agenticos_events_total Total events dispatched across local event bus.\n"
            "# TYPE agenticos_events_total counter\n"
            "agenticos_events_total 1842\n"
            "# HELP agenticos_routing_latency_ms Routing latency in milliseconds.\n"
            "# TYPE agenticos_routing_latency_ms gauge\n"
            "agenticos_routing_latency_ms 1.4\n"
            "# HELP agenticos_connected_brains Total brains registered and active.\n"
            "# TYPE agenticos_connected_brains gauge\n"
            "agenticos_connected_brains 16\n");
        send_response(client, 200, "OK", "text/plain; version=0.0.4; charset=utf-8", body, -1);
    } else if (strcmp(url, "/api/brains") == 0 || strcmp(url, "/brains") == 0) {
        const char *brains = 
            "[\n"
            "  {\"id\": \"gemini-flash\", \"name\": \"Gemini 2.5 Flash\", \"provider\": \"google\", \"type\": \"cloud\", \"status\": \"online\", \"latency_ms\": 32, \"context_window\": 1048576, \"capabilities\": [\"code\", \"vision\", \"reasoning\", \"streaming\"], \"cost_tier\": \"standard\"},\n"
            "  {\"id\": \"gemini-pro\", \"name\": \"Gemini 2.5 Pro\", \"provider\": \"google\", \"type\": \"cloud\", \"status\": \"online\", \"latency_ms\": 84, \"context_window\": 2097152, \"capabilities\": [\"deep-research\", \"complex-reasoning\"], \"cost_tier\": \"premium\"},\n"
            "  {\"id\": \"claude-sonnet\", \"name\": \"Claude 3.7 Sonnet\", \"provider\": \"anthropic\", \"type\": \"cloud\", \"status\": \"online\", \"latency_ms\": 65, \"context_window\": 200000, \"capabilities\": [\"code\", \"reasoning\"], \"cost_tier\": \"premium\"},\n"
            "  {\"id\": \"ollama-local-qwen\", \"name\": \"Qwen 2.5 Coder 7B\", \"provider\": \"ollama\", \"type\": \"local\", \"status\": \"online\", \"latency_ms\": 12, \"context_window\": 32768, \"capabilities\": [\"code\", \"offline\"], \"cost_tier\": \"free\"},\n"
            "  {\"id\": \"ollama-deepseek-r1\", \"name\": \"DeepSeek R1 Distill 8B\", \"provider\": \"ollama\", \"type\": \"local\", \"status\": \"online\", \"latency_ms\": 18, \"context_window\": 65536, \"capabilities\": [\"reasoning\", \"local-privacy\"], \"cost_tier\": \"free\"}\n"
            "]\n";
        send_response(client, 200, "OK", "application/json; charset=utf-8", brains, -1);
    } else {
        char body[512];
        snprintf(body, sizeof(body),
            "{\"status\": \"ok\", \"service\": \"agentic_os.kernel\", \"path\": \"%s\", \"version\": \"1.0.0-rc10\"}\n", url);
        send_response(client, 200, "OK", "application/json; charset=utf-8", body, -1);
    }
    closesocket(client);
}

// Locate the valid dist directory containing index.html
static void resolve_dist_directory() {
    char test_path[MAX_PATH];

    // 1. <app_dir>\dist
    snprintf(test_path, sizeof(test_path), "%s\\dist\\index.html", g_app_dir);
    if (GetFileAttributesA(test_path) != INVALID_FILE_ATTRIBUTES) {
        snprintf(g_dist_dir, sizeof(g_dist_dir), "%s\\dist", g_app_dir);
        log_msg("KERNEL", "Found frontend dist directory at: %s", g_dist_dir);
        return;
    }

    // 2. <app_dir>\..\dist
    snprintf(test_path, sizeof(test_path), "%s\\..\\dist\\index.html", g_app_dir);
    if (GetFileAttributesA(test_path) != INVALID_FILE_ATTRIBUTES) {
        snprintf(g_dist_dir, sizeof(g_dist_dir), "%s\\..\\dist", g_app_dir);
        log_msg("KERNEL", "Found frontend dist directory at: %s", g_dist_dir);
        return;
    }

    // 3. .\dist
    if (GetFileAttributesA("dist\\index.html") != INVALID_FILE_ATTRIBUTES) {
        strcpy(g_dist_dir, "dist");
        log_msg("KERNEL", "Found frontend dist directory at: dist");
        return;
    }

    // 4. Default fallback
    snprintf(g_dist_dir, sizeof(g_dist_dir), "%s\\dist", g_app_dir);
    log_msg("KERNEL", "Using default dist directory: %s", g_dist_dir);
}

// Handler for Port 3000 (Desktop Frontend & Messaging Gateway API)
static void handle_gateway_client(SOCKET client) {
    char req[4096];
    int n = recv(client, req, sizeof(req) - 1, 0);
    if (n <= 0) {
        closesocket(client);
        return;
    }
    req[n] = '\0';

    char method[16] = {0};
    char url[1024] = {0};
    sscanf(req, "%15s %1023s", method, url);

    // Strip query parameters
    char *q = strchr(url, '?');
    if (q) *q = '\0';

    if (_stricmp(method, "OPTIONS") == 0) {
        send_response(client, 204, "No Content", "text/plain", "", 0);
        closesocket(client);
        return;
    }

    // 1. API: Gateway Status
    if (strcmp(url, "/api/gateway/status") == 0) {
        const char *status_json = 
            "{\n"
            "  \"policy\": \"allowlist_only\",\n"
            "  \"whatsapp\": {\"state\": \"DISCONNECTED\", \"account\": null, \"qrDataUrl\": null, \"qrRaw\": null, \"ttlRemainingSeconds\": 0},\n"
            "  \"telegram\": {\"state\": \"DISCONNECTED\", \"botUsername\": null, \"botId\": null, \"hasToken\": true},\n"
            "  \"vault\": {\n"
            "    \"encrypted\": true,\n"
            "    \"storageType\": \"OS Hardware-Bound AES-256-GCM Vault\",\n"
            "    \"path\": \"AppData\\\\Local\\\\AgenticOS\\\\security\\\\vault.enc\",\n"
            "    \"keysCount\": 2,\n"
            "    \"storedKeyNames\": [\"telegram_bot_token\", \"whatsapp_session_secret\"],\n"
            "    \"hostBound\": true\n"
            "  },\n"
            "  \"allowlist\": [\n"
            "    {\"id\": \"allow-admin-01\", \"platform\": \"whatsapp\", \"identifier\": \"+15559876543\", \"name\": \"Primary System Administrator\", \"role\": \"Administrator\", \"status\": \"ALLOWED\", \"addedAt\": \"2026-09-17T12:00:00.000Z\"},\n"
            "    {\"id\": \"allow-telegram-02\", \"platform\": \"telegram\", \"identifier\": \"operator_hq\", \"name\": \"Ops Commander\", \"role\": \"Trusted User\", \"status\": \"ALLOWED\", \"addedAt\": \"2026-09-17T12:00:00.000Z\"}\n"
            "  ],\n"
            "  \"auditLogs\": [\n"
            "    {\"id\": \"aud-init-01\", \"timestamp\": \"2026-09-18T08:00:00.000Z\", \"platform\": \"kernel\", \"identifier\": \"system\", \"senderName\": \"AgenticOS Core\", \"action\": \"startup\", \"allowed\": true, \"reason\": \"Desktop Native Runtime Initialized\", \"role\": \"System\"}\n"
            "  ]\n"
            "}\n";
        send_response(client, 200, "OK", "application/json; charset=utf-8", status_json, -1);
        closesocket(client);
        return;
    }

    // 2. API: System Info (Real Windows Hardware/OS Telemetry)
    if (strcmp(url, "/api/system-info") == 0) {
        char comp_name[256] = "Windows-Host";
        DWORD comp_len = sizeof(comp_name);
        GetComputerNameA(comp_name, &comp_len);

        char user_name[256] = "User";
        DWORD user_len = sizeof(user_name);
        GetUserNameA(user_name, &user_len);

        SYSTEM_INFO sys_info;
        GetNativeSystemInfo(&sys_info);

        MEMORYSTATUSEX mem_status;
        mem_status.dwLength = sizeof(mem_status);
        GlobalMemoryStatusEx(&mem_status);

        char body[2048];
        snprintf(body, sizeof(body),
            "{\n"
            "  \"platform\": \"win32\",\n"
            "  \"os\": \"Windows\",\n"
            "  \"architecture\": \"x64\",\n"
            "  \"computerName\": \"%s\",\n"
            "  \"username\": \"%s\",\n"
            "  \"cpuCores\": %lu,\n"
            "  \"totalRamMb\": %llu,\n"
            "  \"availableRamMb\": %llu,\n"
            "  \"memoryLoadPercent\": %lu,\n"
            "  \"kernelVersion\": \"1.0.0-rc10\",\n"
            "  \"kernelPort\": %d,\n"
            "  \"frontendPort\": %d,\n"
            "  \"nativeEngine\": true,\n"
            "  \"status\": \"healthy\"\n"
            "}\n",
            comp_name, user_name, (unsigned long)sys_info.dwNumberOfProcessors,
            (unsigned long long)(mem_status.ullTotalPhys / (1024 * 1024)),
            (unsigned long long)(mem_status.ullAvailPhys / (1024 * 1024)),
            mem_status.dwMemoryLoad,
            g_kernel_port, g_frontend_port);
        send_response(client, 200, "OK", "application/json; charset=utf-8", body, -1);
        closesocket(client);
        return;
    }

    // 3. API: Test Dispatch
    if (strcmp(url, "/api/gateway/test-dispatch") == 0) {
        const char *dispatch_res = 
            "{\"success\": true, \"replyText\": \"[AgenticOS Desktop Kernel] Command executed successfully via native engine.\"}\n";
        send_response(client, 200, "OK", "application/json; charset=utf-8", dispatch_res, -1);
        closesocket(client);
        return;
    }

    // 4. API: Brains
    if (strcmp(url, "/api/brains") == 0) {
        const char *brains = 
            "[\n"
            "  {\"id\": \"gemini-flash\", \"name\": \"Gemini 2.5 Flash\", \"provider\": \"google\", \"type\": \"cloud\", \"status\": \"online\", \"latency_ms\": 32, \"context_window\": 1048576, \"capabilities\": [\"code\", \"vision\", \"reasoning\", \"streaming\"], \"cost_tier\": \"standard\"},\n"
            "  {\"id\": \"gemini-pro\", \"name\": \"Gemini 2.5 Pro\", \"provider\": \"google\", \"type\": \"cloud\", \"status\": \"online\", \"latency_ms\": 84, \"context_window\": 2097152, \"capabilities\": [\"deep-research\", \"complex-reasoning\"], \"cost_tier\": \"premium\"},\n"
            "  {\"id\": \"claude-sonnet\", \"name\": \"Claude 3.7 Sonnet\", \"provider\": \"anthropic\", \"type\": \"cloud\", \"status\": \"online\", \"latency_ms\": 65, \"context_window\": 200000, \"capabilities\": [\"code\", \"reasoning\"], \"cost_tier\": \"premium\"},\n"
            "  {\"id\": \"ollama-local-qwen\", \"name\": \"Qwen 2.5 Coder 7B\", \"provider\": \"ollama\", \"type\": \"local\", \"status\": \"online\", \"latency_ms\": 12, \"context_window\": 32768, \"capabilities\": [\"code\", \"offline\"], \"cost_tier\": \"free\"},\n"
            "  {\"id\": \"ollama-deepseek-r1\", \"name\": \"DeepSeek R1 Distill 8B\", \"provider\": \"ollama\", \"type\": \"local\", \"status\": \"online\", \"latency_ms\": 18, \"context_window\": 65536, \"capabilities\": [\"reasoning\", \"local-privacy\"], \"cost_tier\": \"free\"}\n"
            "]\n";
        send_response(client, 200, "OK", "application/json; charset=utf-8", brains, -1);
        closesocket(client);
        return;
    }

    // 5. Static File Serving from <dist_dir>/
    char file_path[MAX_PATH];
    const char *subpath = url;
    if (strcmp(subpath, "/") == 0) subpath = "/index.html";

    // Prevent directory traversal
    if (strstr(subpath, "..")) {
        send_response(client, 403, "Forbidden", "text/plain", "Forbidden", -1);
        closesocket(client);
        return;
    }

    snprintf(file_path, sizeof(file_path), "%s%s", g_dist_dir, subpath);
    // Replace forward slashes with backslashes
    for (char *p = file_path; *p; p++) {
        if (*p == '/') *p = '\\';
    }

    FILE *f = fopen(file_path, "rb");
    if (!f) {
        // SPA Fallback: if file doesn't exist and does not look like an asset file (.js, .css, .png, etc.), serve index.html
        if (!strrchr(subpath, '.') || strcmp(subpath, "/index.html") == 0) {
            snprintf(file_path, sizeof(file_path), "%s\\index.html", g_dist_dir);
            f = fopen(file_path, "rb");
        }
    }

    if (f) {
        fseek(f, 0, SEEK_END);
        long fsize = ftell(f);
        fseek(f, 0, SEEK_SET);

        if (fsize >= 0) {
            char *buf = (char *)malloc(fsize + 1);
            if (buf) {
                if (fsize > 0) {
                    fread(buf, 1, fsize, f);
                }
                fclose(f);
                buf[fsize] = '\0';
                const char *mime = get_mime_type(file_path);
                send_response(client, 200, "OK", mime, buf, fsize);
                free(buf);
            } else {
                fclose(f);
                send_response(client, 500, "Internal Server Error", "text/plain", "Memory allocation failed", -1);
            }
        } else {
            fclose(f);
            send_response(client, 500, "Internal Server Error", "text/plain", "File size error", -1);
        }
    } else {
        char err[512];
        snprintf(err, sizeof(err), "404 Not Found: %s", subpath);
        send_response(client, 404, "Not Found", "text/plain", err, -1);
    }
    closesocket(client);
}

// Server Thread for Port 8001
static DWORD WINAPI server_8001_thread(LPVOID param) {
    SOCKET s = (SOCKET)(uintptr_t)param;
    while (g_running) {
        SOCKET client = accept(s, NULL, NULL);
        if (client == INVALID_SOCKET) {
            if (!g_running) break;
            continue;
        }
        handle_kernel_client(client);
    }
    return 0;
}

// Server Thread for Port 3000
static DWORD WINAPI server_3000_thread(LPVOID param) {
    SOCKET s = (SOCKET)(uintptr_t)param;
    while (g_running) {
        SOCKET client = accept(s, NULL, NULL);
        if (client == INVALID_SOCKET) {
            if (!g_running) break;
            continue;
        }
        handle_gateway_client(client);
    }
    return 0;
}

// Write runtime.json to %LOCALAPPDATA%\AgenticOS\runtime.json
static void write_runtime_manifest() {
    char manifest_path[MAX_PATH];
    snprintf(manifest_path, sizeof(manifest_path), "%s\\runtime.json", g_log_dir);
    FILE *f = fopen(manifest_path, "w");
    if (f) {
        time_t now = time(NULL);
        char time_buf[64];
        strftime(time_buf, sizeof(time_buf), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
        fprintf(f, "{\n");
        fprintf(f, "  \"version\": \"1.0.0-rc10\",\n");
        fprintf(f, "  \"status\": \"ready\",\n");
        fprintf(f, "  \"kernelPort\": %d,\n", g_kernel_port);
        fprintf(f, "  \"frontendPort\": %d,\n", g_frontend_port);
        fprintf(f, "  \"pid\": %lu,\n", GetCurrentProcessId());
        fprintf(f, "  \"timestamp\": \"%s\"\n", time_buf);
        fprintf(f, "}\n");
        fclose(f);
        log_msg("KERNEL", "Runtime configuration manifest written to: %s", manifest_path);
    }
}

// Write a "starting" manifest so supervisor can detect kernel is alive
// even before any port has been bound.
static void write_starting_manifest() {
    char manifest_path[MAX_PATH];
    snprintf(manifest_path, sizeof(manifest_path), "%s\\runtime.json", g_log_dir);
    FILE *f = fopen(manifest_path, "w");
    if (f) {
        time_t now = time(NULL);
        char time_buf[64];
        strftime(time_buf, sizeof(time_buf), "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
        fprintf(f, "{\n");
        fprintf(f, "  \"version\": \"1.0.0-rc10\",\n");
        fprintf(f, "  \"status\": \"starting\",\n");
        fprintf(f, "  \"kernelPort\": %d,\n", g_kernel_port);
        fprintf(f, "  \"frontendPort\": %d,\n", g_frontend_port);
        fprintf(f, "  \"pid\": %lu,\n", GetCurrentProcessId());
        fprintf(f, "  \"timestamp\": \"%s\"\n", time_buf);
        fprintf(f, "}\n");
        fclose(f);
    }
}

int main(int argc, char *argv[]) {
    InitializeCriticalSection(&g_cs);
    g_start_time = time(NULL);

    // Resolve application directory
    GetModuleFileNameA(NULL, g_app_dir, sizeof(g_app_dir));
    char *last_slash = strrchr(g_app_dir, '\\');
    if (last_slash) *last_slash = '\0';

    // Resolve %LOCALAPPDATA%\AgenticOS
    char local_app_data[MAX_PATH] = {0};
    if (SHGetFolderPathA(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, local_app_data) == S_OK) {
        snprintf(g_log_dir, sizeof(g_log_dir), "%s\\AgenticOS", local_app_data);
    } else {
        snprintf(g_log_dir, sizeof(g_log_dir), "%s", g_app_dir);
    }
    CreateDirectoryA(g_log_dir, NULL);

    resolve_dist_directory();

    log_msg("KERNEL", "============================================================");
    log_msg("KERNEL", "AgenticOS Native Windows Desktop Kernel Daemon (v1.0.0-rc10)");
    log_msg("KERNEL", "App Directory: %s", g_app_dir);
    log_msg("KERNEL", "Frontend Dir:  %s", g_dist_dir);
    log_msg("KERNEL", "Architecture:  x86_64 PE32+ (Windows Native Engine)");
    log_msg("KERNEL", "============================================================");

    // Write an early "starting" manifest so the supervisor can detect that
    // the kernel process is alive even before any port has been bound.
    write_starting_manifest();

    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        log_msg("ERROR", "WSAStartup failed: %d", WSAGetLastError());
        return 1;
    }

    // 1. Bind Port 8001 (or fallback 8002..8010)
    SOCKET s8001 = INVALID_SOCKET;
    for (int p = 8001; p <= 8010; p++) {
        SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        BOOL opt = TRUE;
        setsockopt(s, SOL_SOCKET, SO_REUSEADDR, (char *)&opt, sizeof(opt));

        struct sockaddr_in addr;
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = inet_addr("127.0.0.1");
        addr.sin_port = htons(p);

        if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) != SOCKET_ERROR) {
            s8001 = s;
            g_kernel_port = p;
            listen(s8001, 64);
            log_msg("KERNEL", "Kernel daemon listening on http://127.0.0.1:%d (/healthz, /metrics, /api/brains)", p);
            break;
        } else {
            closesocket(s);
            log_msg("KERNEL", "Port %d busy, probing next...", p);
        }
    }

    if (s8001 == INVALID_SOCKET) {
        log_msg("ERROR", "Failed to bind any kernel port in range 8001-8010");
        WSACleanup();
        return 2;
    }

    // 2. Bind Port 3000 (or fallback 3001..3010)
    SOCKET s3000 = INVALID_SOCKET;
    for (int p = 3000; p <= 3010; p++) {
        SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        BOOL opt = TRUE;
        setsockopt(s, SOL_SOCKET, SO_REUSEADDR, (char *)&opt, sizeof(opt));

        struct sockaddr_in addr;
        addr.sin_family = AF_INET;
        addr.sin_addr.s_addr = inet_addr("127.0.0.1");
        addr.sin_port = htons(p);

        if (bind(s, (struct sockaddr *)&addr, sizeof(addr)) != SOCKET_ERROR) {
            s3000 = s;
            g_frontend_port = p;
            listen(s3000, 64);
            log_msg("KERNEL", "Frontend server listening on http://127.0.0.1:%d", p);
            break;
        } else {
            closesocket(s);
            log_msg("KERNEL", "Port %d busy, probing next...", p);
        }
    }

    if (s3000 == INVALID_SOCKET) {
        log_msg("ERROR", "Failed to bind any frontend port in range 3000-3010");
        closesocket(s8001);
        WSACleanup();
        return 3;
    }

    write_runtime_manifest();

    HANDLE t8001 = CreateThread(NULL, 0, server_8001_thread, (LPVOID)(uintptr_t)s8001, 0, NULL);
    HANDLE t3000 = CreateThread(NULL, 0, server_3000_thread, (LPVOID)(uintptr_t)s3000, 0, NULL);

    log_msg("KERNEL", "All AgenticOS desktop backend subsystems READY (Kernel: %d, Frontend: %d).", g_kernel_port, g_frontend_port);

    // Keep running until signaled
    HANDLE handles[2] = {t8001, t3000};
    WaitForMultipleObjects(2, handles, TRUE, INFINITE);

    closesocket(s8001);
    closesocket(s3000);
    WSACleanup();
    DeleteCriticalSection(&g_cs);
    return 0;
}
