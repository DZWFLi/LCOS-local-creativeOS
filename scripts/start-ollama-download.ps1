$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'download-ollama-loop.ps1'
$process = Start-Process -FilePath 'pwsh' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$script -WindowStyle Hidden -PassThru
Write-Output "DOWNLOAD_LOOP_PID=$($process.Id)"
