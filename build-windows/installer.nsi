; ============================================================================
; AgenticOS Windows x64 Production Installer (NSIS)
; Version: 1.0.0-rc10
; ============================================================================
; This installer:
;   * installs AgenticOS.exe + agenticos-kernel.exe (native C binaries)
;   * installs the built frontend dist/ tree (React + Vite)
;   * installs AgenticosHybrid/ (Python source — kept for reference only,
;     NOT required at runtime; the native kernel does not depend on Python)
;   * does NOT install a Python runtime (the kernel is native C)
;   * does NOT depend on bash, WSL, Git Bash, npm, cargo, or vite at runtime
;   * creates Start Menu + Desktop shortcuts
;   * writes a complete Add/Remove Programs registry entry
;   * writes an uninstaller that removes binaries, shortcuts, and registry
;
; Build:
;   makensis build-windows\installer.nsi
;
; Output:
;   public\downloads\AgenticOS-Setup-x64.exe
;
; NOTE: We deliberately do NOT use "Target amd64-unicode" here because the
;       stock NSIS package (chocolatey 'nsis' on Windows runners) does not
;       ship the required stub (zlib-amd64-unicode). The installer is built
;       with Unicode (default in NSIS 3.x) and runs as a 32-bit Unicode
;       installer that uses WOW64 to access the native x64 filesystem.
;       This is sufficient for an installer that targets
;       $LOCALAPPDATA\AgenticOS — no machine-wide install is performed.
; ============================================================================

Unicode True

!define PRODUCT_NAME "AgenticOS Desktop Mission Control"
!define PRODUCT_VERSION "1.0.0-rc10"
!define PRODUCT_PUBLISHER "AgenticOS Open Source Community"
!define PRODUCT_WEB_SITE "https://github.com/infohas-Rabat224/AgentiOS-OX-ALPHA"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\AgenticOS.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS"

SetCompressor /SOLID lzma

; Includes
!include "MUI2.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_NODESC

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

; Setup Configuration
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "../public/downloads/AgenticOS-Setup-x64.exe"
InstallDir "$LOCALAPPDATA\AgenticOS"
InstallDirRegKey HKCU "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show
RequestExecutionLevel user

; Version metadata embedded in the final exe's PE resource
VIProductVersion "1.0.0.10"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "Comments" "Autonomous AI Multi-Agent Operating System Desktop Runtime"
VIAddVersionKey "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey "LegalCopyright" "Copyright (C) 2026 AgenticOS Project"
VIAddVersionKey "FileDescription" "AgenticOS Windows x64 Native Setup"
VIAddVersionKey "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"

; ============================================================================
; Pre-install validation
; ============================================================================
Function .onInit
    ; Require x64 Windows
    ${IfNot} ${RunningX64}
        MessageBox MB_OK|MB_ICONSTOP \
          "AgenticOS requires a 64-bit edition of Windows.$\r$\n$\r$\nInstallation aborted."
        Abort
    ${EndIf}

    ; Verify the required source binaries exist before we start writing files.
    ; If these are missing, the build pipeline is broken — abort loudly rather
    ; than ship a half-built installer that the user will only discover is
    ; broken after clicking AgenticOS and seeing nothing.
    IfFileExists "bin\AgenticOS.exe" +3 0
        MessageBox MB_OK|MB_ICONSTOP \
          "Build pipeline error: bin\AgenticOS.exe is missing.$\r$\n$\r$\nInstallation aborted."
        Abort
    IfFileExists "bin\agenticos-kernel.exe" +3 0
        MessageBox MB_OK|MB_ICONSTOP \
          "Build pipeline error: bin\agenticos-kernel.exe is missing.$\r$\n$\r$\nInstallation aborted."
        Abort
    IfFileExists "..\dist\index.html" +3 0
        MessageBox MB_OK|MB_ICONSTOP \
          "Build pipeline error: ..\dist\index.html is missing.$\r$\n$\r$\n$\r$\nRun 'npm run build' before building the installer.$\r$\nInstallation aborted."
        Abort
FunctionEnd

; ============================================================================
; Main install section
; ============================================================================
Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    SetOverwrite on

    ; --- 1. Native Windows Executables ---
    File "bin\AgenticOS.exe"
    File "bin\agenticos-kernel.exe"
    File "..\start-agenticos.bat"

    ; --- 2. Frontend distribution (built with `npm run build`) ---
    SetOutPath "$INSTDIR\dist"
    File /r /x downloads "..\dist\*.*"

    ; --- 3. AgenticOS Hybrid Core Python Engine (source-only; not required
    ;        at runtime. Bundled for reference / future Python integration.) ---
    SetOutPath "$INSTDIR\AgenticosHybrid"
    File /r /x .git /x node_modules /x __pycache__ /x "*.pyc" "..\AgenticosHybrid\*.*"

    ; --- 4. Runtime manifest stub (overwritten by kernel at startup) ---
    SetOutPath "$INSTDIR\python"
    File "..\python\runtime-manifest.json"

    ; --- 5. Prepare mutable application data directories in %LOCALAPPDATA% ---
    ; (These are NOT in $INSTDIR — see the Application Data policy.)
    CreateDirectory "$LOCALAPPDATA\AgenticOS"
    CreateDirectory "$LOCALAPPDATA\AgenticOS\logs"
    CreateDirectory "$LOCALAPPDATA\AgenticOS\workspace"
    CreateDirectory "$LOCALAPPDATA\AgenticOS\security"

    ; --- 6. Shortcuts ---
    SetOutPath "$INSTDIR"
    CreateDirectory "$SMPROGRAMS\AgenticOS"
    CreateShortCut "$SMPROGRAMS\AgenticOS\AgenticOS Mission Control.lnk" \
        "$INSTDIR\AgenticOS.exe" "" "$INSTDIR\AgenticOS.exe" 0
    CreateShortCut "$SMPROGRAMS\AgenticOS\Uninstall AgenticOS.lnk" \
        "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
    CreateShortCut "$DESKTOP\AgenticOS Mission Control.lnk" \
        "$INSTDIR\AgenticOS.exe" "" "$INSTDIR\AgenticOS.exe" 0

    ; --- 7. Uninstaller ---
    WriteUninstaller "$INSTDIR\uninstall.exe"

    ; --- 8. Registry entries for Add/Remove Programs ---
    WriteRegStr HKCU "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\AgenticOS.exe"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "QuietUninstallString" "$INSTDIR\uninstall.exe /S"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\AgenticOS.exe"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKCU "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegDWORD HKCU "${PRODUCT_UNINST_KEY}" "NoModify" 1
    WriteRegDWORD HKCU "${PRODUCT_UNINST_KEY}" "NoRepair" 1

    ; --- 9. Post-install validation ---
    ; Verify that every critical file was actually written. If any is missing,
    ; abort the installation with a clear error rather than declare success.
    IfFileExists "$INSTDIR\AgenticOS.exe" +3 0
        MessageBox MB_OK|MB_ICONSTOP "Install failed: AgenticOS.exe was not written to $INSTDIR"
        Abort
    IfFileExists "$INSTDIR\agenticos-kernel.exe" +3 0
        MessageBox MB_OK|MB_ICONSTOP "Install failed: agenticos-kernel.exe was not written to $INSTDIR"
        Abort
    IfFileExists "$INSTDIR\dist\index.html" +3 0
        MessageBox MB_OK|MB_ICONSTOP "Install failed: dist\index.html was not written to $INSTDIR\dist"
        Abort
SectionEnd

; ============================================================================
; Uninstall
; ============================================================================
Section Uninstall
    ; --- Remove Shortcuts ---
    Delete "$DESKTOP\AgenticOS Mission Control.lnk"
    Delete "$SMPROGRAMS\AgenticOS\AgenticOS Mission Control.lnk"
    Delete "$SMPROGRAMS\AgenticOS\Uninstall AgenticOS.lnk"
    RMDir "$SMPROGRAMS\AgenticOS"

    ; --- Remove Application Files ---
    Delete "$INSTDIR\AgenticOS.exe"
    Delete "$INSTDIR\agenticos-kernel.exe"
    Delete "$INSTDIR\start-agenticos.bat"
    Delete "$INSTDIR\uninstall.exe"
    Delete "$INSTDIR\python\runtime-manifest.json"
    RMDir "$INSTDIR\python"

    ; --- Remove Directories ---
    RMDir /r "$INSTDIR\dist"
    RMDir /r "$INSTDIR\AgenticosHybrid"

    ; Try removing root directory if empty (we intentionally do NOT remove
    ; $LOCALAPPDATA\AgenticOS — that holds user logs, workspace, and security
    ; state; the user must remove those manually if they want a full wipe).
    RMDir "$INSTDIR"

    ; --- Remove Registry Keys ---
    DeleteRegKey HKCU "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKCU "${PRODUCT_DIR_REGKEY}"
    SetAutoClose true
SectionEnd
