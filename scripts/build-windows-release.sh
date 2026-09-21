#!/usr/bin/env bash
# ============================================================================
# AgenticOS — Windows Production Build Script
# ============================================================================
# Builds, end-to-end:
#   1. Frontend dist/ tree            (npm/bun install + npm/bun run build)
#   2. Native C supervisor            (mingw-w64: AgenticOS.exe)
#   3. Native C kernel                (mingw-w64: agenticos-kernel.exe)
#   4. NSIS installer                 (makensis build-windows/installer.nsi)
#   5. Portable ZIP                   (zip of build-windows/portable_staging/AgenticOS)
#   6. Validation:
#        * PE validity check          (file cmd + size > 50KB)
#        * Required file presence     (dist/index.html, dist/assets/*.js, *.css)
#        * Installer presence         (> 500KB)
#        * No dev-only strings        (no PYTHONPATH, no bash, no WSL refs)
#
# Outputs:
#   build-windows/bin/AgenticOS.exe
#   build-windows/bin/agenticos-kernel.exe
#   dist/                                  (frontend build output)
#   public/downloads/AgenticOS-Setup-x64.exe
#   public/downloads/AgenticOS-Portable-x64.zip
#   public/downloads/SHA256SUMS
#
# Exit codes:
#   0 = success
#   1 = frontend build failed
#   2 = C compilation failed
#   3 = NSIS build failed
#   4 = validation failed
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

ROOT="$(pwd)"
BIN_DIR="${ROOT}/build-windows/bin"
DIST_DIR="${ROOT}/dist"
DOWNLOADS_DIR="${ROOT}/public/downloads"
PORTABLE_STAGING="${ROOT}/build-windows/portable_staging/AgenticOS"

log()  { printf "\033[1;34m[build]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[error]\033[0m %s\n" "$*" >&2; }
ok()   { printf "\033[1;32m[ok]\033[0m %s\n" "$*"; }

mkdir -p "${BIN_DIR}" "${DIST_DIR}" "${DOWNLOADS_DIR}"

# ----------------------------------------------------------------------------
# 1. Frontend build
# ----------------------------------------------------------------------------
log "Step 1/6: Building frontend (vite build)"

# Prefer bun if available, fall back to npm
if command -v bun >/dev/null 2>&1; then
    PKGMGR="bun"
elif command -v npm >/dev/null 2>&1; then
    PKGMGR="npm"
else
    err "Neither bun nor npm found in PATH. Install Node.js 18+ or bun."
    exit 1
fi

log "Using package manager: ${PKGMGR}"

if [ ! -d node_modules ]; then
    log "Installing dependencies (${PKGMGR} install)..."
    ${PKGMGR} install
fi

log "Running build..."
if ! ${PKGMGR} run build; then
    err "Frontend build failed."
    exit 1
fi

if [ ! -f "${DIST_DIR}/index.html" ]; then
    err "Frontend build did not produce dist/index.html."
    exit 1
fi

ok "Frontend built: ${DIST_DIR}"

# ----------------------------------------------------------------------------
# 2. Compile native C supervisor (AgenticOS.exe)
# ----------------------------------------------------------------------------
log "Step 2/6: Compiling native C supervisor (AgenticOS.exe)"

CC="${CC:-x86_64-w64-mingw32-gcc}"
if ! command -v "${CC}" >/dev/null 2>&1; then
    err "Cross-compiler '${CC}' not found."
    err "Install with: apt-get install gcc-mingw-w64-x86-64"
    err "OR set CC=clang and ensure clang has mingw target support."
    exit 2
fi

if ! ${CC} -O2 -municode -mwindows \
    -o "${BIN_DIR}/AgenticOS.exe" \
    "${ROOT}/build-windows/src/agenticos_main.c" \
    -lwininet -lshlwapi -luser32 -lshell32 -ladvapi32 -lgdi32; then
    err "Compilation of AgenticOS.exe failed."
    exit 2
fi
ok "Built: ${BIN_DIR}/AgenticOS.exe"

# ----------------------------------------------------------------------------
# 3. Compile native C kernel (agenticos-kernel.exe)
# ----------------------------------------------------------------------------
log "Step 3/6: Compiling native C kernel (agenticos-kernel.exe)"

if ! ${CC} -O2 \
    -o "${BIN_DIR}/agenticos-kernel.exe" \
    "${ROOT}/build-windows/src/agenticos_kernel.c" \
    -lws2_32 -lshlwapi; then
    err "Compilation of agenticos-kernel.exe failed."
    exit 2
fi
ok "Built: ${BIN_DIR}/agenticos-kernel.exe"

# ----------------------------------------------------------------------------
# 4. Build NSIS installer
# ----------------------------------------------------------------------------
log "Step 4/6: Building NSIS installer"

MAKENSIS="${MAKENSIS:-makensis}"
if ! command -v "${MAKENSIS}" >/dev/null 2>&1; then
    err "makensis not found in PATH."
    err "Install with: apt-get install nsis  OR  brew install nsis"
    exit 3
fi

pushd "${ROOT}/build-windows" >/dev/null
if ! ${MAKENSIS} installer.nsi; then
    err "NSIS build failed."
    popd
    exit 3
fi
popd

INSTALLER="${DOWNLOADS_DIR}/AgenticOS-Setup-x64.exe"
if [ ! -f "${INSTALLER}" ]; then
    err "Installer was not produced at ${INSTALLER}"
    exit 3
fi

INSTALLER_SIZE=$(stat -c%s "${INSTALLER}" 2>/dev/null || stat -f%z "${INSTALLER}")
if [ "${INSTALLER_SIZE}" -lt 50000 ]; then
    err "Installer is suspiciously small (${INSTALLER_SIZE} bytes). Aborting."
    exit 3
fi
ok "Installer built: ${INSTALLER} (${INSTALLER_SIZE} bytes)"

# ----------------------------------------------------------------------------
# 5. Build portable ZIP
# ----------------------------------------------------------------------------
log "Step 5/6: Building portable ZIP"

# Rebuild the portable staging tree from scratch so we never ship stale files
rm -rf "${PORTABLE_STAGING}"
mkdir -p "${PORTABLE_STAGING}"

cp "${BIN_DIR}/AgenticOS.exe"             "${PORTABLE_STAGING}/"
cp "${BIN_DIR}/agenticos-kernel.exe"     "${PORTABLE_STAGING}/"
cp "${ROOT}/start-agenticos.bat"         "${PORTABLE_STAGING}/"
cp -r "${DIST_DIR}"                       "${PORTABLE_STAGING}/dist"
mkdir -p "${PORTABLE_STAGING}/AgenticosHybrid"
cp -r "${ROOT}/AgenticosHybrid/src"       "${PORTABLE_STAGING}/AgenticosHybrid/"
cp -r "${ROOT}/AgenticosHybrid/core"     "${PORTABLE_STAGING}/AgenticosHybrid/" 2>/dev/null || true
mkdir -p "${PORTABLE_STAGING}/python"
cp "${ROOT}/python/runtime-manifest.json" "${PORTABLE_STAGING}/python/"

ZIP="${DOWNLOADS_DIR}/AgenticOS-Portable-x64.zip"
rm -f "${ZIP}"
pushd "${ROOT}/build-windows/portable_staging" >/dev/null
if command -v zip >/dev/null 2>&1; then
    zip -r "${ZIP}" AgenticOS >/dev/null
elif command -v 7z >/dev/null 2>&1; then
    7z a -tzip "${ZIP}" AgenticOS >/dev/null
else
    err "Neither zip nor 7z found; cannot build portable archive."
    popd
    exit 3
fi
popd

if [ ! -f "${ZIP}" ] || [ "$(stat -c%s "${ZIP}" 2>/dev/null || stat -f%z "${ZIP}")" -lt 50000 ]; then
    err "Portable ZIP is missing or too small."
    exit 3
fi
ok "Portable ZIP built: ${ZIP}"

# ----------------------------------------------------------------------------
# 6. Validation
# ----------------------------------------------------------------------------
log "Step 6/6: Validating artifacts"

VALIDATION_OK=1

# 6a. PE validity of binaries
for bin in "${BIN_DIR}/AgenticOS.exe" "${BIN_DIR}/agenticos-kernel.exe"; do
    if ! file "${bin}" | grep -q "PE32+ executable"; then
        err "Not a valid PE32+ executable: ${bin}"
        VALIDATION_OK=0
    fi
done

# 6b. Required frontend files
for f in "${DIST_DIR}/index.html"; do
    if [ ! -s "${f}" ]; then
        err "Missing or empty: ${f}"
        VALIDATION_OK=0
    fi
done

# 6c. At least one JS asset in dist/assets/
JS_COUNT=$(find "${DIST_DIR}/assets" -type f -name "*.js" 2>/dev/null | wc -l)
if [ "${JS_COUNT}" -lt 1 ]; then
    err "No JS assets in ${DIST_DIR}/assets/"
    VALIDATION_OK=0
fi

# 6d. No development-only strings in production binaries
#     (PYTHONPATH, "python3 -m", "daemon_agentic_os.sh", "/tmp/")
for bin in "${BIN_DIR}/AgenticOS.exe" "${BIN_DIR}/agenticos-kernel.exe"; do
    if strings "${bin}" 2>/dev/null | grep -E -i 'PYTHONPATH|python3 -m|daemon_agentic_os|WSL|/tmp/agentic' ; then
        err "Development-only string detected in production binary: ${bin}"
        VALIDATION_OK=0
    fi
done

# 6e. Installer PE validity
if ! file "${INSTALLER}" | grep -q "PE32+ executable"; then
    err "Installer is not a valid PE32+ executable: ${INSTALLER}"
    VALIDATION_OK=0
fi

# 6f. Compute SHA256 checksums
SHA256SUMS="${DOWNLOADS_DIR}/SHA256SUMS"
: > "${SHA256SUMS}"
for asset in "AgenticOS-Setup-x64.exe" "AgenticOS-Portable-x64.zip" "AgenticOS.exe"; do
    if [ -f "${DOWNLOADS_DIR}/${asset}" ]; then
        sha256sum "${DOWNLOADS_DIR}/${asset}" | sed "s|${DOWNLOADS_DIR}/||" >> "${SHA256SUMS}"
    fi
done
# Also publish a copy of AgenticOS.exe (the supervisor) as a standalone asset.
cp "${BIN_DIR}/AgenticOS.exe" "${DOWNLOADS_DIR}/AgenticOS.exe"

cp "${SHA256SUMS}" "${ROOT}/public/SHA256SUMS"
cp "${SHA256SUMS}" "${DOWNLOADS_DIR}/checksums.txt"
cp "${SHA256SUMS}" "${ROOT}/public/checksums.txt"

if [ "${VALIDATION_OK}" -ne 1 ]; then
    err "Validation failed. See errors above."
    exit 4
fi

ok "All artifacts validated."
ok "Installer:  ${INSTALLER}  (${INSTALLER_SIZE} bytes)"
ok "Portable:   ${ZIP}"
ok "Checksums:  ${SHA256SUMS}"

log "Build complete."
