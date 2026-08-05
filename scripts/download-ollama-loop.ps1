param(
  [string]$Proxy = 'http://127.0.0.1:7897',
  [string]$DestinationDir = 'E:\Codex 项目\OS开发\.worktrees\mvp-fast-build\.codex-runtime\ollama-setup',
  [long]$TargetBytes = 1563078600,
  [int]$MaxSeconds = 300,
  [int]$MaxIterations = 0
)

$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force -Path $DestinationDir | Out-Null
$dest = Join-Path $DestinationDir 'OllamaSetup.exe'
$log = Join-Path $DestinationDir 'loop.log'
$deadline = (Get-Date).AddHours(6)

while ((Get-Date) -lt $deadline) {
  if ($MaxIterations -gt 0 -and $script:iterations -ge $MaxIterations) { Add-Content -LiteralPath $log -Value 'ITER_LIMIT'; break }
  $size = if (Test-Path -LiteralPath $dest) { (Get-Item -LiteralPath $dest).Length } else { 0 }
  Add-Content -LiteralPath $log -Value "$(Get-Date -Format o) SIZE=$size"
  if ($size -ge $TargetBytes) { Add-Content -LiteralPath $log -Value 'DONE'; break }
  & curl.exe -x $Proxy -L -C - --retry 5 --retry-delay 5 --connect-timeout 30 --max-time $MaxSeconds -o $dest 'https://ollama.com/download/OllamaSetup.exe' 2>> ($log + '.err')
  if ($LASTEXITCODE -eq 0) { Add-Content -LiteralPath $log -Value 'DONE'; break }
  $script:iterations++
  Start-Sleep -Seconds 5
}
