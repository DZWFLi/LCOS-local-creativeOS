param(
  [switch]$WithSemantic,
  [switch]$SkipNpmCi
)

$ErrorActionPreference = 'Continue'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidence = Join-Path $root "evidence/gatef-plus-$stamp"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

function Invoke-Evidence {
  param([string]$Name, [scriptblock]$Command)
  $path = Join-Path $evidence "$Name.txt"
  "# $Name`r`n# $(Get-Date -Format o)`r`n" | Out-File -Encoding utf8 $path
  try {
    & $Command *>&1 | Tee-Object -FilePath $path -Append
    "`r`nEXIT_CODE=$LASTEXITCODE" | Out-File -Encoding utf8 -Append $path
  } catch {
    $_ | Out-String | Out-File -Encoding utf8 -Append $path
    "`r`nEXCEPTION=1" | Out-File -Encoding utf8 -Append $path
  }
}

Invoke-Evidence '00-system' {
  Get-ComputerInfo | Select-Object WindowsProductName,WindowsVersion,OsBuildNumber,OsArchitecture
  node --version
  npm --version
  py --version
  where.exe codex
  codex --version
}
Invoke-Evidence '01-codex-help' { codex --help }
Invoke-Evidence '02-codex-exec-help' { codex exec --help }
Invoke-Evidence '03-codex-mcp-help' { codex mcp --help }
Invoke-Evidence '04-codex-mcp-list-before' { codex mcp list }
Invoke-Evidence '05-bootstrap-doctor' { node scripts/bootstrap-lcos.mjs --doctor-only }
Invoke-Evidence '06-bootstrap' { node scripts/bootstrap-lcos.mjs }
Invoke-Evidence '07-codex-mcp-list-after' {
  codex mcp list
  codex mcp get local-creative-os --json
  codex mcp get lcos-executor --json
}
if (-not $SkipNpmCi) { Invoke-Evidence '08-npm-ci' { npm ci } }
Invoke-Evidence '09-manifest-verify' { npm run audit:manifest:verify }
Invoke-Evidence '10-build-local-core' { npm run build:local-core }
Invoke-Evidence '11-gatef-plus-check' { npm run check:gatef-plus }
Invoke-Evidence '12-conversation-smoke' { npm run smoke:conversation }
Invoke-Evidence '13-mcp-bridge-e2e' { npm run test:lcos-mcp-e2e }
Invoke-Evidence '14-light-bridge-tests' {
  $python = if (Get-Command py -ErrorAction SilentlyContinue) { 'py' } else { 'python' }
  & $python -m pytest tools/light-bridge-kernel/tests -q
}
if ($WithSemantic) {
  Invoke-Evidence '15-install-sqlite-vec' { node scripts/install-sqlite-vec.mjs }
  Invoke-Evidence '16-ollama' {
    ollama --version
    ollama list
  }
  Invoke-Evidence '17-semantic-smoke' {
    $env:LCOS_REQUIRE_SQLITE_VEC='1'
    npm run smoke:conversation-semantic
  }
}

@{
  createdAt = (Get-Date -Format o)
  root = "$root"
  evidence = "$evidence"
  withSemantic = [bool]$WithSemantic
  note = 'Real Codex GUI/session/cancel scenarios still require the manual checklist.'
} | ConvertTo-Json -Depth 4 | Out-File -Encoding utf8 (Join-Path $evidence 'SUMMARY.json')

Write-Host "Evidence written to: $evidence"
