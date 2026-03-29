param(
    [string]$TaskName = 'RestaurantPrinterAgent'
)

$ErrorActionPreference = 'Stop'

try {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
} catch {}

try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop | Out-Null
    Write-Output "Uninstalled scheduled task '$TaskName'"
} catch {
    Write-Output "Task '$TaskName' not found or could not be removed: $($_.Exception.Message)"
}
