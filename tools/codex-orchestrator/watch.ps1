<#
.SYNOPSIS
  LCOS 看门狗（派单模式）：把 LCOS 待办以“接单提示”送进对应项目的正常 Codex 对话窗口。

.DESCRIPTION
  - 不拉起子对话；不占 Agent 回合（脚本本身零 Agent 开销）。
  - 每 N 秒向 Local Core 请求增量派单计划；Core 优先使用 projectId + provider 的正式 Session Binding。
  - 有首选 Session 时执行 `codex exec resume <session-id>`；没有绑定或绑定失效时只新建一次并原子替换。
  - 禁止使用“最近会话”快捷方式或会话文件修改时间猜测项目会话。
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
$repo = $env:LCOS_ORCHESTRATOR_REPO
if (-not $repo) { $repo = (Split-Path -Parent $PSScriptRoot | Split-Path -Parent) }
$registryPath = $env:LCOS_ORCHESTRATOR_REGISTRY
if (-not $registryPath) { $registryPath = Join-Path $PSScriptRoot 'sessions.json' }
$interval = if ($env:LCOS_ORCHESTRATOR_INTERVAL) { [int]$env:LCOS_ORCHESTRATOR_INTERVAL } else { 60 }
$codex = $env:CODEX_BIN
if (-not $codex) {
  $foundDirectory = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin') -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path (Join-Path $_.FullName 'codex.exe') } |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
  if ($foundDirectory) { $codex = Join-Path $foundDirectory.FullName 'codex.exe' }
}
if (-not $codex) {
  $command = Get-Command codex -ErrorAction SilentlyContinue
  if ($command) { $codex = $command.Source }
}
if (-not $codex) { throw '找不到 codex.exe；请设置 CODEX_BIN 环境变量。' }
$lockFile = Join-Path $env:TEMP 'lcos-orchestrator.lock'
$stateDir = Join-Path $repo '.codex-runtime'
$stateFile = Join-Path $stateDir 'orchestrator-state.json'
$cooldownMs = if ($env:LCOS_ORCHESTRATOR_COOLDOWN_MS) { [long]$env:LCOS_ORCHESTRATOR_COOLDOWN_MS } else { 120000 }
$recentWriteGuardMs = if ($env:LCOS_ORCHESTRATOR_WRITE_GUARD_MS) { [long]$env:LCOS_ORCHESTRATOR_WRITE_GUARD_MS } else { 10000 }
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

function Invoke-CodexCommand([string]$projectRoot, [string]$message, [string]$sessionId, [string]$taskId, [string]$runId, [string]$projectId) {
  $runner = Join-Path $PSScriptRoot 'run-codex-task.mjs'
  if (-not (Test-Path $runner)) { throw "Codex Runner helper 不存在：$runner" }
  if (-not (Test-Path $stateDir)) { New-Item -ItemType Directory -Path $stateDir -Force | Out-Null }
  $safeRunId = ($runId -replace '[^A-Za-z0-9_-]', '_')
  $inputPath = Join-Path $stateDir "codex-launch-$safeRunId-$([guid]::NewGuid().ToString('N')).json"
  $payload = @{
    codexBin = $codex
    projectRoot = $projectRoot
    message = $message
    sessionId = $sessionId
    taskId = $taskId
    runId = $runId
    projectId = $projectId
    bridgeUrl = 'http://127.0.0.1:43122'
    cancellationPollMs = 750
    gracefulCancelMs = 3000
  } | ConvertTo-Json -Depth 5
  Set-Content -Path $inputPath -Value $payload -Encoding UTF8
  $lines = @(& node $runner $inputPath 2>&1)
  $exitCode = $LASTEXITCODE
  $session = $null
  $cancelled = $false
  $sessionInvalid = $false
  $closureObserved = $false
  $taskStatus = $null
  $failureKind = $null
  foreach ($line in $lines) {
    $text = [string]$line
    if ($text.StartsWith('LCOS_CODEX_RESULT:')) {
      try {
        $result = $text.Substring('LCOS_CODEX_RESULT:'.Length) | ConvertFrom-Json
        if ($result.sessionId) { $session = [string]$result.sessionId }
        $cancelled = [bool]$result.cancelled
        $sessionInvalid = [bool]$result.sessionInvalid
        $closureObserved = [bool]$result.closureObserved
        if ($result.taskStatus) { $taskStatus = [string]$result.taskStatus }
        if ($result.failureKind) { $failureKind = [string]$result.failureKind }
        if ($null -ne $result.exitCode) { $exitCode = [int]$result.exitCode }
      } catch {}
    } else {
      Write-Host $text
    }
  }
  Remove-Item $inputPath -Force -ErrorAction SilentlyContinue
  return [pscustomobject]@{
    ExitCode = $exitCode
    SessionId = $session
    Cancelled = $cancelled
    SessionInvalid = $sessionInvalid
    ClosureObserved = $closureObserved
    TaskStatus = $taskStatus
    FailureKind = $failureKind
  }
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

function Send-AutoPrompt([string]$projectRoot, [string]$runId, [string]$projectId, [string]$sessionId, [string]$taskId) {
  $message = "LCOS 接单提示：项目 $projectId 有新待办 run $runId 。请按 lcos-project-context skill 读取当前 Canvas Context，认领并执行。"
  if ($dryRun) {
    $destination = if ($sessionId) { $sessionId } else { "$projectRoot 首选会话" }
    Write-Host "[$(Get-Date -Format HH:mm:ss)] DRY RUN：将派单 run $runId -> $destination"
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
    $execution = Invoke-CodexCommand $projectRoot $message $sessionId $taskId $runId $projectId
    if ($execution.ExitCode -eq 0 -and $execution.ClosureObserved) {
      $confirmedSessionId = if ($execution.SessionId) { $execution.SessionId } else { $sessionId }
      return [pscustomobject]@{ Success = $true; SessionId = $confirmedSessionId; CreatedNew = $false }
    }
    if (-not $execution.SessionInvalid) {
      Write-Host "[$(Get-Date -Format HH:mm:ss)] Codex 本轮未形成可回收结果（$($execution.FailureKind) / $($execution.TaskStatus)），保留首选会话并等待有限重试。"
      return [pscustomobject]@{ Success = $false; SessionId = $sessionId; CreatedNew = $false }
    }
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 首选会话已明确失效，允许降级创建一次新会话"
    Save-CoreSessionBinding $projectId $sessionId $runId 'watchdog' 'stale' 1
  }

  # 没有正式 Project + Provider Session Binding 时，直接创建一次新会话。
  # 禁止使用“最近会话”快捷方式猜测会话，否则可能把任务派进用户正在使用的无关对话。
  Write-Host "[$(Get-Date -Format HH:mm:ss)] 无正式项目会话绑定，创建一次新会话执行 run $runId"
  $execution = Invoke-CodexCommand $projectRoot "LCOS 接单提示：项目 $projectId 有新待办 run $runId。请按 lcos-project-context skill 认领、执行并提交结果。" $null $taskId $runId $projectId
  $createdNew = $true
  if ($execution.ExitCode -ne 0 -or -not $execution.ClosureObserved) {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] 新会话未形成可回收结果（$($execution.FailureKind) / $($execution.TaskStatus)）。"
    return [pscustomobject]@{ Success = $false; SessionId = $execution.SessionId; CreatedNew = $createdNew }
  }
  if (-not $execution.SessionId) {
    Write-Host "[$(Get-Date -Format HH:mm:ss)] Codex 执行成功，但输出未提供 Session ID；不会猜测或覆盖项目绑定。"
  }
  return [pscustomobject]@{ Success = $true; SessionId = $execution.SessionId; CreatedNew = $createdNew }
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
