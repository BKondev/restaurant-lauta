; Inno Setup installer for the Local Printer Agent
; Builds a real setup.exe that installs files, writes config, and registers a Scheduled Task.

#define AppName "Restaurant Printer Agent"
#define AppVersion "1.0.0"
#define AppPublisher "Bojole"
#define AppURL "https://bojole.bg"

[Setup]
AppId={{D9B8BDF0-2749-4E3E-ACB7-6B0C8B6A90FE}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={autopf}\RestaurantPrinterAgent
DefaultGroupName={#AppName}
UninstallDisplayName={#AppName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes

OutputDir=Output
OutputBaseFilename=RestaurantPrinterAgentSetup

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Dirs]
Name: "{commonappdata}\RestaurantPrinterAgent"; Permissions: users-modify

[Files]
Source: "..\printer-agent.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\printer-service.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\printer-agent-run.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\printer-agent.config.json.example"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Open Logs"; Filename: "notepad.exe"; Parameters: """{commonappdata}\RestaurantPrinterAgent\printer-agent.log"""; WorkingDir: "{commonappdata}\RestaurantPrinterAgent"
Name: "{group}\Open Config"; Filename: "notepad.exe"; Parameters: """{app}\printer-agent.config.json"""; WorkingDir: "{app}"

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\uninstall-printer-agent-task.ps1"""; Flags: runhidden

[Code]
var
  ApiPage: TInputQueryWizardPage;

function StringToBoolDef(const S: string; Default: Boolean): Boolean;
var
  T: string;
begin
  T := LowerCase(Trim(S));
  if (T = '1') or (T = 'true') or (T = 'yes') or (T = 'y') or (T = 'on') then begin
    Result := True;
    exit;
  end;
  if (T = '0') or (T = 'false') or (T = 'no') or (T = 'n') or (T = 'off') then begin
    Result := False;
    exit;
  end;
  Result := Default;
end;

function JsonEscape(const S: string): string;
var
  I: Integer;
  C: Char;
begin
  Result := '';
  for I := 1 to Length(S) do begin
    C := S[I];
    case C of
      '"': Result := Result + '\\"';
      '\\': Result := Result + '\\\\';
    else
      Result := Result + C;
    end;
  end;
end;

function BoolToJson(Value: Boolean): string;
begin
  if Value then Result := 'true' else Result := 'false';
end;

procedure InitializeWizard();
begin
  ApiPage := CreateInputQueryPage(
    wpSelectDir,
    'Printer Agent Settings',
    'Enter the API URL, API key, and printer network settings',
    'These values are saved on this PC in a config file. The agent starts automatically on boot.'
  );

  ApiPage.Add('API Base URL (must end with /api):', False);
  ApiPage.Add('Restaurant API Key (x-api-key):', True);
  ApiPage.Add('LAN subnet for autodiscovery (optional, e.g. 192.168.88):', False);
  ApiPage.Add('Poll interval ms (default 5000):', False);
  ApiPage.Add('Printer IP (optional, e.g. 192.168.88.253):', False);
  ApiPage.Add('Printer port (default 9100):', False);
  ApiPage.Add('Subnet mask (optional, e.g. 255.255.255.0):', False);
  ApiPage.Add('Gateway (optional, e.g. 192.168.88.1):', False);
  ApiPage.Add('DHCP enabled? (true/false) (optional):', False);

  ApiPage.Values[0] := 'https://bojole.bg/api';
  ApiPage.Values[1] := '';
  ApiPage.Values[2] := '192.168.88';
  ApiPage.Values[3] := '5000';
  ApiPage.Values[4] := '192.168.88.253';
  ApiPage.Values[5] := '9100';
  ApiPage.Values[6] := '255.255.255.0';
  ApiPage.Values[7] := '192.168.88.1';
  ApiPage.Values[8] := 'true';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Poll: Integer;
  Port: Integer;
begin
  Result := True;

  if CurPageID = ApiPage.ID then begin
    if Trim(ApiPage.Values[0]) = '' then begin
      MsgBox('API Base URL is required.', mbError, MB_OK);
      Result := False;
      exit;
    end;

    if Pos('/api', LowerCase(Trim(ApiPage.Values[0]))) = 0 then begin
      if MsgBox('API Base URL does not contain /api. Continue anyway?', mbConfirmation, MB_YESNO) = IDNO then begin
        Result := False;
        exit;
      end;
    end;

    if Trim(ApiPage.Values[1]) = '' then begin
      MsgBox('Restaurant API Key is required.', mbError, MB_OK);
      Result := False;
      exit;
    end;

    Poll := StrToIntDef(Trim(ApiPage.Values[3]), 5000);
    if Poll < 1000 then begin
      MsgBox('Poll interval is too low. Use at least 1000ms.', mbError, MB_OK);
      Result := False;
      exit;
    end;

    Port := StrToIntDef(Trim(ApiPage.Values[5]), 9100);
    if (Port < 1) or (Port > 65535) then begin
      MsgBox('Printer port must be between 1 and 65535.', mbError, MB_OK);
      Result := False;
      exit;
    end;
  end;
end;

procedure WriteConfig();
var
  ApiBaseUrl, ApiKey, Subnet, PollStr: string;
  PrinterIp, PrinterPortStr: string;
  SubnetMask, Gateway, DhcpStr: string;
  Poll: Integer;
  PrinterPort: Integer;
  DhcpEnabled: Boolean;
  StatePath, LogPath, NodePath: string;
  Content: string;
  ConfigFile: string;
begin
  ApiBaseUrl := Trim(ApiPage.Values[0]);
  ApiKey := Trim(ApiPage.Values[1]);
  Subnet := Trim(ApiPage.Values[2]);
  PollStr := Trim(ApiPage.Values[3]);
  PrinterIp := Trim(ApiPage.Values[4]);
  PrinterPortStr := Trim(ApiPage.Values[5]);
  SubnetMask := Trim(ApiPage.Values[6]);
  Gateway := Trim(ApiPage.Values[7]);
  DhcpStr := Trim(ApiPage.Values[8]);
  Poll := StrToIntDef(PollStr, 5000);
  PrinterPort := StrToIntDef(PrinterPortStr, 9100);
  DhcpEnabled := StringToBoolDef(DhcpStr, True);

  StatePath := ExpandConstant('{commonappdata}\RestaurantPrinterAgent\printer-agent-state.json');
  LogPath := ExpandConstant('{commonappdata}\RestaurantPrinterAgent\printer-agent.log');

  // use forward slashes to avoid JSON backslash escaping issues
  StringChangeEx(StatePath, '\\', '/', True);
  StringChangeEx(LogPath, '\\', '/', True);

  NodePath := 'C:/Program Files/nodejs/node.exe';

  Content := '{' + #13#10 +
    '  "apiBaseUrl": "' + JsonEscape(ApiBaseUrl) + '",' + #13#10 +
    '  "apiKey": "' + JsonEscape(ApiKey) + '",' + #13#10 +
    '  "pollIntervalMs": ' + IntToStr(Poll) + ',' + #13#10 +
    '  "stateFile": "' + JsonEscape(StatePath) + '",' + #13#10 +
    '  "logFile": "' + JsonEscape(LogPath) + '",' + #13#10 +
    '  "printerIp": "' + JsonEscape(PrinterIp) + '",' + #13#10 +
    '  "printerPort": ' + IntToStr(PrinterPort) + ',' + #13#10 +
    '  "subnet": "' + JsonEscape(Subnet) + '",' + #13#10 +
    '  "subnetMask": "' + JsonEscape(SubnetMask) + '",' + #13#10 +
    '  "gateway": "' + JsonEscape(Gateway) + '",' + #13#10 +
    '  "dhcpEnabled": ' + BoolToJson(DhcpEnabled) + ',' + #13#10 +
    '  "dryRun": ' + BoolToJson(False) + ',' + #13#10 +
    '  "nodePath": "' + JsonEscape(NodePath) + '"' + #13#10 +
    '}' + #13#10;

  ConfigFile := ExpandConstant('{app}\printer-agent.config.json');
  if not SaveStringToFile(ConfigFile, Content, False) then begin
    RaiseException('Failed to write config: ' + ConfigFile);
  end;
end;

procedure InstallScheduledTask();
var
  ResultCode: Integer;
  InstallDir: string;
  ScriptPath: string;
  Cmd: string;
begin
  InstallDir := ExpandConstant('{app}');
  ScriptPath := ExpandConstant('{app}\scripts\install-printer-agent-task.ps1');

  Cmd := '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '" -InstallDir "' + InstallDir + '"';

  if not Exec('powershell.exe', Cmd, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then begin
    MsgBox('Failed to run PowerShell to install the scheduled task.', mbError, MB_OK);
    exit;
  end;

  if ResultCode <> 0 then begin
    MsgBox('Scheduled task install returned code: ' + IntToStr(ResultCode) + '. The agent may not start on boot.', mbError, MB_OK);
    exit;
  end;

  // Try to start immediately
  Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -Command "Start-ScheduledTask -TaskName ''RestaurantPrinterAgent''"', '', SW_HIDE, ewNoWait, ResultCode);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    WriteConfig();
    InstallScheduledTask();
  end;
end;
