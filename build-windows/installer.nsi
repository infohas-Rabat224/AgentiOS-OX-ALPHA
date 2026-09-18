; AgenticOS Windows x64 Production Installer
; Built with NSIS (Nullsoft Scriptable Install System)

Target amd64-unicode
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

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_COMPONENTSPAGE_NODESC

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\AgenticOS.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch AgenticOS Desktop Mission Control"
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

VIProductVersion "1.0.0.10"
VIAddVersionKey "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey "Comments" "Autonomous AI Multi-Agent Operating System Desktop Runtime"
VIAddVersionKey "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey "LegalCopyright" "Copyright (C) 2026 AgenticOS Project"
VIAddVersionKey "FileDescription" "AgenticOS Windows x64 Native Setup"
VIAddVersionKey "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey "ProductVersion" "${PRODUCT_VERSION}"

Section "MainSection" SEC01
    SetOutPath "$INSTDIR"
    SetOverwrite on

    ; 1. Native Windows Executables
    File "bin/AgenticOS.exe"
    File "bin/agenticos-kernel.exe"
    File "../start-agenticos.bat"

    ; 2. Complete Frontend Distribution
    SetOutPath "$INSTDIR\dist"
    File /r /x downloads "../dist\*.*"

    ; 3. AgenticOS Hybrid Core Python Engine
    SetOutPath "$INSTDIR\AgenticosHybrid"
    File /r /x .git /x node_modules /x __pycache__ "../AgenticosHybrid\*.*"

    ; 4. Prepare logs, workspace, and config directories
    CreateDirectory "$INSTDIR\logs"
    CreateDirectory "$INSTDIR\workspace"
    CreateDirectory "$INSTDIR\security"

    ; 5. Shortcuts
    SetOutPath "$INSTDIR"
    CreateDirectory "$SMPROGRAMS\AgenticOS"
    CreateShortCut "$SMPROGRAMS\AgenticOS\AgenticOS Mission Control.lnk" "$INSTDIR\AgenticOS.exe" "" "$INSTDIR\AgenticOS.exe" 0
    CreateShortCut "$SMPROGRAMS\AgenticOS\Uninstall AgenticOS.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\uninstall.exe" 0
    CreateShortCut "$DESKTOP\AgenticOS Mission Control.lnk" "$INSTDIR\AgenticOS.exe" "" "$INSTDIR\AgenticOS.exe" 0

    ; 6. Write Uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"

    ; 7. Windows Registry Add/Remove Programs
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
SectionEnd

Section Uninstall
    ; Remove Shortcuts
    Delete "$DESKTOP\AgenticOS Mission Control.lnk"
    Delete "$SMPROGRAMS\AgenticOS\AgenticOS Mission Control.lnk"
    Delete "$SMPROGRAMS\AgenticOS\Uninstall AgenticOS.lnk"
    RMDir "$SMPROGRAMS\AgenticOS"

    ; Remove Application Files
    Delete "$INSTDIR\AgenticOS.exe"
    Delete "$INSTDIR\agenticos-kernel.exe"
    Delete "$INSTDIR\start-agenticos.bat"
    Delete "$INSTDIR\uninstall.exe"

    ; Remove Directories
    RMDir /r "$INSTDIR\dist"
    RMDir /r "$INSTDIR\AgenticosHybrid"
    RMDir /r "$INSTDIR\workspace"

    ; Try removing root directory if empty (leaves user logs/security)
    RMDir "$INSTDIR"

    ; Remove Registry Keys
    DeleteRegKey HKCU "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKCU "${PRODUCT_DIR_REGKEY}"
    SetAutoClose true
SectionEnd
