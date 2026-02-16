# GUI installer for the local printer agent.
# Double-click via INSTALL_PRINTER_AGENT.cmd (no manual console commands).

$ErrorActionPreference = 'Stop'

function Ensure-Admin {
    $current = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    $isAdmin = $current.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
    if ($isAdmin) { return }

    $args = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden',
        '-File', "`"$PSCommandPath`""
    )

    Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -ArgumentList $args
    exit 0
}

Ensure-Admin

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$configPath = Join-Path $root 'printer-agent.config.json'
$examplePath = Join-Path $root 'printer-agent.config.json.example'

# Load existing config if present; else load example; else default object.
$config = $null
try {
    if (Test-Path $configPath) {
        $config = (Get-Content $configPath -Raw | ConvertFrom-Json)
    } elseif (Test-Path $examplePath) {
        $config = (Get-Content $examplePath -Raw | ConvertFrom-Json)
    }
} catch {
    $config = $null
}

if ($null -eq $config) {
    $config = [pscustomobject]@{
        apiBaseUrl = 'https://bojole.bg/api'
        apiKey = ''
        pollIntervalMs = 5000
        stateFile = './printer-agent-state.json'
        logFile = './printer-agent.log'
        printerIp = ''
        printerPort = 9100
        subnet = '192.168.88'
        dryRun = $false
        nodePath = 'C:/Program Files/nodejs/node.exe'
    }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Restaurant Printer Agent - Installer'
$form.Size = New-Object System.Drawing.Size(660, 520)
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true

$font = New-Object System.Drawing.Font('Segoe UI', 10)
$form.Font = $font

function Add-Label([string]$text, [int]$x, [int]$y) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $text
    $lbl.AutoSize = $true
    $lbl.Location = New-Object System.Drawing.Point($x, $y)
    $form.Controls.Add($lbl)
    return $lbl
}

function Add-TextBox([string]$value, [int]$x, [int]$y, [int]$w=420) {
    $tb = New-Object System.Windows.Forms.TextBox
    $tb.Text = [string]$value
    $tb.Location = New-Object System.Drawing.Point($x, $y)
    $tb.Size = New-Object System.Drawing.Size($w, 24)
    $form.Controls.Add($tb)
    return $tb
}

function Add-CheckBox([string]$text, [bool]$checked, [int]$x, [int]$y) {
    $cb = New-Object System.Windows.Forms.CheckBox
    $cb.Text = $text
    $cb.Checked = $checked
    $cb.AutoSize = $true
    $cb.Location = New-Object System.Drawing.Point($x, $y)
    $form.Controls.Add($cb)
    return $cb
}

Add-Label 'API Base URL (must end with /api):' 20 20 | Out-Null
$tbApiBase = Add-TextBox $config.apiBaseUrl 20 45 600

Add-Label 'Restaurant API Key (x-api-key):' 20 80 | Out-Null
$tbApiKey = Add-TextBox $config.apiKey 20 105 600

Add-Label 'LAN subnet for autodiscovery (example: 192.168.88):' 20 140 | Out-Null
$tbSubnet = Add-TextBox $config.subnet 20 165 260

Add-Label 'Poll interval (ms):' 310 140 | Out-Null
$tbPoll = Add-TextBox $config.pollIntervalMs 310 165 150

Add-Label 'Printer IP (optional, e.g. 192.168.88.253):' 20 200 | Out-Null
$tbPrinterIp = Add-TextBox $config.printerIp 20 225 260

Add-Label 'Printer port:' 310 200 | Out-Null
$tbPrinterPort = Add-TextBox $config.printerPort 310 225 150

Add-Label 'Subnet mask (optional):' 20 260 | Out-Null
$tbSubnetMask = Add-TextBox ($config.subnetMask) 20 285 260

Add-Label 'Gateway (optional):' 310 260 | Out-Null
$tbGateway = Add-TextBox ($config.gateway) 310 285 260

$cbDhcp = Add-CheckBox 'DHCP enabled (reference only)' ([bool]($config.dhcpEnabled)) 20 320

Add-Label 'Node path (optional):' 20 350 | Out-Null
$tbNodePath = Add-TextBox $config.nodePath 20 375 600

Add-Label 'Log file (optional):' 20 410 | Out-Null
$tbLogFile = Add-TextBox $config.logFile 20 435 600

$cbDryRun = Add-CheckBox 'Dry-run (do not print, only simulate)' ([bool]$config.dryRun) 20 470

$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = 'Install & Start'
$btnInstall.Size = New-Object System.Drawing.Size(150, 32)
$btnInstall.Location = New-Object System.Drawing.Point(470, 465)
$form.Controls.Add($btnInstall)

$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = 'Cancel'
$btnCancel.Size = New-Object System.Drawing.Size(100, 32)
$btnCancel.Location = New-Object System.Drawing.Point(360, 465)
$form.Controls.Add($btnCancel)

$btnCancel.Add_Click({
    $form.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Close()
})

$btnInstall.Add_Click({
    $apiBaseUrl = $tbApiBase.Text.Trim()
    $apiKey = $tbApiKey.Text.Trim()

    if ([string]::IsNullOrWhiteSpace($apiBaseUrl)) {
        [System.Windows.Forms.MessageBox]::Show('API Base URL is required.', 'Missing value', 'OK', 'Warning') | Out-Null
        return
    }
    if ($apiBaseUrl -notmatch '/api\s*$') {
        $res = [System.Windows.Forms.MessageBox]::Show('API Base URL does not end with /api. Continue anyway?', 'Check URL', 'YesNo', 'Warning')
        if ($res -ne [System.Windows.Forms.DialogResult]::Yes) { return }
    }
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        [System.Windows.Forms.MessageBox]::Show('Restaurant API Key is required.', 'Missing value', 'OK', 'Warning') | Out-Null
        return
    }

    $poll = 5000
    [void][int]::TryParse($tbPoll.Text.Trim(), [ref]$poll)

    $printerPort = 9100
    [void][int]::TryParse($tbPrinterPort.Text.Trim(), [ref]$printerPort)
    if ($printerPort -lt 1 -or $printerPort -gt 65535) {
        [System.Windows.Forms.MessageBox]::Show('Printer port must be between 1 and 65535.', 'Invalid value', 'OK', 'Warning') | Out-Null
        return
    }

    $cfg = [pscustomobject]@{
        apiBaseUrl = $apiBaseUrl
        apiKey = $apiKey
        pollIntervalMs = $poll
        stateFile = './printer-agent-state.json'
        logFile = $tbLogFile.Text.Trim()
        printerIp = $tbPrinterIp.Text.Trim()
        printerPort = $printerPort
        subnet = $tbSubnet.Text.Trim()
        subnetMask = $tbSubnetMask.Text.Trim()
        gateway = $tbGateway.Text.Trim()
        dhcpEnabled = [bool]$cbDhcp.Checked
        dryRun = [bool]$cbDryRun.Checked
        nodePath = $tbNodePath.Text.Trim()
    }

    try {
        $json = $cfg | ConvertTo-Json -Depth 6
        Set-Content -Path $configPath -Value $json -Encoding UTF8

        $installTask = Join-Path $PSScriptRoot 'install-printer-agent-task.ps1'
        & $installTask -InstallDir $root | Out-Null

        Start-ScheduledTask -TaskName 'RestaurantPrinterAgent' | Out-Null

        [System.Windows.Forms.MessageBox]::Show(
            "Installed and started successfully.`n`nConfig: $configPath`nLogs: $(Join-Path $root 'printer-agent.log')",
            'Success', 'OK', 'Information'
        ) | Out-Null

        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    } catch {
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Install failed', 'OK', 'Error') | Out-Null
    }
})

[void]$form.ShowDialog()
