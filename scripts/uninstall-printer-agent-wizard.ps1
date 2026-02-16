# GUI uninstaller for the local printer agent.
# Double-click via UNINSTALL_PRINTER_AGENT.cmd (no manual console commands).

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

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

try {
    $uninstallTask = Join-Path $PSScriptRoot 'uninstall-printer-agent-task.ps1'
    $output = & $uninstallTask | Out-String

    [System.Windows.Forms.MessageBox]::Show(
        ($output.Trim() | ForEach-Object { if ($_ -eq '') { 'Uninstalled.' } else { $_ } }),
        'Printer Agent', 'OK', 'Information'
    ) | Out-Null
} catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Uninstall failed', 'OK', 'Error') | Out-Null
}
