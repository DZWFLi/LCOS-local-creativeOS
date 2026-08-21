# DEPRECATED (PASS7 / 0.1 Capture Convergence):
# Historical PowerShell/WinForms Capture prototype only. The authoritative 0.1 desktop
# surface is Electron CaptureWindow + Capture Space. Do not launch this script in the
# normal product path; keep it only for historical/audit reference until post-merge cleanup.
# LCOS Desktop Capture Assistant (N6) + Native OLE drop receiver (N8)
# Windows PowerShell 5.1. Bottom-right floating drop surface.
# - AllowDrop (WinForms wraps OLE IDropTarget): files / folders / .lnk / .url / text / URL
# - Wake: browser extension drag-start signals POST http://127.0.0.1:43123/wake
# - Drop targets: Auto / Staging / Recent Project (from Core registry)
# - No capture happens before the user drops (wake only prepares the surface).
#
# Keep this source file ASCII-only (Windows PowerShell 5.1 reads UTF-8 as ANSI).
$ErrorActionPreference = "Stop"

$repoRoot = if ($env:LCOS_REPO_ROOT) {
  [System.IO.Path]::GetFullPath($env:LCOS_REPO_ROOT)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
}
$coreUrl = if ($env:LCOS_CORE_URL) { $env:LCOS_CORE_URL } else { "http://127.0.0.1:43121" }
$tokenFile = Join-Path $repoRoot ".codex-runtime\local-core-token"
$logDir = Join-Path $repoRoot ".codex-runtime\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$wakeLog = Join-Path $logDir "assistant-wake.log"
$wakeSignal = Join-Path $logDir "wake-signal.txt"

$labels = ConvertFrom-Json '{"title":"LCOS \u6355\u83b7\u52a9\u624b","auto":"\u81ea\u52a8","staging":"\u6682\u5b58","recent":"\u6700\u8fd1","drop":"\u62d6\u5230\u8fd9\u91cc","captured":"\u5df2\u6355\u83b7","fail":"\u5931\u8d25"}'

function Add-LcosWinForms {
  [void][System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
  [void][System.Reflection.Assembly]::LoadWithPartialName("System.Drawing")
}

# Pure Win32 helpers: DPI awareness + no-activate topmost window.
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class LcosNative {
  [DllImport("shcore.dll")]
  public static extern int SetProcessDpiAwareness(int awareness);
  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  public static void EnableDpiAwareness() {
    try { SetProcessDpiAwareness(2); } catch { }
  }
  public static void ShowNoActivate(IntPtr hWnd, int x, int y, int w, int h) {
    const uint SWP_NOZORDER = 0x0004;
    const uint SWP_NOACTIVATE = 0x0010;
    const uint SWP_SHOWWINDOW = 0x0040;
    SetWindowPos(hWnd, new IntPtr(-1), x, y, w, h, SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW);
  }
}
"@
[LcosNative]::EnableDpiAwareness()
Add-LcosWinForms

# ---------- Core submission ----------
function Get-LcosBearerToken {
  if (-not (Test-Path $tokenFile)) { throw "Core token file missing: $tokenFile" }
  return (Get-Content $tokenFile -Raw).Trim()
}

function Get-ExtensionToken {
  $response = Invoke-RestMethod -Uri "$coreUrl/runtime/extension-token" -Method POST -TimeoutSec 10
  if (-not $response.ok) { throw "extension token failed: $($response.error.message)" }
  return $response.value.token
}

function Get-RecentProjects {
  try {
    $bearer = Get-LcosBearerToken
    $registry = Invoke-RestMethod -Uri "$coreUrl/runtime/registry" -Headers @{ Authorization = "Bearer $bearer" } -TimeoutSec 10
    if ($null -ne $registry.value -and $null -ne $registry.value.recentProjects) {
      return @($registry.value.recentProjects | Select-Object -First 3)
    }
  } catch { }
  return @()
}

function Invoke-CaptureV1 {
  param([Parameter(Mandatory)][hashtable]$Request, [switch]$Trusted)
  $bearer = Get-LcosBearerToken
  $extToken = Get-ExtensionToken
  $headers = @{ "x-lcos-token" = $extToken; "content-type" = "application/json" }
  if ($Trusted) { $headers.Authorization = "Bearer $bearer" }
  $json = $Request | ConvertTo-Json -Depth 8
  $response = Invoke-RestMethod -Uri "$coreUrl/capture/v1" -Method POST -Headers $headers -Body $json -TimeoutSec 30
  if (-not $response.ok) { throw "capture failed: $($response.error.message)" }
  return $response.value
}

function Get-CaptureOperationId {
  return "assistant-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
}

# ---------- Shortcut resolution (.lnk / .url) ----------
function Resolve-ShortcutPath {
  param([Parameter(Mandatory)][string]$Path)
  $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($extension -eq ".url") {
    $lines = Get-Content $Path -ErrorAction Stop
    foreach ($line in $lines) {
      if ($line -match "^URL=(.+)$") { return @{ target = $matches[1].Trim(); kind = "url"; exists = $true } }
    }
    return @{ target = $null; kind = "unknown"; exists = $false }
  }
  if ($extension -eq ".lnk") {
    try {
      $shell = New-Object -ComObject WScript.Shell
      $shortcut = $shell.CreateShortcut($Path)
      $target = $shortcut.TargetPath
      if ([string]::IsNullOrWhiteSpace($target)) { return @{ target = $null; kind = "unknown"; exists = $false } }
      $kind = if ([System.IO.Directory]::Exists($target)) { "directory" } elseif ([System.IO.File]::Exists($target)) { "file" } else { "unknown" }
      return @{ target = $target; kind = $kind; exists = $kind -ne "unknown" }
    } catch {
      return @{ target = $null; kind = "unknown"; exists = $false }
    }
  }
  return @{ target = $Path; kind = if ([System.IO.Directory]::Exists($Path)) { "directory" } else { "file" }; exists = $true }
}

# ---------- Drop classification + submit ----------
function Submit-DropData {
  param([System.Windows.Forms.IDataObject]$Data, [string]$TargetMode, [string]$ProjectId)
  $results = @()
  if ($Data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {
    $paths = $Data.GetData([System.Windows.Forms.DataFormats]::FileDrop)
    foreach ($path in $paths) {
      $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
      $resolved = $path
      $kind = if ([System.IO.Directory]::Exists($path)) { "folder" } else { "file" }
      if ($extension -eq ".lnk" -or $extension -eq ".url") {
        $record = Resolve-ShortcutPath -Path $path
        if (-not $record.exists) {
          $results += [pscustomobject]@{ kind = "shortcut"; status = "broken"; path = $path }
          continue
        }
        if ($record.kind -eq "url") {
          $request = @{
            schemaVersion = 1; operationId = Get-CaptureOperationId; capturedAt = [DateTimeOffset]::UtcNow.ToString("o")
            source = @{ kind = "link"; sourceUrl = $record.target }; target = @{ mode = $TargetMode; projectId = $ProjectId }
          }
          if ($TargetMode -ne "project") { $request.target = @{ mode = $TargetMode } }
          $result = Invoke-CaptureV1 -Request $request
          $results += [pscustomobject]@{ kind = "url"; status = "ok"; destination = $result.destination }
          continue
        }
        $resolved = $record.target
        $kind = $record.kind
      }
      $request = @{
        schemaVersion = 1; operationId = Get-CaptureOperationId; capturedAt = [DateTimeOffset]::UtcNow.ToString("o")
        source = @{ kind = "file"; localPath = $resolved }; target = @{ mode = $TargetMode; projectId = $ProjectId }
      }
      if ($TargetMode -ne "project") { $request.target = @{ mode = $TargetMode } }
      $result = Invoke-CaptureV1 -Request $request -Trusted
      $results += [pscustomobject]@{ kind = $kind; status = "ok"; destination = $result.destination }
    }
    return $results
  }
  if ($Data.GetDataPresent([System.Windows.Forms.DataFormats]::Text)) {
    $text = [string]$Data.GetData([System.Windows.Forms.DataFormats]::Text)
    $trimmed = $text.Trim()
    if ($trimmed -match "^https?://\S+$") {
      $request = @{
        schemaVersion = 1; operationId = Get-CaptureOperationId; capturedAt = [DateTimeOffset]::UtcNow.ToString("o")
        source = @{ kind = "link"; sourceUrl = $trimmed }; target = @{ mode = $TargetMode; projectId = $ProjectId }
      }
      if ($TargetMode -ne "project") { $request.target = @{ mode = $TargetMode } }
      $result = Invoke-CaptureV1 -Request $request
      return @([pscustomobject]@{ kind = "url"; status = "ok"; destination = $result.destination })
    }
    $request = @{
      schemaVersion = 1; operationId = Get-CaptureOperationId; capturedAt = [DateTimeOffset]::UtcNow.ToString("o")
      source = @{ kind = "text" }; content = @{ text = $trimmed }; target = @{ mode = $TargetMode; projectId = $ProjectId }
    }
    if ($TargetMode -ne "project") { $request.target = @{ mode = $TargetMode } }
    $result = Invoke-CaptureV1 -Request $request
    return @([pscustomobject]@{ kind = "text"; status = "ok"; destination = $result.destination })
  }
  return @([pscustomobject]@{ kind = "empty"; status = "unsupported" })
}

# ---------- Assistant window ----------
Add-LcosWinForms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$windowWidth = 280
$windowHeight = 118
$margin = 12

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = "None"
$form.StartPosition = "Manual"
$form.Size = New-Object System.Drawing.Size($windowWidth, $windowHeight)
$form.Location = New-Object System.Drawing.Point(($screen.Right - $windowWidth - $margin), ($screen.Bottom - $windowHeight - $margin))
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.AllowDrop = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(24, 25, 32)
$form.Opacity = 0.96

$title = New-Object System.Windows.Forms.Label
$title.Text = $labels.title
$title.ForeColor = [System.Drawing.Color]::White
$title.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$title.Location = New-Object System.Drawing.Point(10, 8)
$title.AutoSize = $true
$form.Controls.Add($title)

$hint = New-Object System.Windows.Forms.Label
$hint.Text = $labels.drop
$hint.ForeColor = [System.Drawing.Color]::FromArgb(160, 165, 178)
$hint.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$hint.Location = New-Object System.Drawing.Point(10, 28)
$hint.AutoSize = $true
$form.Controls.Add($hint)

$status = New-Object System.Windows.Forms.Label
$status.Text = ""
$status.ForeColor = [System.Drawing.Color]::FromArgb(140, 210, 170)
$status.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$status.Location = New-Object System.Drawing.Point(10, 98)
$status.AutoSize = $true
$form.Controls.Add($status)

function Add-DropTarget {
  param([string]$Text, [int]$X, [int]$Width, [string]$Mode, [string]$ProjectId)
  $button = New-Object System.Windows.Forms.Button
  $button.Text = $Text
  $button.Location = New-Object System.Drawing.Point($X, 54)
  $button.Size = New-Object System.Drawing.Size($Width, 34)
  $button.FlatStyle = "Flat"
  $button.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(70, 76, 92)
  $button.BackColor = [System.Drawing.Color]::FromArgb(45, 47, 58)
  $button.ForeColor = [System.Drawing.Color]::White
  $button.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
  $button.AllowDrop = $true
  $button.Add_DragEnter({
    $_.Effect = [System.Windows.Forms.DragDropEffects]::Copy
    $button.BackColor = [System.Drawing.Color]::FromArgb(99, 91, 230)
  })
  $button.Add_DragLeave({ $button.BackColor = [System.Drawing.Color]::FromArgb(45, 47, 58) })
  $button.Add_DragDrop({
    $button.BackColor = [System.Drawing.Color]::FromArgb(45, 47, 58)
    try {
      $mode = $button.Tag.Mode
      $projectId = $button.Tag.ProjectId
      $out = Submit-DropData -Data $_.Data -TargetMode $mode -ProjectId $projectId
      $summary = ($out | ForEach-Object { "$($_.kind):$($_.status)" }) -join ", "
      $status.Text = "$($labels.captured): $summary"
    } catch {
      $status.Text = "$($labels.fail): $($_.Exception.Message)"
    }
  })
  $button.Tag = @{ Mode = $Mode; ProjectId = $ProjectId }
  $form.Controls.Add($button)
}

$recent = Get-RecentProjects
if ($recent.Count -ge 1) {
  $recentWidth = [int](($windowWidth - 26) / 3)
  Add-DropTarget -Text $labels.auto -X 10 -Width $recentWidth -Mode "auto"
  Add-DropTarget -Text $labels.staging -X (14 + $recentWidth) -Width $recentWidth -Mode "staging"
  Add-DropTarget -Text $labels.recent -X (18 + 2 * $recentWidth) -Width $recentWidth -Mode "project" -ProjectId ([string]$recent[0].projectId)
} else {
  $half = [int](($windowWidth - 26) / 2)
  Add-DropTarget -Text $labels.auto -X 10 -Width $half -Mode "auto"
  Add-DropTarget -Text $labels.staging -X (14 + $half) -Width $half -Mode "staging"
}

function Show-Assistant {
  $screenNow = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $x = $screenNow.Right - $windowWidth - $margin
  $y = $screenNow.Bottom - $windowHeight - $margin
  [LcosNative]::ShowNoActivate($form.Handle, $x, $y, $windowWidth, $windowHeight)
}
function Hide-Assistant {
  $form.Hide()
}

# Wake watcher: runtime-host-wake.ps1 writes wake-signal.txt on browser
# drag-start; a main-thread WinForms timer watches for new signals.
$lastWakeSeen = $null
$wakeTimer = New-Object System.Windows.Forms.Timer
$wakeTimer.Interval = 300
$wakeTimer.Add_Tick({
  if (-not (Test-Path $wakeSignal)) { return }
  $stamp = (Get-Item $wakeSignal).LastWriteTimeUtc
  if ($null -eq $lastWakeSeen -or $stamp -gt $lastWakeSeen) {
    $lastWakeSeen = $stamp
    Add-Content -Path $wakeLog -Value ("[{0}] wake shown" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    Show-Assistant
  }
})
$wakeTimer.Start()

$form.Handle | Out-Null
$form.Visible = $false
[System.Windows.Forms.Application]::Run($form)
