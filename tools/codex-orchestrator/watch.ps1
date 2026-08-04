<#
.SYNOPSIS
  LCOS 看门狗（派单模式）：把 LCOS 待办以“接单提示”送进对应项目的正常 Codex 对话窗口。

.DESCRIPTION
  - 不拉起子对话；不占 Agent 回合（脚本本身零 Agent 开销）。
  - 每 N 秒向 Local Core 请求增量派单计划；Core 优先使用 projectId + provider 的正式 Session Binding。
  - 有首选 Session 时执行 `codex exec resume <session-id>`；失效后只允许降级新建一次并原子替换绑定。
  - sessions.json 仅作为旧版手动绑定兼容来源，不再是正式真相。
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
$runOnce = $env:LCOS_ORCHESTRATOR_ONCE -eq '1'
$dryRun = $env:LCOS_ORCHESTRATOR_DRY_RUN -eq '1'

if (Test-Path $lockFile) {
  $ownerPid = 0
  [void][int]::TryParse((Get-Content $lockFile -Raw -ErrorAction SilentlyContinue).Trim(), [ref]$ownerPid)
  if ($ownerPid -gt 0 -and (Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)) {
    Write-Error "已有看门狗在运行（PID $ownerPid）。"
    exit 1
  }
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
Set-Content -Path $lockFile -Value $PID

function Get-CoreToken {
  if (-not (Test-Path $tokenFile)) { return $null }
  $value = (Get-Content $tokenFile -Raw -ErrorAction SilentlyContinue).Trim()
  if (-not $value) { return $null }
  return $value
}

function Save-CoreSessionBinding([string]$projectId, [string]$sessionId, [string]$runId, [string]$origin = 'watchdog', [string]$status = 'active', [int]$failureCount = 0) {
  $token = Get-CoreToken
  if (-not $token -or -not $sessionId) { return }
  try {
    $now = (Get-Date -Format o)
    $body = @{
      externalSessionId = $sessionId
      origin = $origin
      status = $status
      lastSeenAt = $now
      lastRunId = $runId
      failureCount = $failureCount
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "http://127.0.0.1:43121/projects/$([uri]::EscapeDataString($projectId))/provider-sessions/codex" -Method PUT `
      -Headers @{ authorization = "Bearer $token" } -ContentType 'application/json' -Body $body -TimeoutSec 10 | Out-Null
  } catch {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] Session Binding 保存失败：$($_.Exception.Message)"
  }
}

function Get-LatestCodexSessionId([datetime]$since) {
  try {
    $sessionDir = Join-Path $env:USERPROFILE '.codex\sessions'
    if (-not (Test-Path $sessionDir)) { return $null }
    $candidate = Get-ChildItem $sessionDir -Recurse -File -Filter '*.jsonl' -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -ge $since.AddSeconds(-5) } |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if (-not $candidate) { return $null }
    $match = [regex]::Match($candidate.Name, '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')
    if ($match.Success) { return $match.Value }
    return $null
  } catch {
    return $null
  }
}

function Invoke-CodexCommand([string[]]$arguments) {
  & $codex @arguments | ForEach-Object { Write-Host $_ }
  return $LASTEXITCODE
}

function Get-Registry {
  if (-not (Test-Path $registryPath)) {
    return @{ projects = @{} }
  }
  return (Get-Content $registryPath -Raw | ConvertFrom-Json)
}

function Get-CoreProjects {
  if (-not (Test-Path $tokenFile)) {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 没有 Local Core token，无法发现项目"
    return @()
  }
  try {
    $token = (Get-Content $tokenFile -Raw).Trim()
    $response = Invoke-RestMethod -Uri 'http://127.0.0.1:43121/projects' -Method GET `
      -Headers @{ authorization = "Bearer $token" } -TimeoutSec 15
    return @($response.value)
  } catch {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 获取项目目录失败：$($_.Exception.Message)"
    return @()
  }
}

function Get-RegisteredSessions($registry, [string]$projectId) {
  $property = $registry.projects.PSObject.Properties[$projectId]
  if (-not $property) { return @() }
  $raw = $property.Value
  if ($raw.sessionId) { return @($raw) }
  return @($raw | Where-Object { $_.sessionId -and $_.sessionId -notlike '*…*' })
}

function Send-ClaimPrompt([string]$sessionId, [string]$runId, [string]$projectId, [string]$taskId) {
  if ($taskId) {
    try {
      $directBody = @{ sessionId = $sessionId } | ConvertTo-Json
      Invoke-RestMethod -Uri "http://127.0.0.1:43122/v1/tasks/$taskId/direct" -Method POST `
        -ContentType 'application/json' -Body $directBody -TimeoutSec 10 | Out-Null
    } catch {
      Write-Host "[$(Get-Date -Format HH:mm:ss)] 定向 task $taskId 失败：$($_.Exception.Message)"
    }
  }
  $message = "LCOS 接单提示：项目 $projectId 有新待办 run $runId 。请按 lcos-project-context skill 认领并执行。"
  Write-Host "[$(Get-Date -Format HH:mm:ss)] 派单 run $runId -> 会话 $sessionId"
  & $codex exec resume $sessionId $message
}

function Send-AutoPrompt([string]$projectRoot, [string]$runId, [string]$projectId, [string]$sessionId, [string]$taskId) {
  $message = "LCOS 接单提示：项目 $projectId 有新待办 run $runId 。请按 lcos-project-context skill 读取当前 Canvas Context，认领并执行。"
  if ($dryRun) {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] DRY RUN：将派单 run $runId -> $($sessionId ?? "$projectRoot 首选会话")"
    return [pscustomobject]@{ Success = $true; SessionId = $sessionId; CreatedNew = $false }
  }
  if ($taskId -and $sessionId) {
    try {
      $directBody = @{ sessionId = $sessionId } | ConvertTo-Json
      Invoke-RestMethod -Uri "http://127.0.0.1:43122/v1/tasks/$taskId/direct" -Method POST `
        -ContentType 'application/json' -Body $directBody -TimeoutSec 10 | Out-Null
    } catch {
      Write-Host "[$(Get-Date -Format HH:mm:ss)] 定向 task $taskId 失败：$($_.Exception.Message)"
    }
  }

  if ($sessionId) {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 派单 run $runId -> 首选会话 $sessionId"
    $exitCode = Invoke-CodexCommand @('exec', 'resume', $sessionId, $message)
    if ($exitCode -eq 0) {
      return [pscustomobject]@{ Success = $true; SessionId = $sessionId; CreatedNew = $false }
    }
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 首选会话失效，允许降级创建一次新会话"
    Save-CoreSessionBinding $projectId $sessionId $runId 'watchdog' 'stale' 1
  }

  # 无有效正式绑定时，先尝试该目录最近会话；失败后只创建一次新会话。
  $startedAt = Get-Date
  Write-Host "[$(Get-Date -Format HH:mm:ss)] 自动派单 run $runId -> $projectRoot 最近会话"
  $exitCode = Invoke-CodexCommand @('exec', '-C', $projectRoot, 'resume', '--last', $message)
  if ($exitCode -ne 0) {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 无可恢复会话，创建一次新会话执行 run $runId"
    $startedAt = Get-Date
    $exitCode = Invoke-CodexCommand @('exec', '-C', $projectRoot, '--skip-git-repo-check', "LCOS 接单：处理 run $runId（按 lcos-project-context skill 规则认领执行并提交结果）")
  }
  if ($exitCode -ne 0) {
    return [pscustomobject]@{ Success = $false; SessionId = $null; CreatedNew = $false }
  }
  $resolvedSessionId = Get-LatestCodexSessionId $startedAt
  return [pscustomobject]@{ Success = $true; SessionId = $resolvedSessionId; CreatedNew = $true }
}

function Get-DispatchPlan([string]$projectId, [array]$sessions) {
  if (-not (Test-Path $tokenFile)) {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 没有 Local Core token，跳过 $projectId"
    return @()
  }
  $token = (Get-Content $tokenFile -Raw).Trim()
  $body = @{
    projectId = $projectId
    sessions = @($sessions | ForEach-Object {
      @{
        sessionId = $_.sessionId
        guiActive = [bool]$_.guiActive
        busy = (Get-SessionBusy $_.sessionId)
      }
    })
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
  $dispatches = @{}
  if (Test-Path $stateFile) {
    try {
      $stored = Get-Content $stateFile -Raw | ConvertFrom-Json
      if ($stored.lastDispatchByRun) {
        foreach ($entry in $stored.lastDispatchByRun.PSObject.Properties) {
          $dispatches[$entry.Name] = [string]$entry.Value
        }
      }
    } catch {
      Write-Host "[$(Get-Date -Format HH:mm:ss)] 状态文件不可读，将重建：$($_.Exception.Message)"
    }
  }
  return @{ lastDispatchByRun = $dispatches }
}

function Save-State($state) {
  New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
  $state | ConvertTo-Json -Depth 6 | Set-Content -Path $stateFile -Encoding UTF8
}

function Get-SessionBusy([string]$sessionId) {
  # 最近 10 秒内会话文件被写过 → 说明 GUI/另一个进程正在用，跳过，避免抢写
  try {
    $sessionDir = Join-Path $env:USERPROFILE '.codex\sessions'
    if (Test-Path $sessionDir) {
      if ($sessionId -notmatch '^[a-zA-Z0-9-]+$') { return $true }
      $sessionFile = Get-ChildItem $sessionDir -Recurse -File -Filter "*$sessionId*.jsonl" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($sessionFile -and ((Get-Date) - $sessionFile.LastWriteTime).TotalMilliseconds -lt $recentWriteGuardMs) {
        return $true
      }
    }
  } catch { }
  return $false
}

Write-Host "LCOS 看门狗启动：每 ${interval}s 检查；Core 自动发现项目；注册表为可选覆盖"
try {
  while ($true) {
    $registry = Get-Registry
    $projects = Get-CoreProjects
    foreach ($project in $projects) {
      $projectId = [string]$project.id
      if ($env:LCOS_ORCHESTRATOR_PROJECTS -and ($env:LCOS_ORCHESTRATOR_PROJECTS -split ',' -notcontains $projectId)) { continue }
      $sessions = Get-RegisteredSessions $registry $projectId
      $state = Get-State
      try {
        $plan = Get-DispatchPlan $projectId $sessions
        foreach ($item in $plan) {
          $runId = [string]$item.runId
          $lastDispatch = $state.lastDispatchByRun[$runId]
          if ($lastDispatch -and ((Get-Date) - [datetime]$lastDispatch).TotalMilliseconds -lt $cooldownMs) { continue }
          $dispatched = $false
          if ($item.decision -eq 'dispatch_existing') {
            $sessionId = [string]$item.sessionId
            if ($sessionId -and (Get-SessionBusy $sessionId)) {
              Write-Host "[$(Get-Date -Format HH:mm:ss)] $projectId 会话正在写入（GUI 使用中），本轮跳过 run $runId"
              continue
            }
            $dispatchResult = Send-AutoPrompt ([string]$item.projectRoot) $runId $projectId $sessionId ([string]$item.taskId)
            $dispatched = [bool]$dispatchResult.Success
            if ($dispatched -and $dispatchResult.SessionId) {
              Save-CoreSessionBinding $projectId ([string]$dispatchResult.SessionId) $runId 'watchdog' 'active' 0
            }
          } elseif ($item.decision -eq 'spawn_new') {
            $dispatchResult = Send-AutoPrompt ([string]$item.projectRoot) $runId $projectId '' ([string]$item.taskId)
            $dispatched = [bool]$dispatchResult.Success
            if ($dispatched -and $dispatchResult.SessionId) {
              Save-CoreSessionBinding $projectId ([string]$dispatchResult.SessionId) $runId 'watchdog' 'active' 0
            }
          } else {
            Write-Host "[$(Get-Date -Format HH:mm:ss)] $projectId run $runId 等待：$($item.reason)"
          }
          if ($dispatched -and -not $dryRun) {
            $state.lastDispatchByRun[$runId] = (Get-Date -Format o)
            Save-State $state
          }
        }
      } catch {
        Write-Host "[$(Get-Date -Format HH:mm:ss)] 检查 $projectId 失败：$($_.Exception.Message)"
      }
    }
    if ($runOnce) { break }
    Start-Sleep -Seconds $interval
  }
} finally {
  Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}
