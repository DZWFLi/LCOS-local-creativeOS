<#
  Thin Windows entrypoint for the production Node orchestrator.
  Business logic lives in watch.mjs so timeout, concurrency and recovery are
  testable without duplicating a second PowerShell state machine.
#>
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'watch.mjs'
if (-not (Test-Path $script)) { throw "LCOS watchdog entry not found: $script" }
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw '找不到 node.exe；请先安装受支持的 Node.js。' }
& $node.Source $script
exit $LASTEXITCODE
