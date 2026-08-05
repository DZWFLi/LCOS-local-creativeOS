param(
  [string]$OutDir = 'C:\Users\1\Desktop\OS开发',
  [string]$ZipName = 'LCOS_Fullstack_GateF_Plus_20260805.zip'
)

$ErrorActionPreference = 'Stop'

$src = Split-Path -Parent $PSScriptRoot
$base = [System.IO.Path]::GetFullPath($src)
$head = (& git -C $src rev-parse --short HEAD 2>$null | Select-Object -First 1).Trim()
if ([string]::IsNullOrWhiteSpace($head)) { $head = 'unknown' }

$zip = Join-Path $OutDir $ZipName
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }

$excludeDirs = @(
  '.git', 'node_modules', 'dist', 'build', 'test-results',
  '.codex-runtime', '.dev-launcher', '.workbuddy', '.agents',
  'coverage', '.data'
)
$excludeFiles = @('.env', '.env.local', '.env.development', '.env.production')
$excludeExts = @('.db', '.sqlite', '.sqlite3', '.log')

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$fs = [System.IO.File]::Open($zip, [System.IO.FileMode]::CreateNew)
$archive = [System.IO.Compression.ZipArchive]::new($fs, [System.IO.Compression.ZipArchiveMode]::Create)
$rootPrefix = ([System.IO.Path]::GetFileNameWithoutExtension($ZipName)) + '/'
$count = 0

function Test-ExcludedPath([string]$filePath, [bool]$isDir) {
  $rel = [System.IO.Path]::GetRelativePath($base, $filePath)
  $parts = $rel.Split([System.IO.Path]::DirectorySeparatorChar)
  foreach ($part in $parts) {
    if ($excludeDirs -contains $part) { return $true }
  }
  if ($isDir) { return $false }
  $name = [System.IO.Path]::GetFileName($filePath)
  if ($excludeFiles -contains $name) { return $true }
  $ext = [System.IO.Path]::GetExtension($name).ToLowerInvariant()
  if ($excludeExts -contains $ext) { return $true }
  return $false
}

function Add-FileEntry([string]$filePath) {
  $rel = [System.IO.Path]::GetRelativePath($base, $filePath).Replace('\', '/')
  $entry = $archive.CreateEntry($rootPrefix + $rel, [System.IO.Compression.CompressionLevel]::Optimal)
  $input = [System.IO.File]::OpenRead($filePath)
  $output = $entry.Open()
  try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
  $script:count++
}

Get-ChildItem -LiteralPath $base -Recurse -Force -File -ErrorAction SilentlyContinue | ForEach-Object {
  if (-not (Test-ExcludedPath $_.FullName $false)) { Add-FileEntry $_.FullName }
}

$buildInfoPath = Join-Path $base 'BUILD_INFO.md'
$buildInfo = Get-Content -LiteralPath $buildInfoPath -Raw
$buildInfo = $buildInfo.Replace('> HEAD：<打包时自动填充>', "> HEAD：$head")
$entry = $archive.CreateEntry($rootPrefix + 'BUILD_INFO.md', [System.IO.Compression.CompressionLevel]::Optimal)
$writer = [System.IO.StreamWriter]::new($entry.Open(), [System.Text.UTF8Encoding]::new($false))
$writer.Write($buildInfo)
$writer.Dispose()
$script:count++

$archive.Dispose()
$fs.Dispose()

$hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLower()
$zipLeaf = [System.IO.Path]::GetFileName($zip)
Set-Content -LiteralPath ($zip + '.sha256') -Value "$hash  $zipLeaf" -Encoding ASCII

Write-Output "HEAD=$head"
Write-Output "ENTRIES=$count"
Write-Output ("SIZE_MB={0}" -f [math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 1))
Write-Output "ZIP=$zip"
Write-Output "SHA256=$hash"
