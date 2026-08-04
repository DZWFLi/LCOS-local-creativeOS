# LCOS Runtime Host Tray (RT-04) — Windows PowerShell + .NET NotifyIcon
#
# ADR: docs/architecture/ADR_RUNTIME_HOST_TRAY_20260803.md (方案 A)
# 零新依赖；只做用户入口，服务生命周期仍由 scripts/dev-launcher.mjs 管理。
#
# 用法（隐藏窗口启动）:
#   powershell -NoProfile -WindowStyle Hidden -File scripts\runtime-host-tray.ps1
# 或
#   npm run tray

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Keep executable string literals ASCII-only because `powershell.exe` 5.1 reads
# UTF-8-without-BOM scripts using the system ANSI codepage. JSON escapes preserve
# localized labels without making script parsing locale-dependent.
$labels = ConvertFrom-Json '{"open":"\u6253\u5f00 GUI","status":"\u72b6\u6001\u5feb\u7167","restart":"\u91cd\u542f Core + Bridge","exit":"\u5b8c\u5168\u9000\u51fa","statusTitle":"LCOS \u72b6\u6001\u5feb\u7167\uff08\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f\uff09","restartFailed":"LCOS \u91cd\u542f\u5931\u8d25"}'

$repoRoot = if ($env:LCOS_REPO_ROOT) {
  [System.IO.Path]::GetFullPath($env:LCOS_REPO_ROOT)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
}
$logDir = Join-Path $repoRoot ".codex-runtime\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$statusLog = Join-Path $logDir "tray-status.log"

# Keep one tray owner. Multiple NotifyIcon processes are confusing and can race
# each other when stopping/restarting the same Runtime Host.
$mutex = New-Object System.Threading.Mutex($false, "Local\LCOS_Runtime_Host_Tray_v1")
$ownsMutex = $false
try {
  $ownsMutex = $mutex.WaitOne(0, $false)
} catch [System.Threading.AbandonedMutexException] {
  $ownsMutex = $true
}
if (-not $ownsMutex) {
  $mutex.Dispose()
  exit 0
}

function Invoke-LcosDev([string]$script, [string]$label) {
  $out = Join-Path $logDir "tray-$label.out.log"
  $err = Join-Path $logDir "tray-$label.err.log"
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run", $script) `
    -WorkingDirectory $repoRoot -WindowStyle Hidden `
    -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null
}

function Invoke-LcosDevAndWait([string]$script, [string]$label, [int]$timeoutMs = 30000) {
  $out = Join-Path $logDir "tray-$label.out.log"
  $err = Join-Path $logDir "tray-$label.err.log"
  $process = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", $script) `
    -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $out -RedirectStandardError $err
  if (-not $process.WaitForExit($timeoutMs)) {
    throw "LCOS command timed out: npm run $script"
  }
  return $process.ExitCode
}

function Invoke-LcosStatusSnapshot {
  $out = Join-Path $logDir "tray-status.out.log"
  $err = Join-Path $logDir "tray-status.err.log"
  $process = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev:status") `
    -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $out -RedirectStandardError $err
  $process.WaitForExit(30000) | Out-Null
  $snapshot = ""
  if (Test-Path $out) { $snapshot = Get-Content $out -Raw }
  if (Test-Path $err) { $snapshot += (Get-Content $err -Raw) }
  Add-Content -Path $statusLog -Value ("[{0}]`n{1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $snapshot)
  try { Set-Clipboard -Value $snapshot } catch { }
  [System.Windows.Forms.MessageBox]::Show($snapshot, $labels.statusTitle, `
    [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
}

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.SystemIcons]::Application
$tray.Text = "LCOS Runtime Host"

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = $menu.Items.Add($labels.open)
$statusItem = $menu.Items.Add($labels.status)
$restartItem = $menu.Items.Add($labels.restart)
$exitItem = $menu.Items.Add($labels.exit)

$openItem.Add_Click({
  Invoke-LcosDev "dev:open" "open"
})
$tray.Add_DoubleClick({
  Invoke-LcosDev "dev:open" "open"
})
$statusItem.Add_Click({
  Invoke-LcosStatusSnapshot
})
$restartItem.Add_Click({
  try {
    $exitCode = Invoke-LcosDevAndWait "dev:stop" "restart-stop"
    if ($exitCode -ne 0) { throw "dev:stop failed with exit code $exitCode" }
    Invoke-LcosDev "dev:open" "restart-open"
  } catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, $labels.restartFailed, `
      [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  }
})
$exitItem.Add_Click({
  try { Invoke-LcosDevAndWait "dev:stop" "exit-stop" | Out-Null } catch { }
  $tray.Visible = $false
  $tray.Dispose()
  [System.Windows.Forms.Application]::Exit()
})

$tray.ContextMenuStrip = $menu
$tray.Visible = $true

try {
  [System.Windows.Forms.Application]::Run()
} finally {
  $tray.Visible = $false
  $tray.Dispose()
  if ($ownsMutex) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
