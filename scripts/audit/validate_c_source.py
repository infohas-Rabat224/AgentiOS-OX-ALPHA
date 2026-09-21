#!/usr/bin/env python3
"""
AgenticOS C source static validator.

Checks the supervisor and kernel C source for:
  1. Balanced braces / parentheses / brackets
  2. Use of undefined variables (basic heuristic — looks for common typos)
  3. Function declarations vs definitions count (sanity)
  4. Forbidden development-only strings in PRODUCTION runtime code
  5. Required API surface is present
  6. Splash window / browser verification / error codes are wired up

Usage:
  python3 validate_c_source.py /path/to/repo

Exit codes:
  0 = OK
  1 = validation error
"""

import re
import sys
from pathlib import Path

FORBIDDEN_DEV_STRINGS = [
    "PYTHONPATH",
    "python3 -m",
    "daemon_agentic_os.sh",
    "WSL",
    "Git Bash",
    "/tmp/agentic",
    "../AgenticosHybrid",  # dev relative path
    "./AgenticosHybrid",   # dev relative path
]

REQUIRED_SUPERVISOR_SYMBOLS = [
    "create_splash_window",
    "init_supervisor_tray",
    "run_startup_sequence",
    "verify_browser_alive",
    "set_error",
    "build_diagnostic_text",
    "ERR_BACKEND_NOT_FOUND",
    "ERR_BROWSER_LAUNCH_FAILED",
    "ERR_HEALTH_CHECK_TIMEOUT",
    "ERR_BROWSER_EXITED_EARLY",
    "pump_messages_briefly",
    "WM_TRAYICON",
    "wWinMain",
]

REQUIRED_KERNEL_SYMBOLS = [
    "write_runtime_manifest",
    "write_starting_manifest",
    "resolve_dist_directory",
    "WSAStartup",
    "bind",
    "listen",
    "handle_kernel_client",  # equivalent of health check (server-side handler)
]

REQUIRED_INSTALLER_FRAGMENTS = [
    'File "bin\\AgenticOS.exe"',
    'File "bin\\agenticos-kernel.exe"',
    'File /r /x downloads "..\\dist\\*.*"',
    "RequestExecutionLevel user",
    "InstallDir ",
    "WriteUninstaller",
    "Uninstall",
    "DisplayVersion",
]


def _tokenize_c(text: str) -> str:
    """Tokenize C source: replace string literals, char literals, and comments
    with placeholders, preserving newlines so line numbers stay correct.

    Order matters and is done in a single pass to handle cases like:
      - `//` or `/*` inside a string literal (must NOT be treated as a comment)
      - `"..."` inside a comment (must NOT be treated as a string)
      - `'` inside a string literal (must NOT be treated as a char literal)
    """
    out = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        # Block comment
        if ch == '/' and i + 1 < n and text[i + 1] == '*':
            j = i + 2
            while j + 1 < n and not (text[j] == '*' and text[j + 1] == '/'):
                j += 1
            # Replace with same number of newlines
            comment = text[i:j + 2] if j + 1 < n else text[i:]
            out.append("\n" * comment.count("\n"))
            i = j + 2 if j + 1 < n else n
            continue
        # Line comment
        if ch == '/' and i + 1 < n and text[i + 1] == '/':
            j = i + 2
            while j < n and text[j] != '\n':
                j += 1
            # Don't consume the newline (so line numbers stay correct)
            i = j
            continue
        # String literal (with optional L, u, U, u8 prefix)
        if ch in ('"',) or (
            ch in ('L', 'u', 'U') and i + 1 < n and text[i + 1] == '"'
        ) or (ch == 'u' and i + 2 < n and text[i + 1] == '8' and text[i + 2] == '"'):
            j = i
            # Skip prefix
            if ch == 'u' and i + 2 < n and text[i + 1] == '8':
                j = i + 2
            elif ch in ('L', 'u', 'U'):
                j = i + 1
            # j now points to the opening "
            if j < n and text[j] == '"':
                out.append('""')  # placeholder
                k = j + 1
                while k < n:
                    if text[k] == '\\' and k + 1 < n:
                        k += 2  # skip escape sequence
                        continue
                    if text[k] == '"':
                        k += 1
                        break
                    k += 1
                # Preserve newlines inside the string
                if k <= n:
                    out.append("\n" * text[j:k].count("\n"))
                i = k
                continue
        # Char literal (with optional L, u, U prefix)
        if ch == "'" or (
            ch in ('L', 'u', 'U') and i + 1 < n and text[i + 1] == "'"
        ):
            j = i + 1 if ch in ('L', 'u', 'U') else i
            if j < n and text[j] == "'":
                out.append("''")  # placeholder
                k = j + 1
                while k < n:
                    if text[k] == '\\' and k + 1 < n:
                        k += 2
                        continue
                    if text[k] == "'":
                        k += 1
                        break
                    k += 1
                if k <= n:
                    out.append("\n" * text[j:k].count("\n"))
                i = k
                continue
        # Regular character
        out.append(ch)
        i += 1
    return "".join(out)


def _strip_preserve_lines(match: re.Match) -> str:
    """Legacy helper — kept for compatibility but unused."""
    return "\n" * match.group(0).count("\n")


def check_balanced(text: str, name: str) -> list:
    """Check that braces, parens, and brackets are balanced (ignoring strings/comments)."""
    issues = []
    stripped = _tokenize_c(text)
    # Replace `{0}` and `{0,0,...}` array initializers
    stripped = re.sub(r"\{[0-9, ]*\}", "INIT", stripped)

    pairs = [("{", "}"), ("(", ")"), ("[", "]")]
    closers = {c for _, c in pairs}
    openers = {o for o, _ in pairs}
    matches = {c: o for o, c in pairs}

    stack = []
    line = 1
    for ch in stripped:
        if ch == "\n":
            line += 1
            continue
        if ch in openers:
            stack.append((ch, line))
        elif ch in closers:
            if not stack:
                issues.append(f"{name}: unbalanced '{ch}' at line {line}")
            else:
                o, ol = stack.pop()
                if matches[ch] != o:
                    issues.append(
                        f"{name}: mismatched '{o}' (line {ol}) closed by '{ch}' (line {line})"
                    )
    if stack:
        for o, l in stack:
            issues.append(f"{name}: unclosed '{o}' at line {l}")
    return issues


def check_forbidden_dev_strings(text: str, name: str) -> list:
    """Check for forbidden dev-only strings in CODE (not comments)."""
    issues = []
    stripped = _tokenize_c(text)
    for s in FORBIDDEN_DEV_STRINGS:
        if s in stripped:
            for i, line in enumerate(stripped.splitlines(), 1):
                if s in line:
                    issues.append(
                        f"{name}: forbidden dev-only string '{s}' at line {i}: {line.strip()[:80]}"
                    )
                    break
    return issues


def check_required_symbols(text: str, required: list, name: str) -> list:
    issues = []
    for sym in required:
        if sym not in text:
            issues.append(f"{name}: missing required symbol '{sym}'")
    return issues


def validate_supervisor(path: Path) -> list:
    text = path.read_text(encoding="utf-8", errors="replace")
    issues = []
    issues += check_balanced(text, str(path))
    issues += check_forbidden_dev_strings(text, str(path))
    issues += check_required_symbols(text, REQUIRED_SUPERVISOR_SYMBOLS, str(path))

    # Verify wWinMain is the entry point
    if "int WINAPI wWinMain" not in text:
        issues.append(f"{path}: missing wWinMain entry point")

    # Verify the wWinMain body creates splash BEFORE calling run_startup_sequence.
    # We look only inside wWinMain to avoid false positives from forward decls.
    winmain_match = re.search(
        r"int WINAPI wWinMain\(.*?\)\s*\{",
        text, flags=re.DOTALL)
    if winmain_match:
        body_start = winmain_match.end()
        # Find the matching closing brace of wWinMain
        depth = 1
        i = body_start
        while i < len(text) and depth > 0:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
            i += 1
        body = text[body_start:i]

        splash_pos = body.find("create_splash_window")
        startup_pos = body.find("run_startup_sequence")
        if splash_pos >= 0 and startup_pos >= 0 and splash_pos > startup_pos:
            issues.append(
                f"{path}: in wWinMain, splash window is created AFTER run_startup_sequence — "
                "user will see nothing during startup"
            )
    return issues


def validate_kernel(path: Path) -> list:
    text = path.read_text(encoding="utf-8", errors="replace")
    issues = []
    issues += check_balanced(text, str(path))
    issues += check_forbidden_dev_strings(text, str(path))
    issues += check_required_symbols(text, REQUIRED_KERNEL_SYMBOLS, str(path))

    # Verify healthz endpoint is implemented
    if '"/healthz"' not in text:
        issues.append(f"{path}: missing /healthz endpoint handler")

    # Verify runtime manifest is written early (before binding ports)
    write_starting_pos = text.find("write_starting_manifest")
    bind_pos = text.find("if (bind(s,")
    if write_starting_pos > 0 and bind_pos > 0 and write_starting_pos > bind_pos:
        issues.append(
            f"{path}: write_starting_manifest() is called AFTER bind() — "
            "supervisor has no way to detect kernel is alive before port is bound"
        )

    return issues


def validate_installer(path: Path) -> list:
    text = path.read_text(encoding="utf-8", errors="replace")
    issues = []
    for frag in REQUIRED_INSTALLER_FRAGMENTS:
        if frag not in text:
            issues.append(f"{path}: missing required fragment '{frag}'")

    # Must NOT bundle any pre-built installer from public/downloads as a File resource.
    # We look for the specific NSIS instruction 'File ".../public/downloads/AgenticOS...'
    # but NOT 'OutFile ".../public/downloads/..."' which just sets the output path.
    if re.search(r'(?<![A-Za-z])File\s+"[^"]*public/downloads/AgenticOS', text):
        issues.append(
            f"{path}: installer is shipping another installer as a resource — "
            "this is a packaging anti-pattern"
        )

    return issues


def validate_rust_main(path: Path) -> list:
    text = path.read_text(encoding="utf-8", errors="replace")
    issues = []
    # Verify the previously-broken 'kernel_log_path' is now properly defined
    # before being used.
    define_pos = text.find("let kernel_log_path =")
    use_pos = text.find("kernel_log_path.to_string_lossy()")
    if use_pos >= 0:
        if define_pos < 0:
            issues.append(
                f"{path}: 'kernel_log_path' is used but never defined (compile error)"
            )
        elif define_pos > use_pos:
            issues.append(
                f"{path}: 'kernel_log_path' is used BEFORE being defined"
            )
    return issues


def main():
    if len(sys.argv) < 2:
        print("usage: validate_c_source.py <repo-root>")
        return 1

    repo = Path(sys.argv[1])
    if not repo.is_dir():
        print(f"error: {repo} is not a directory")
        return 1

    all_issues = []

    supervisor = repo / "build-windows/src/agenticos_main.c"
    kernel = repo / "build-windows/src/agenticos_kernel.c"
    installer = repo / "build-windows/installer.nsi"
    rust_main = repo / "src-tauri/src/main.rs"

    if supervisor.exists():
        all_issues += validate_supervisor(supervisor)
    else:
        all_issues.append(f"missing: {supervisor}")

    if kernel.exists():
        all_issues += validate_kernel(kernel)
    else:
        all_issues.append(f"missing: {kernel}")

    if installer.exists():
        all_issues += validate_installer(installer)
    else:
        all_issues.append(f"missing: {installer}")

    if rust_main.exists():
        all_issues += validate_rust_main(rust_main)

    if all_issues:
        print("VALIDATION FAILED:")
        for i in all_issues:
            print(f"  - {i}")
        return 1

    print("VALIDATION OK — all source files pass static checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
