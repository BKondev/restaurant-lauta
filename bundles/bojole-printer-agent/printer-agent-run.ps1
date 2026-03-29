# Runs printer-agent.js with environment loaded from printer-agent.config.json
# Intended to be executed by Task Scheduler at startup.

param(
    # Optional: pass a specific config file (e.g. .\configs\printer-agent.config.bojole.json)
    [string]$ConfigPath = ''
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$resolvedConfigPath = $null
if (-not [string]::IsNullOrWhiteSpace($ConfigPath)) {
    $resolvedConfigPath = [string]$ConfigPath
} elseif (-not [string]::IsNullOrWhiteSpace($env:AGENT_CONFIG_PATH)) {
    $resolvedConfigPath = [string]$env:AGENT_CONFIG_PATH
} else {
    $resolvedConfigPath = 'printer-agent.config.json'
}

if (-not [System.IO.Path]::IsPathRooted($resolvedConfigPath)) {
    $resolvedConfigPath = Join-Path $root $resolvedConfigPath
}

if (!(Test-Path $resolvedConfigPath)) {
    throw "Missing config file: $resolvedConfigPath (copy printer-agent.config.json.example and fill it)"
}

$config = Get-Content $resolvedConfigPath -Raw | ConvertFrom-Json

# Required
$env:AGENT_API_BASE_URL = [string]$config.apiBaseUrl
$env:AGENT_API_KEY = [string]$config.apiKey

if ([string]::IsNullOrWhiteSpace($env:AGENT_API_KEY)) {
    throw "AGENT_API_KEY is empty in config: $resolvedConfigPath"
}

# Optional
if ($config.pollIntervalMs) { $env:AGENT_POLL_INTERVAL_MS = [string]$config.pollIntervalMs }
if ($config.stateFile) { $env:AGENT_STATE_FILE = [string]$config.stateFile }
if ($config.logFile) {
    $env:AGENT_LOG_FILE = [string]$config.logFile
} else {
    $env:AGENT_LOG_FILE = (Join-Path $root 'printer-agent.log')
}
if ($config.printerIp) { $env:AGENT_PRINTER_IP = [string]$config.printerIp }
if ($config.printerPort) { $env:AGENT_PRINTER_PORT = [string]$config.printerPort }
if ($config.printerName) { $env:AGENT_PRINTER_NAME = [string]$config.printerName }
if ($config.subnet) { $env:AGENT_SUBNET = [string]$config.subnet }
if ($null -ne $config.dryRun) { $env:AGENT_DRY_RUN = [string]$config.dryRun }
if ($null -ne $config.enableNoteReprints) { $env:AGENT_ENABLE_NOTE_REPRINTS = [string]$config.enableNoteReprints }
if ($config.noteStateFile) { $env:AGENT_NOTE_STATE_FILE = [string]$config.noteStateFile }
if ($config.orderStatusesCsv) { $env:AGENT_ORDER_STATUSES = [string]$config.orderStatusesCsv }
if ($null -ne $config.allowReprintsWhenAutoPrintDisabled) { $env:AGENT_ALLOW_REPRINTS_WHEN_AUTO_PRINT_DISABLED = [string]$config.allowReprintsWhenAutoPrintDisabled }

# Resolve node.exe
$nodePath = $null
if ($config.nodePath -and (Test-Path ([string]$config.nodePath))) {
    $nodePath = [string]$config.nodePath
} elseif (Test-Path 'C:\Program Files\nodejs\node.exe') {
    $nodePath = 'C:\Program Files\nodejs\node.exe'
} else {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
}

Write-Output "[AGENT] Starting with node: $nodePath"
Write-Output "[AGENT] Using config: $resolvedConfigPath"

# Run in the foreground so Task Scheduler can restart it on failure.
& $nodePath (Join-Path $root 'printer-agent.js')
exit $LASTEXITCODE
