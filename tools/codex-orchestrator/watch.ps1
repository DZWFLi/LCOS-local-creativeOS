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
$tokenFile = Join-Path $repo '.codex-runtime\local-core-token'

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

function Send-ClaimPrompt([string]$sessionId, [string]$runId, [string]$projectId) {
  $message = "LCOS 接单提示：项目 $projectId 有新待办 run $runId 。请按 lcos-project-context skill 认领并执行。"
  Write-Host "[$(Get-Date -Format HH:mm:ss)] 派单 run $runId -> 会话 $sessionId"
  & $codex resume $sessionId $message
}

function Send-SpawnNew([string]$projectRoot, [string]$runId) {
  Write-Host "[$(Get-Date -Format HH:mm:ss)] 拉起新会话执行 run $runId（目录 $projectRoot）"
  Push-Location $projectRoot
  try {
    & $codex exec --skip-git-repo-check --skill lcos-project-context "处理 LCOS run $runId"
  } finally {
    Pop-Location
  }
}

function Get-DispatchPlan([string]$projectId, [array]$sessions) {
  if (-not (Test-Path $tokenFile)) {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 没有 Local Core token，跳过 $projectId"
    return @()
  }
  $token = (Get-Content $tokenFile -Raw).Trim()
  $body = @{
    projectId = $projectId
    sessions = @($sessions | ForEach-Object { @{ sessionId = $_.sessionId; guiActive = [bool]$_.guiActive } })
  } | ConvertTo-Json -Depth 5
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:43121/runtime/codex-dispatch-plan" -Method POST `
      -Headers @{ authorization = "Bearer $token" } -ContentType 'application/json' -Body $body -TimeoutSec 15
    return @($response.value)
  } catch {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 获取派单计划失败：$($_.Exception.Message)"
    return @()
  }
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
      $rawSession = $entry.Value
      if ($rawSession.sessionId) {
        $sessions = @($rawSession)
      } else {
        $sessions = @($rawSession | Where-Object { $_.sessionId -and $_.sessionId -notlike '*…*' })
      }
      $state = Get-State
      try {
        $plan = Get-DispatchPlan $projectId $sessions
        foreach ($item in $plan) {
          $runId = [string]$item.runId
          $lastDispatch = $state.lastDispatchByRun.$runId
          if ($lastDispatch -and ((Get-Date) - [datetime]$lastDispatch).TotalMilliseconds -lt $cooldownMs) { continue }
          if ($item.decision -eq 'dispatch_existing') {
            $sessionId = [string]$item.sessionId
            if (Test-SessionBusy $sessionId) {
              Write-Host "[$(Get-Date -Format HH:mm:ss)] $projectId 会话正在写入（GUI 使用中），本轮跳过 run $runId"
              continue
            }
            Send-ClaimPrompt $sessionId $runId $projectId
          } elseif ($item.decision -eq 'spawn_new') {
            Send-SpawnNew ([string]$item.projectRoot) $runId
          } else {
            Write-Host "[$(Get-Date -Format HH:mm:ss)] $projectId run $runId 等待：$($item.reason)"
          }
          if (-not $state.lastDispatchByRun) { $state.lastDispatchByRun = @{} }
          $state.lastDispatchByRun.$runId = (Get-Date -Format o)
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
