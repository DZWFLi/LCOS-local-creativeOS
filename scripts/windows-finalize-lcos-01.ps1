[CmdletBinding()]
param(
  [switch]$SkipNpmCi,
  [switch]$LaunchDesktop,
  [switch]$MakeInstaller,
  [string]$QaEvidenceFile
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$evidence = Join-Path $root "evidence/windows-01-$stamp"
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

function Invoke-LcosStep {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][scriptblock]$Command
  )
  $path = Join-Path $evidence "$Name.txt"
  "# $Name`r`n# $(Get-Date -Format o)`r`n" | Out-File -Encoding utf8 $path
  Write-Host "`n==> $Name" -ForegroundColor Cyan
  & $Command *>&1 | Tee-Object -FilePath $path -Append
  $exit = $LASTEXITCODE
  "`r`nEXIT_CODE=$exit" | Out-File -Encoding utf8 -Append $path
  if ($exit -ne 0) {
    throw "Step '$Name' failed with exit code $exit. See $path"
  }
}

function Assert-DesktopQaEvidence {
  param([Parameter(Mandatory=$true)][string]$Path)
  if (-not (Test-Path $Path)) {
    throw "Desktop QA evidence file does not exist: $Path"
  }
  $qa = Get-Content -Raw -Encoding utf8 $Path | ConvertFrom-Json
  if ($qa.status -ne 'PASS') {
    throw "Desktop QA evidence status must be PASS."
  }
  if ($null -eq $qa.checks -or @($qa.checks).Count -ne 8) {
    throw "Desktop QA evidence must contain exactly 8 checks."
  }
  foreach ($check in @($qa.checks)) {
    if ($check.passed -ne $true) {
      throw "Desktop QA check did not pass: $($check.id) $($check.name)"
    }
  }
  if ($null -eq $qa.screenshots -or @($qa.screenshots).Count -lt 1) {
    throw "Desktop QA evidence must include at least one screenshot path."
  }
  foreach ($shot in @($qa.screenshots)) {
    $shotPath = if ([System.IO.Path]::IsPathRooted([string]$shot)) { [string]$shot } else { Join-Path $root ([string]$shot) }
    if (-not (Test-Path $shotPath)) {
      throw "Desktop QA screenshot does not exist: $shotPath"
    }
  }
}

# Reproducible system fingerprint first.
Invoke-LcosStep '00-system' {
  Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsBuildNumber, OsArchitecture
  node --version
  npm --version
  py --version
}

if (-not $SkipNpmCi) {
  Invoke-LcosStep '01-npm-ci' { npm ci }
}

Invoke-LcosStep '02-context-cache-static' { npm run check:context-cache-static }
Invoke-LcosStep '03-gui-final-static' { npm run check:gui:0.1-final }
Invoke-LcosStep '04-typecheck' { npm run typecheck }
Invoke-LcosStep '05-context-cache-contract-tests' {
  npx vitest run `
    apps/local-core/tests/context-prompt-determinism.test.ts `
    apps/local-core/tests/context-prompt-presentation-independence.test.ts `
    apps/local-core/tests/context-prompt-runtime-metadata.test.ts `
    apps/local-core/tests/context-prompt-membership.test.ts `
    apps/local-core/tests/context-prompt-fragment-anchor.test.ts `
    apps/local-core/tests/context-prompt-revision.test.ts `
    apps/local-core/tests/context-prompt-file-relocation.test.ts `
    apps/local-core/tests/context-manifest-service.test.ts `
    apps/local-core/tests/runtime-adapter.test.ts `
    apps/local-core/tests/runtime-application-service.test.ts `
    --maxWorkers=1
}
Invoke-LcosStep '06-deterministic-gate' { npm run check:0.1:deterministic }
Invoke-LcosStep '07-desktop-doctor-ready' { npm run desktop:doctor -- --ready }
Invoke-LcosStep '08-desktop-prepare' { npm run desktop:prepare }

$qaTemplate = [ordered]@{
  schemaVersion = 1
  status = 'PENDING'
  createdAt = (Get-Date -Format o)
  sourceHead = (git rev-parse HEAD).Trim()
  checks = @(
    [ordered]@{ id = 1; name = 'Main Window starts and automatically supervises Core / Bridge'; passed = $false; note = '' },
    [ordered]@{ id = 2; name = 'Tray works'; passed = $false; note = '' },
    [ordered]@{ id = 3; name = 'Capture Float is independent, always-on-top, movable, and remembers position'; passed = $false; note = '' },
    [ordered]@{ id = 4; name = 'Explorer file / text / URL Drop reaches Capture Space'; passed = $false; note = '' },
    [ordered]@{ id = 5; name = 'Capture Space reload preserves presentation'; passed = $false; note = '' },
    [ordered]@{ id = 6; name = 'AI organize only changes Capture Space and does not auto-assign a project'; passed = $false; note = '' },
    [ordered]@{ id = 7; name = 'Semantic Drop to Existing Project succeeds and old target-project nodes do not move'; passed = $false; note = '' },
    [ordered]@{ id = 8; name = 'After close/restart, Runtime and Capture remain healthy'; passed = $false; note = '' }
  )
  screenshots = @()
}
$templatePath = Join-Path $evidence 'WINDOWS_DESKTOP_QA_TEMPLATE.json'
$qaTemplate | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 $templatePath

if ($LaunchDesktop) {
  $escapedRoot = $root.Path.Replace("'", "''")
  Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', "Set-Location '$escapedRoot'; npm run desktop:start"
  )
  Write-Host "Desktop dev process launched in a new PowerShell window." -ForegroundColor Yellow
}

if ($MakeInstaller) {
  if ([string]::IsNullOrWhiteSpace($QaEvidenceFile)) {
    throw "-MakeInstaller requires -QaEvidenceFile <completed QA JSON>. Installer make is fail-closed."
  }
  $resolvedQa = Resolve-Path $QaEvidenceFile
  Assert-DesktopQaEvidence -Path $resolvedQa
  Invoke-LcosStep '09-desktop-doctor-release' { npm run desktop:doctor -- --release }
  Invoke-LcosStep '10-desktop-make-win' { npm run desktop:make:win }

  $setup = Get-ChildItem -Path (Join-Path $root 'apps/desktop/out') -Filter 'LCOS-Setup.exe' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $setup) {
    throw "desktop:make:win returned success but LCOS-Setup.exe was not found under apps/desktop/out."
  }
  Copy-Item -Force $resolvedQa (Join-Path $evidence 'WINDOWS_DESKTOP_QA_PASS.json')
  $setup.FullName | Out-File -Encoding utf8 (Join-Path $evidence 'LCOS_SETUP_PATH.txt')
  Write-Host "Installer: $($setup.FullName)" -ForegroundColor Green
}

$summary = [ordered]@{
  createdAt = (Get-Date -Format o)
  sourceHead = (git rev-parse HEAD).Trim()
  evidenceDir = $evidence
  npmCiSkipped = [bool]$SkipNpmCi
  desktopLaunched = [bool]$LaunchDesktop
  installerRequested = [bool]$MakeInstaller
  qaTemplate = $templatePath
  note = if ($MakeInstaller) { 'Automated gates + manual Windows Desktop QA evidence + installer make completed.' } else { 'Automated Windows preflight completed. Manual Desktop 8-item QA is the next fail-closed gate.' }
}
$summary | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 (Join-Path $evidence 'SUMMARY.json')

Write-Host "`nWindows 0.1 evidence: $evidence" -ForegroundColor Green
Write-Host "QA template: $templatePath" -ForegroundColor Green
if (-not $MakeInstaller) {
  Write-Host "After the 8 manual checks pass, set status=PASS, passed=true for all 8, add real screenshot paths, then rerun with -MakeInstaller -QaEvidenceFile <file>." -ForegroundColor Yellow
}
