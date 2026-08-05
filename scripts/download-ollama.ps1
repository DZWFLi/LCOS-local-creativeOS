param(
  [string]$Proxy = 'http://127.0.0.1:7897',
  [string]$DestinationDir = 'E:\Codex 项目\OS开发\.worktrees\mvp-fast-build\.codex-runtime\ollama-setup',
  [string]$Url = 'https://ollama.com/download/OllamaSetup.exe'
)

$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force -Path $DestinationDir | Out-Null
$dest = Join-Path $DestinationDir 'OllamaSetup.exe'
$log = Join-Path $DestinationDir 'download.log'

$curlArgs = @(
  '-x', $Proxy,
  '-L',
  '-C', '-',
  '--retry', '20',
  '--retry-all-errors',
  '--connect-timeout', '30',
  '-o', $dest,
  $Url
)

$process = Start-Process -FilePath 'curl.exe' -ArgumentList $curlArgs -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err') -PassThru
Write-Output "DOWNLOAD_PID=$($process.Id)"
Start-Sleep -Seconds 5
if (Test-Path -LiteralPath $dest) {
  Write-Output "INITIAL_BYTES=$((Get-Item -LiteralPath $dest).Length)"
} else {
  Write-Output 'INITIAL_BYTES=0'
}
