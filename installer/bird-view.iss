; 走，賞鳥趣 v0.4.6 — Windows 安裝程式（Inno Setup 6）
; 先建置：python tools\stage_web.py → python tools\make_icons.py → (desktop) npm run package
; 編譯："%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" installer\bird-view.iss → release\BirdView-Setup-v0.4.6.exe

#define AppName "走，賞鳥趣"
#define AppVersion "0.4.6"
#define AppExe "BirdView.exe"
#define AppDir "..\build\desktop\BirdView-win32-x64"

[Setup]
AppId={{98B872B1-7FE2-45C4-9891-17DD0E9BDB50}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} v{#AppVersion}
AppPublisher=BirdView
VersionInfoVersion=0.4.6.0
VersionInfoProductName=BirdView
VersionInfoDescription={#AppName} 安裝程式
DefaultDirName={autopf}\BirdView
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=BirdView-Setup-v{#AppVersion}
SetupIconFile=..\build\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName} v{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "cht"; MessagesFile: "ChineseTraditional.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#AppDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"; IconFilename: "{app}\{#AppExe}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; IconFilename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent
