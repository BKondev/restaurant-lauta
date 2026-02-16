# Runs printer-agent.js with environment loaded from printer-agent.config.json
# Intended to be executed by Task Scheduler at startup.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$configPath = Join-Path $root 'printer-agent.config.json'
if (!(Test-Path $configPath)) {
    throw "Missing config file: $configPath (copy printer-agent.config.json.example and fill it)"
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json

# Required
$env:AGENT_API_BASE_URL = [string]$config.apiBaseUrl
$env:AGENT_API_KEY = [string]$config.apiKey

if ([string]::IsNullOrWhiteSpace($env:AGENT_API_KEY)) {
    throw 'AGENT_API_KEY is empty in printer-agent.config.json'
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
if ($config.subnet) { $env:AGENT_SUBNET = [string]$config.subnet }
if ($null -ne $config.dryRun) { $env:AGENT_DRY_RUN = [string]$config.dryRun }

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

# Run in the foreground so Task Scheduler can restart it on failure.
& $nodePath (Join-Path $root 'printer-agent.js')
exit $LASTEXITCODE
