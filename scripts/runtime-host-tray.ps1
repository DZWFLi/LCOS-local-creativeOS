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

$repoRoot = if ($env:LCOS_REPO_ROOT) { $env:LCOS_REPO_ROOT } else { (Get-Location).Path }
$logDir = Join-Path $repoRoot ".codex-runtime\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$statusLog = Join-Path $logDir "tray-status.log"

function Invoke-LcosDev([string]$script, [string]$label) {
  $out = Join-Path $logDir "tray-$label.out.log"
  $err = Join-Path $logDir "tray-$label.err.log"
  Start-Process -FilePath "npm.cmd" -ArgumentList @("run", $script) `
    -WorkingDirectory $repoRoot -WindowStyle Hidden `
    -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null
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
  [System.Windows.Forms.MessageBox]::Show($snapshot, "LCOS 状态快照（已复制到剪贴板）", `
    [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
}

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [System.Drawing.SystemIcons]::Application
$tray.Text = "LCOS Runtime Host"

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = $menu.Items.Add("打开 GUI")
$statusItem = $menu.Items.Add("状态快照")
$restartItem = $menu.Items.Add("重启 Core + Bridge")
$exitItem = $menu.Items.Add("完全退出")

$openItem.Add_Click({
  Invoke-LcosDev "dev:open" "open"
})
$statusItem.Add_Click({
  Invoke-LcosStatusSnapshot
})
$restartItem.Add_Click({
  Invoke-LcosDev "dev:stop" "restart-stop"
  Start-Sleep -Seconds 2
  Invoke-LcosDev "dev:open" "restart-open"
})
$exitItem.Add_Click({
  Invoke-LcosDev "dev:stop" "exit-stop"
  $tray.Visible = $false
  $tray.Dispose()
  [System.Windows.Forms.Application]::Exit()
})

$tray.ContextMenuStrip = $menu
$tray.Visible = $true

[System.Windows.Forms.Application]::Run()
