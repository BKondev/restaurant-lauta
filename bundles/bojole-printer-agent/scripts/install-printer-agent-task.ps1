param(
    [string]$TaskName = 'RestaurantPrinterAgent',
    [string]$InstallDir = ''
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
    # scripts/ -> project root
    $InstallDir = Split-Path -Parent $PSScriptRoot
}

$runScript = Join-Path $InstallDir 'printer-agent-run.ps1'
if (!(Test-Path $runScript)) {
    throw "Missing run script: $runScript"
}

$psExe = (Get-Command powershell.exe).Source
$action = New-ScheduledTaskAction -Execute $psExe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runScript`""
$trigger = New-ScheduledTaskTrigger -AtStartup

# Run as SYSTEM so it starts even if nobody logs in.
$principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\SYSTEM' -LogonType ServiceAccount -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null
    Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop | Out-Null
} catch {
    Write-Error "Failed to install scheduled task '$TaskName'. Try running PowerShell as Administrator. Error: $($_.Exception.Message)"
    exit 1
}

Write-Output "Installed scheduled task '$TaskName'"
Write-Output "It will start on boot. You can run: Start-ScheduledTask -TaskName '$TaskName'"
