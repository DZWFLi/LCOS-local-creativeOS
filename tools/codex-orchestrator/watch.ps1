<#
.SYNOPSIS
  LCOS 看门狗（派单模式）：把 LCOS 待办以“接单提示”送进对应项目的正常 Codex 对话窗口。

.DESCRIPTION
  - 不拉起子对话；不占 Agent 回合（脚本本身零 Agent 开销）。
  - 每 N 秒轮询 `lcos run pending`；发现待办后，按 sessions.json 找到该项目
    正常对话的 session id，执行 `codex resume <session-id> "LCOS 接单提示…"`，
    该提示会作为一条用户消息进入那个对话，由它自己的 skill 完成 claim/start/执行/提交。
  - 仅支持 CLI 会话（有稳定 session id）。桌面 App 窗口无官方推送接口。

.CONFIG
  LCOS_ORCHESTRATOR_REPO      LCOS 仓库路径（默认脚本所在仓库根）
  LCOS_ORCHESTRATOR_REGISTRY  sessions.json 路径（默认 ./sessions.json）
  LCOS_ORCHESTRATOR_INTERVAL  轮询间隔秒（默认 60）
  LCOS_ORCHESTRATOR_PROJECTS  可选，逗号分隔；不设则处理注册表里全部项目
  CODEX_BIN                   codex 可执行文件（默认 %LOCALAPPDATA%\OpenAI\Codex\bin\codex.exe）
#>
$ErrorActionPreference = 'Stop'
$repo = $env:LCOS_ORCHESTRATOR_REPO ?? (Split-Path -Parent $PSScriptRoot | Split-Path -Parent)
$registryPath = $env:LCOS_ORCHESTRATOR_REGISTRY ?? (Join-Path $PSScriptRoot 'sessions.json')
$interval = [int]($env:LCOS_ORCHESTRATOR_INTERVAL ?? 60)
$codex = $env:CODEX_BIN
if (-not $codex) {
  $found = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin') -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'codex.exe' } |
    Where-Object { Test-Path $_ } |
    Sort-Object -Descending |
    Select-Object -First 1
  $codex = $found
}
if (-not $codex) {
  $command = Get-Command codex -ErrorAction SilentlyContinue
  $codex = $command?.Source
}
if (-not $codex) { throw '找不到 codex.exe；请设置 CODEX_BIN 环境变量。' }
$lockFile = Join-Path $env:TEMP 'lcos-orchestrator.lock'
$stateDir = Join-Path $repo '.codex-runtime'
$stateFile = Join-Path $stateDir 'orchestrator-state.json'
$cooldownMs = [long]($env:LCOS_ORCHESTRATOR_COOLDOWN_MS ?? 120000)
$recentWriteGuardMs = [long]($env:LCOS_ORCHESTRATOR_WRITE_GUARD_MS ?? 10000)

if (Test-Path $lockFile) {
  Write-Error "已有看门狗在运行（$lockFile）。如需重启请先删除该锁文件。"
  exit 1
}
Set-Content -Path $lockFile -Value (Get-Date -Format o)

function Get-Registry {
  if (-not (Test-Path $registryPath)) {
    throw "找不到会话注册表：$registryPath（参考 sessions.example.json）"
  }
  return (Get-Content $registryPath -Raw | ConvertFrom-Json)
}

function Get-PendingRuns([string]$projectId) {
  Push-Location $repo
  try {
    $raw = & npm.cmd run lcos -- run pending $projectId 2>$null
    $line = ($raw | Out-String).Trim()
    if (-not $line) { return @() }
    $parsed = $line | ConvertFrom-Json
    if (-not $parsed) { return @() }
    return @($parsed)
  } finally {
    Pop-Location
  }
}

function Send-ClaimPrompt([string]$sessionId, [string]$runId, [string]$projectId) {
  $message = "LCOS 接单提示：项目 $projectId 有新待办 run $runId 。请按 lcos-project-context skill 认领并执行。"
  Write-Host "[$(Get-Date -Format HH:mm:ss)] 派单 run $runId -> 会话 $sessionId"
  & $codex resume $sessionId $message
}

function Get-State {
  if (-not (Test-Path $stateFile)) { return @{ lastDispatchBySession = @{} } }
  try { return (Get-Content $stateFile -Raw | ConvertFrom-Json) } catch { return @{ lastDispatchBySession = @{} } }
}

function Save-State($state) {
  New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
  $state | ConvertTo-Json -Depth 6 | Set-Content -Path $stateFile -Encoding UTF8
}

function Test-SessionBusy([string]$sessionId) {
  # 最近 10 秒内会话文件被写过 → 说明 GUI/另一个进程正在用，跳过，避免抢写
  try {
    $sessionDir = Join-Path $env:USERPROFILE '.codex\sessions'
    if (Test-Path $sessionDir) {
      $sessionFile = Get-ChildItem $sessionDir -Filter "$sessionId*" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($sessionFile -and ((Get-Date) - $sessionFile.LastWriteTime).TotalMilliseconds -lt $recentWriteGuardMs) {
        return $true
      }
    }
  } catch { }
  return $false
}

Write-Host "LCOS 看门狗启动：每 ${interval}s 检查；注册表 $registryPath"
try {
  while ($true) {
    $registry = Get-Registry
    $projects = $registry.projects.PSObject.Properties
    foreach ($entry in $projects) {
      $projectId = $entry.Name
      if ($env:LCOS_ORCHESTRATOR_PROJECTS -and ($env:LCOS_ORCHESTRATOR_PROJECTS -split ',' -notcontains $projectId)) { continue }
      $sessionId = $entry.Value.sessionId
      if (-not $sessionId -or $sessionId -like '*…*') { continue }
      if ($entry.Value.guiActive) {
        Write-Host "[$(Get-Date -Format HH:mm:ss)] $projectId 标记为 GUI 会话，跳过派单"
        continue
      }
      $state = Get-State
      $lastDispatch = $state.lastDispatchBySession.$sessionId
      if ($lastDispatch -and ((Get-Date) - [datetime]$lastDispatch).TotalMilliseconds -lt $cooldownMs) { continue }
      if (Test-SessionBusy $sessionId) {
        Write-Host "[$(Get-Date -Format HH:mm:ss)] $projectId 会话正在写入（GUI 使用中），本轮跳过"
        continue
      }
      try {
        $pending = Get-PendingRuns $projectId
        foreach ($run in $pending) {
          Send-ClaimPrompt $sessionId ([string]$run.run.id) $projectId
          $state.lastDispatchBySession.$sessionId = (Get-Date -Format o)
          Save-State $state
        }
      } catch {
        Write-Host "[$(Get-Date -Format HH:mm:ss)] 检查 $projectId 失败：$($_.Exception.Message)"
      }
    }
    Start-Sleep -Seconds $interval
  }
} finally {
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
