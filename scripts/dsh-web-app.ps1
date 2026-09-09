# DeepSeek Harness — standalone app window launcher
# Starts dsh web, captures the auth URL, opens a chromeless app window
# in an isolated user-data directory so it never interferes with regular browsing.

$ErrorActionPreference = 'Stop'
Set-Location 'D:\DeepSeekHNS'

# ---- isolated user-data for the app window ----
$appDataDir = Join-Path $env:LOCALAPPDATA 'DeepSeek-Harness-App'

# Kill any stale dsh/web node processes on common ports
Get-Process node -ErrorAction SilentlyContinue |
  Where-Object { $_.Id -ne $PID } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Find a free port
$port = 9500
$occupied = netstat -ano 2>$null | Select-String ":$port " | Select-String "LISTENING"
while ($occupied) {
    $port++
    $occupied = netstat -ano 2>$null | Select-String ":$port " | Select-String "LISTENING"
}

# Start dsh web and capture output
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'node'
$psi.Arguments = "--import tsx/esm apps/cli/src/bin.ts web --port $port --no-open"
$psi.WorkingDirectory = 'D:\DeepSeekHNS'
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)

# Read output until we get the URL (max 15 seconds)
$url = $null
$deadline = [DateTime]::Now.AddSeconds(15)
$stderrLines = @()

while ($proc -and !$proc.HasExited -and [DateTime]::Now -lt $deadline) {
    $line = $proc.StandardOutput.ReadLine()
    if ($line) {
        if ($line -match 'http://[^\s]+') {
            $url = $Matches[0]
            break
        }
    }
    # also drain stderr to avoid buffer deadlock
    if ($proc.StandardError.Peek() -ge 0) {
        $stderrLines += $proc.StandardError.ReadLine()
    }
}

# If we didn't get it from stdout, try stderr
if (!$url) {
    $deadline2 = [DateTime]::Now.AddSeconds(5)
    while ($proc -and !$proc.HasExited -and [DateTime]::Now -lt $deadline2) {
        $line = $proc.StandardError.ReadLine()
        if ($line) {
            $stderrLines += $line
            if ($line -match 'http://[^\s]+') {
                $url = $Matches[0]
                break
            }
        }
    }
}

if (!$url) {
    Write-Host "Failed to capture DSH web URL." -ForegroundColor Red
    Write-Host "Server stderr:" -ForegroundColor Yellow
    $stderrLines | ForEach-Object { Write-Host "  $_" }
    Write-Host "`nPress any key to exit..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Write-Host "DSH Web running at: $url" -ForegroundColor Green

# Detect browser: Edge or Chrome
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$browser = $null
if (Test-Path $edge) { $browser = $edge }
elseif (Test-Path $chrome) { $browser = $chrome }

if ($browser) {
    # Open in --app mode with an isolated user-data directory.
    # This creates a truly standalone window with its own taskbar icon,
    # no address bar, no bookmarks bar, and no interference with regular Edge.
    Start-Process $browser @(
        "--app=$url",
        "--user-data-dir=$appDataDir"
    )
} else {
    # Fallback: open in default browser
    Start-Process $url
}

# Keep the terminal window alive, draining remaining output
Write-Host "`nDSH Web is running. Close this window or press Ctrl+C to stop.`n"
try {
    while (!$proc.HasExited) {
        $line = $proc.StandardError.ReadLine()
        if ($line) { Write-Host "[dsh] $line" -ForegroundColor DarkGray }
    }
} catch {
    # process exited
}
