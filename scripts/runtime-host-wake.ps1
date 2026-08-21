# DEPRECATED (PASS7 / 0.1 Capture Convergence):
# Historical browser-wake bridge for the PowerShell Capture Assistant. The canonical
# extension no longer calls port 43123; Electron CaptureWindow is resident instead.
# Keep for historical/audit reference only until post-merge cleanup.
# LCOS Runtime Host Wake Listener (N7)
# Windows PowerShell 5.1. HTTP listener on 127.0.0.1:43123.
# Browser extension signals drag-start; the assistant surface consumes this
# as "prepare to receive" (no capture happens on wake).
$ErrorActionPreference = "Stop"

$repoRoot = if ($env:LCOS_REPO_ROOT) {
  [System.IO.Path]::GetFullPath($env:LCOS_REPO_ROOT)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
}
$logDir = Join-Path $repoRoot ".codex-runtime\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$wakeLog = Join-Path $logDir "wake.log"
$wakeSignal = Join-Path $logDir "wake-signal.txt"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:43123/")
$listener.Start()

while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    if ($context.Request.HttpMethod -ne "POST" -or $context.Request.Url.AbsolutePath -ne "/wake") {
      $context.Response.StatusCode = 404
      $context.Response.Close()
      continue
    }
    $reader = New-Object System.IO.StreamReader($context.Request.InputStream)
    $body = $reader.ReadToEnd()
    $reader.Dispose()
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $wakeLog -Value ("[{0}] wake: {1}" -f $stamp, $body)
    Set-Content -Path $wakeSignal -Value ("[{0}] {1}" -f $stamp, $body) -Encoding UTF8
    $context.Response.StatusCode = 200
    $context.Response.ContentType = "application/json"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"surface":"pending"}')
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    Add-Content -Path $wakeLog -Value ("[{0}] wake-error: {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $_.Exception.Message)
    $context.Response.StatusCode = 500
  } finally {
    $context.Response.Close()
  }
}
