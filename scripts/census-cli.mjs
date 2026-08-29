#!/usr/bin/env node
// S0 census-cli：从 tools/lcos-agent/cli.mjs + commands/*.mjs 机器提取 CLI 命令清单。
// 形态（S0-1 摸底实测）：
//   cli.mjs 组合分支:  if (group === "project" && action === "list")
//   cli.mjs 组级分支:  if (group === "doctor")（action 非子命令判别式）
//   cli.mjs 嵌套 action: 组级分支内 if (action === "status")（如 local-ai）
//   cli.mjs 委派:      分支条件 → await import("./commands/x.mjs") run*Command({ action | group, action })
//   commands 模块:     自带 group+action 判别（curation-*）或 action 判别（skill）或自由文本（search）
import { listFiles, readText } from './census-shared.mjs'

const CLI_MAIN = 'tools/lcos-agent/cli.mjs'

/** 以 await import("./commands/x.mjs") 为锚点，向后找最近的含 group === 的分支条件。 */
function extractDelegations(mainSource) {
  const delegations = []
  for (const match of mainSource.matchAll(/await import\(["']\.\/commands\/([\w-]+)\.mjs["']\)/g)) {
    const window = mainSource.slice(Math.max(0, match.index - 300), match.index)
    const condPattern = /if \(([\s\S]{0,200}?)\)\s*\{/g
    let cond = null
    let cm
    while ((cm = condPattern.exec(window)) !== null) {
      if (cm[1].includes('group ===')) cond = cm[1]
    }
    if (cond === null) continue
    delegations.push({
      groups: [...cond.matchAll(/group === ["']([\w-]+)["']/g)].map((g) => g[1]),
      actionGuards: [...cond.matchAll(/action === ["']([\w-]+)["']/g)].map((a) => a[1]),
      module: `tools/lcos-agent/commands/${match[1]}.mjs`,
    })
  }
  return delegations
}

export function censusCli() {
  const mainSource = readText(CLI_MAIN)
  const commandFiles = listFiles('tools/lcos-agent/commands', { extension: '.mjs' })
  const items = []

  // 1) cli.mjs 组合分支：group === "x" && action === "y"（源码顺序）
  let match
  const groupAction = /group === ["']([\w-]+)["']\s*&&\s*(?:\(|\s)?\s*action === ["']([\w-]+)["']/g
  while ((match = groupAction.exec(mainSource)) !== null) {
    const line = mainSource.slice(0, match.index).split('\n').length
    items.push({ group: match[1], action: match[2], file: CLI_MAIN, line })
  }

  // 2) 全部 group 提及（组合与组级都算上下文锚点，保持源码顺序）
  const groupPositions = []
  const groupAny = /group === ["']([\w-]+)["']/g
  while ((match = groupAny.exec(mainSource)) !== null) {
    const followedByAnd = /^\s*&&/.test(mainSource.slice(match.index + match[0].length, match.index + match[0].length + 8))
    groupPositions.push({ group: match[1], index: match.index, standalone: !followedByAnd })
  }

  // 3) cli.mjs 嵌套 action 分支：归最近的左侧 group（上下文锚点）
  const actionOnly = /action === ["']([\w-]+)["']/g
  while ((match = actionOnly.exec(mainSource)) !== null) {
    const action = match[1]
    let owner = null
    for (const gp of groupPositions) {
      if (gp.index < match.index) owner = gp.group
      else break
    }
    if (owner === null) continue
    const line = mainSource.slice(0, match.index).split('\n').length
    const exists = items.some((item) => item.group === owner && item.action === action)
    if (!exists) items.push({ group: owner, action, file: CLI_MAIN, line })
  }

  // 4) 委派模块
  const delegations = extractDelegations(mainSource)
  for (const commandFile of commandFiles) {
    const source = readText(commandFile)
    const delegation = delegations.find((d) => d.module === commandFile)
    const hasActionEnum = /action === ['"]/.test(source)
    const hasGroupActionEnum = /group === ['"][\w-]+['"]\s*&&\s*action === ['"]/.test(source)

    // search 型：action 为自由文本查询，不枚举（action !== 守卫型模块不算——其命令已在 cli.mjs 组合分支登记）
    const hasActionGuard = /action\s*!==/.test(source)
    if (delegation !== undefined && !hasActionEnum && !hasGroupActionEnum && !hasActionGuard) {
      for (const group of delegation.groups) {
        items.push({ group, action: null, actionSemantics: 'free-text-query', file: commandFile, line: null })
      }
      continue
    }
    // 模块自带 group+action 判别：直接采用模块内组名（curation-query/curation-command），与 cli.mjs 重复的跳过
    const ga = /group === ['"]([\w-]+)['"]\s*&&\s*action === ['"]([\w-]+)['"]/g
    while ((match = ga.exec(source)) !== null) {
      const exists = items.some((item) => item.group === match[1] && item.action === match[2])
      if (exists) continue
      const line = source.slice(0, match.index).split('\n').length
      items.push({ group: match[1], action: match[2], file: commandFile, line })
    }
    // 模块仅 action 判别：归委派 group（skill）
    if (delegation !== undefined && !hasGroupActionEnum) {
      const ao = /action === ['"]([\w-]+)['"]/g
      while ((match = ao.exec(source)) !== null) {
        const line = source.slice(0, match.index).split('\n').length
        for (const group of delegation.groups) {
          const exists = items.some((item) => item.group === group && item.action === match[1])
          if (!exists) items.push({ group, action: match[1], file: commandFile, line })
        }
      }
    }
  }

  // 5) 组级分支项：仅当该组无任何 action 项时保留（doctor/capabilities/open 这类无子命令组）
  const groupOnlySeen = new Set()
  for (const gp of groupPositions) {
    if (!gp.standalone || groupOnlySeen.has(gp.group)) continue
    groupOnlySeen.add(gp.group)
    const hasActions = items.some((item) => item.group === gp.group)
    if (hasActions) continue
    const line = mainSource.slice(0, gp.index).split('\n').length
    items.push({ group: gp.group, action: null, actionSemantics: 'no-subcommand', file: CLI_MAIN, line })
  }

  items.sort((a, b) => `${a.group ?? ''}/${a.action ?? ''}`.localeCompare(`${b.group ?? ''}/${b.action ?? ''}`))
  const groups = {}
  for (const item of items) {
    const key = item.group ?? '(module-local)'
    groups[key] = (groups[key] ?? 0) + 1
  }

  return {
    source: [CLI_MAIN, ...commandFiles],
    total: items.length,
    groups,
    delegations,
    items,
  }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('census-cli.mjs')) {
  console.log(JSON.stringify(censusCli(), null, 2))
}
