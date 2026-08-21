# LCOS Desktop Quick Capture (N5)
# Windows PowerShell 5.1 only (WinForms + STA + RegisterHotKey).
# Run mode: tray resident; Ctrl+Alt+C captures current clipboard.
# Test mode: -Test reads clipboard once and submits (for automation).
#
# Submits through CaptureApplicationService (capture/v1); local files require
# the trusted Core Bearer channel.
param([switch]$Test)
$ErrorActionPreference = "Stop"

$repoRoot = if ($env:LCOS_REPO_ROOT) {
  [System.IO.Path]::GetFullPath($env:LCOS_REPO_ROOT)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
}
$coreUrl = if ($env:LCOS_CORE_URL) { $env:LCOS_CORE_URL } else { "http://127.0.0.1:43121" }
$tokenFile = Join-Path $repoRoot ".codex-runtime\local-core-token"

# Keep this source file ASCII-only: Windows PowerShell 5.1 reads UTF-8
# scripts with the system ANSI codepage. JSON escapes keep localized labels.
$labels = ConvertFrom-Json '{"title":"LCOS \u5feb\u901f\u6355\u83b7","ready":"\u70ed\u952e\u5df2\u542f\u52a8: Ctrl+Alt+C","captured":"\u5df2\u6355\u83b7","fail":"\u6355\u83b7\u5931\u8d25","empty":"\u526a\u8d34\u677f\u6ca1\u6709\u53ef\u6355\u83b7\u5185\u5bb9"}'

function Get-LcosBearerToken {
  if (-not (Test-Path $tokenFile)) { throw "Core token file missing: $tokenFile" }
  return (Get-Content $tokenFile -Raw).Trim()
}

function Get-ExtensionToken {
  $response = Invoke-RestMethod -Uri "$coreUrl/runtime/extension-token" -Method POST -TimeoutSec 10
  if (-not $response.ok) { throw "extension token failed: $($response.error.message)" }
  return $response.value.token
}

function Invoke-CaptureV1 {
  param(
    [Parameter(Mandatory)][hashtable]$Request,
    [switch]$Trusted
  )
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
  return "desktop-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
}

function Add-LcosWinForms {
  # Windows PowerShell 5.1: Add-Type -AssemblyName can fail to register the
  # type inside scripts that declare param(). LoadWithPartialName is stable.
  [void][System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
  [void][System.Reflection.Assembly]::LoadWithPartialName("System.Drawing")
}

function Test-CaptureClipboard {
  $results = @()
  try {
    $fileDrop = [System.Windows.Forms.Clipboard]::GetFileDropList()
    if ($null -ne $fileDrop -and $fileDrop.Count -gt 0) {
      foreach ($path in $fileDrop) {
        $isDirectory = [System.IO.Directory]::Exists($path)
        $request = @{
          schemaVersion = 1
          operationId = Get-CaptureOperationId
          capturedAt = [DateTimeOffset]::UtcNow.ToString("o")
          source = @{ kind = "file"; localPath = $path }
          target = @{ mode = "auto" }
        }
        $result = Invoke-CaptureV1 -Request $request -Trusted
        $results += [pscustomobject]@{ kind = if ($isDirectory) { "folder" } else { "file" }; path = $path; destination = $result.destination; receipt = $result.receipt.status }
      }
      return $results
    }
  } catch { $results += [pscustomobject]@{ kind = "file-error"; error = $_.Exception.Message } }

  try {
    $image = [System.Windows.Forms.Clipboard]::GetImage()
    if ($null -ne $image) {
      $ms = New-Object System.IO.MemoryStream
      $image.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $bytes = $ms.ToArray()
      $ms.Dispose()
      $image.Dispose()
      $dataUrl = "data:image/png;base64,$([Convert]::ToBase64String($bytes))"
      $request = @{
        schemaVersion = 1
        operationId = Get-CaptureOperationId
        capturedAt = [DateTimeOffset]::UtcNow.ToString("o")
        source = @{ kind = "image" }
        content = @{ dataUrl = $dataUrl; mimeType = "image/png" }
        target = @{ mode = "auto" }
      }
      $result = Invoke-CaptureV1 -Request $request
      return @([pscustomobject]@{ kind = "image"; destination = $result.destination; receipt = $result.receipt.status })
    }
  } catch { $results += [pscustomobject]@{ kind = "image-error"; error = $_.Exception.Message } }

  try {
    $text = [System.Windows.Forms.Clipboard]::GetText()
    if (-not [string]::IsNullOrWhiteSpace($text)) {
      $trimmed = $text.Trim()
      $isUrl = $trimmed -match "^https?://\S+$"
      if ($isUrl) {
        $request = @{
          schemaVersion = 1
          operationId = Get-CaptureOperationId
          capturedAt = [DateTimeOffset]::UtcNow.ToString("o")
          source = @{ kind = "link"; sourceUrl = $trimmed }
          target = @{ mode = "auto" }
        }
      } else {
        $request = @{
          schemaVersion = 1
          operationId = Get-CaptureOperationId
          capturedAt = [DateTimeOffset]::UtcNow.ToString("o")
          source = @{ kind = "text" }
          content = @{ text = $trimmed }
          target = @{ mode = "auto" }
        }
      }
      $result = Invoke-CaptureV1 -Request $request
      return @([pscustomobject]@{ kind = if ($isUrl) { "url" } else { "text" }; destination = $result.destination; receipt = $result.receipt.status })
    }
  } catch { $results += [pscustomobject]@{ kind = "text-error"; error = $_.Exception.Message } }

  if ($results.Count -eq 0) { return @([pscustomobject]@{ kind = "empty"; note = $labels.empty }) }
  return $results
}

if ($Test) {
  Add-LcosWinForms
  $out = Test-CaptureClipboard
  $out | ConvertTo-Json -Depth 6
  exit 0
}

# ---------- Run mode: tray + hotkey ----------
Add-LcosWinForms

# Pure Win32 hotkey loop: no System.Windows.Forms dependency in the C# type
# (Add-Type referencing WinForms is unreliable on Windows PowerShell 5.1).
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class LcosHotkeyLoop {
  [StructLayout(LayoutKind.Sequential)]
  public struct MSG {
    public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam;
    public uint time; public int ptX; public int ptY;
  }
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
  [DllImport("user32.dll")] public static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);
  [DllImport("user32.dll")] public static extern bool TranslateMessage(ref MSG lpMsg);
  [DllImport("user32.dll")] public static extern IntPtr DispatchMessage(ref MSG lpMsg);
  public static void Run(Action onHotkey) {
    const uint MOD_CONTROL = 0x0002;
    const uint MOD_ALT = 0x0001;
    const int ID = 1;
    const uint WM_HOTKEY = 0x0312;
    if (!RegisterHotKey(IntPtr.Zero, ID, MOD_CONTROL | MOD_ALT, 0x43)) return;
    MSG msg;
    while (GetMessage(out msg, IntPtr.Zero, 0, 0) != 0) {
      if (msg.message == WM_HOTKEY && msg.wParam.ToInt32() == ID) {
        try { onHotkey(); } catch { }
      }
      TranslateMessage(ref msg);
      DispatchMessage(ref msg);
    }
    UnregisterHotKey(IntPtr.Zero, ID);
  }
}
"@

$form = New-Object System.Windows.Forms.Form
$form.WindowState = "Minimized"
$form.ShowInTaskbar = $false
$form.FormBorderStyle = "None"
$form.Opacity = 0
$form.Visible = $false

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Application
$notify.Text = $labels.title
$notify.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$captureItem = $menu.Items.Add("$($labels.captured) (Ctrl+Alt+C)")
$exitItem = $menu.Items.Add("Exit")

function Show-CaptureResult {
  try {
    $result = Test-CaptureClipboard
    $summary = ($result | ForEach-Object { "$($_.kind):$($_.destination)" }) -join ", "
    $notify.ShowBalloonTip(2500, $labels.title, "$($labels.captured): $summary", [System.Windows.Forms.ToolTipIcon]::Info)
  } catch {
    $notify.ShowBalloonTip(2500, $labels.title, "$($labels.fail): $($_.Exception.Message)", [System.Windows.Forms.ToolTipIcon]::Error)
  }
}

$captureItem.Add_Click({ Show-CaptureResult })
$exitItem.Add_Click({
  $notify.Visible = $false
  $notify.Dispose()
  $form.Close()
})
$notify.ContextMenuStrip = $menu

# Ctrl+Alt+C hotkey thread (RegisterHotKey with NULL hwnd + message loop).
$form.CreateControl() | Out-Null
$hotkeyCallback = [System.Action]{ $form.BeginInvoke([System.Action]{ Show-CaptureResult }) | Out-Null }
$hotkeyThread = [System.Threading.Thread]::new([System.Threading.ThreadStart]{ [LcosHotkeyLoop]::Run($hotkeyCallback) })
$hotkeyThread.IsBackground = $true
$hotkeyThread.Start()
$notify.ShowBalloonTip(1500, $labels.title, $labels.ready, [System.Windows.Forms.ToolTipIcon]::Info)
[System.Windows.Forms.Application]::Run($form)
