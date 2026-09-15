# DeepSeek Harness — restart ALL dsh web dev servers onto one fresh instance.
# Waits so an in-flight agent turn can finish; then stops every listener the
# app owns (1056/9029) plus the old launcher wrapper, and relaunches a single
# `dsh web` on the canonical port 1056 with the same URL the window uses.
$ErrorActionPreference = 'Continue'
$log = 'D:\DeepSeekHNS\dsh-web-restart.log'
$out = @()
function Log($msg) { $script:out += $msg; Write-Host $msg }

Log "full dsh web restart at $(Get-Date -Format o)"
Start-Sleep -Seconds 25

# 1) Stop every node listener this app owns on 1056/9029.
foreach ($port in @(1056, 9029)) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
    $cmd = if ($proc) { $proc.CommandLine } else { '(gone)' }
    if ($cmd -match 'bin\.ts web') {
      Log "stopping dsh web PID $($conn.OwningProcess) on port $port ($cmd)"
      Stop-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue  # graceful first
      $waitDeadline = [DateTime]::Now.AddSeconds(5)
      while ((Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue) -and [DateTime]::Now -lt $waitDeadline) {
        Start-Sleep -Milliseconds 200
      }
      # Force only if still alive after graceful window
      if (Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue) {
        Log "PID $($conn.OwningProcess) did not exit gracefully; force-killing"
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
      }
    } else {
      Log "port $port owned by non-dsh process $($conn.OwningProcess); leaving it"
    }
  } else {
    Log "no listener on $port"
  }
}
# Stop the old launcher wrapper if it lingers.
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue
  if ($p -and $p.CommandLine -match 'dsh-launcher\.cjs') {
    Log "stopping launcher wrapper PID $($_.Id)"
    Stop-Process -Id $_.Id -ErrorAction SilentlyContinue  # graceful first
    Start-Sleep -Seconds 2
    if (Get-Process -Id $_.Id -ErrorAction SilentlyContinue) {
      Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
  }
}
Start-Sleep -Seconds 3

# 2) Relaunch one instance on the canonical port.
$proc = Start-Process -FilePath 'node' `
  -ArgumentList '--import','tsx/esm','apps/cli/src/bin.ts','web','--port','1056','--no-open' `
  -WorkingDirectory 'D:\DeepSeekHNS' -WindowStyle Hidden `
  -RedirectStandardOutput 'D:\DeepSeekHNS\dsh-web-stdout.log' `
  -RedirectStandardError 'D:\DeepSeekHNS\dsh-web-stderr.log' -PassThru
Log "launched fresh dsh web PID $($proc.Id) on 1056"

# 3) Wait for the port; probe the endpoint and health.
$up = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  if (Get-NetTCPConnection -LocalPort 1056 -State Listen -ErrorAction SilentlyContinue) { $up = $true; break }
}
Log "port 1056 listening again: $up"
if ($up) {
  $code = & curl.exe -s -o NUL -w "%{http_code}" --max-time 30 -X POST "http://127.0.0.1:1056/api/workspace/deleteSession" -H "Content-Type: application/json" -d '{"sessionId":"probe"}'
  Log "endpoint probe HTTP: $code (404 = route still missing; 401 = auth-only, route registered)"
} else {
  Log "endpoint probe skipped: server did not come up"
}
Remove-Item 'D:\DeepSeekHNS\scripts\probe-gateway.ts' -ErrorAction SilentlyContinue
Remove-Item 'D:\DeepSeekHNS\packages\api\gateway\tests\probe.spec.ts' -ErrorAction SilentlyContinue
Set-Content -Path $log -Value ($out -join "`n") -Encoding utf8
