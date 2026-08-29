#!/usr/bin/env node
// S0 gate（check:census）：
//   1) 新鲜度：提交的 capability-map.v0.json 必须与重生成输出逐字节一致（证明机器生成、无手工漂移）。
//   2) 锚点校验：每个能力项必须能在其声明的源文件文本中找到（反硬编码——生成器编不出不存在的能力）。
//   3) 完整性：七个域齐全、数量非零、关键计数自洽。
//   4) 生成器纪律：census-*.mjs 内不得出现「能力清单式」字面量数组（>8 个工具名样式字符串）。
import { readFileSync, existsSync } from 'node:fs'
import { buildCapabilityMap } from './census-capability-map.mjs'
import { repoPath, readText } from './census-shared.mjs'

const errors = []
const ok = (message) => console.log(`  ok: ${message}`)

// ---------- 1) 新鲜度 ----------
console.log('[1/4] 新鲜度：重生成 == 已提交')
const committedPath = repoPath('docs/census/capability-map.v0.json')
if (!existsSync(committedPath)) {
  errors.push('docs/census/capability-map.v0.json 不存在——先运行 npm run census')
} else {
  const committed = readFileSync(committedPath, 'utf8')
  const regenerated = JSON.stringify(buildCapabilityMap(), null, 2) + '\n'
  if (committed !== regenerated) {
    errors.push('capability-map.v0.json 与源码重生成结果不一致——清单已漂移，运行 npm run census 重新生成（禁止手工编辑）')
  } else {
    ok(`byte-identical (${Buffer.byteLength(committed)} bytes)`)
  }
}

const map = buildCapabilityMap()

// ---------- 2) 锚点校验（反硬编码） ----------
console.log('[2/4] 锚点校验：每个能力项必须能定位到源文件')
{
  const routeSources = new Map(map.routes.source.map((file) => [file, readText(file)]))
  let routeAnchored = 0
  for (const item of map.routes.items) {
    const source = routeSources.get(item.file)
    if (source === undefined) { errors.push(`route 源文件缺失: ${item.file}`); continue }
    const anchored = item.pathPattern !== undefined
      ? source.includes(item.pathPattern)
      : source.includes(`pathname === '${item.path}'`) && source.includes(`method === '${item.method}'`)
    if (!anchored) errors.push(`route 未锚定: ${item.method} ${item.path} @ ${item.file}`)
    else routeAnchored++
  }
  ok(`routes ${routeAnchored}/${map.routes.items.length} 锚定`)

  const cliSources = new Map(map.cli.source.map((file) => [file, readText(file)]))
  let cliAnchored = 0
  for (const item of map.cli.items) {
    const source = cliSources.get(item.file)
    if (source === undefined) { errors.push(`cli 源文件缺失: ${item.file}`); continue }
    if (item.action === null) {
      // 组级/自由文本项：组名必须在任一 cli 源（cli.mjs 委派分支或模块自身）出现
      const anchored = map.cli.source.some((file) => {
        const text = cliSources.get(file)
        return text !== undefined && (text.includes(`group === "${item.group}"`) || text.includes(`group === '${item.group}'`))
      })
      if (!anchored) {
        errors.push(`cli 组未锚定: ${item.group} @ ${item.file}`)
        continue
      }
    } else if (!source.includes(`action === "${item.action}"`) && !source.includes(`action === '${item.action}'`)) {
      errors.push(`cli 命令未锚定: ${item.group} ${item.action} @ ${item.file}`)
      continue
    }
    cliAnchored++
  }
  ok(`cli ${cliAnchored}/${map.cli.items.length} 锚定`)

  const mcpSources = new Map(map.mcp.source.map((file) => [file, readText(file)]))
  let mcpAnchored = 0
  for (const item of map.mcp.items) {
    const source = mcpSources.get(item.file)
    if (source === undefined) { errors.push(`mcp 源文件缺失: ${item.file}`); continue }
    if (!source.includes(`tool("${item.name}"`) && !source.includes(`tool('${item.name}'`)) {
      errors.push(`mcp 工具未锚定: ${item.name} @ ${item.file}`)
      continue
    }
    mcpAnchored++
  }
  ok(`mcp ${mcpAnchored}/${map.mcp.items.length} 锚定`)

  for (const skill of map.skills.items) {
    const source = readText(skill.file)
    if (!source.includes(`name: ${skill.name}`)) errors.push(`skill 未锚定: ${skill.package} @ ${skill.file}`)
  }
  ok(`skills ${map.skills.items.length}/${map.skills.total} 锚定`)
}

// ---------- 3) 完整性 ----------
console.log('[3/4] 完整性：七域齐全 + 计数自洽')
{
  for (const section of ['routes', 'cli', 'mcp', 'skills', 'runtime', 'search', 'desktop']) {
    if (map[section] === undefined) errors.push(`缺少域: ${section}`)
  }
  if (map.routes.total <= 0) errors.push('routes.total 必须大于 0')
  if (map.cli.total <= 0) errors.push('cli.total 必须大于 0')
  if (map.mcp.totalTools <= 0) errors.push('mcp.totalTools 必须大于 0')
  if (map.skills.total <= 0) errors.push('skills.total 必须大于 0')
  if (map.mcp.items.length !== map.mcp.totalTools) errors.push('mcp.items.length !== totalTools')
  if (map.mcp.roleExposure.agent + map.mcp.roleExposure.executor < map.mcp.totalTools) errors.push('mcp 角色暴露计数与总数矛盾')
  if (map.runtime.runStates.length === 0) errors.push('runtime.runStates 为空（提取失败）')
  if (map.runtime.sessionPhases.length === 0) errors.push('runtime.sessionPhases 为空（提取失败）')
  if (map.runtime.controlOperations.some((op) => op.supported && op.anchors.length === 0)) errors.push('控制操作 supported=true 但无锚点')
  ok('结构完整')
}

// ---------- 4) 生成器纪律：反硬编码扫描 ----------
console.log('[4/4] 生成器纪律：census 脚本内禁止硬编码能力清单')
{
  const censusScripts = [
    'scripts/census-shared.mjs', 'scripts/census-routes.mjs', 'scripts/census-cli.mjs',
    'scripts/census-mcp.mjs', 'scripts/census-skills.mjs', 'scripts/census-runtime.mjs',
    'scripts/census-search.mjs', 'scripts/census-desktop.mjs',
  ]
  for (const script of censusScripts) {
    const source = readText(script)
    // 工具名样式字面量（纯小写下划线）成组出现 >8 个 → 硬编码清单嫌疑
    const toolLike = [...source.matchAll(/["']([a-z][a-z_]{3,})["']/g)].map((m) => m[1])
    const counts = new Map()
    for (const name of toolLike) counts.set(name, (counts.get(name) ?? 0) + 1)
    const distinct = counts.size
    if (distinct > 8) {
      // 进一步：这些字面量若与提取出的能力名高度重合，则是真硬编码
      const capabilityNames = new Set([
        ...map.mcp.items.map((i) => i.name),
        ...map.cli.items.map((i) => i.action ?? '').filter(Boolean),
      ])
      let overlap = 0
      for (const name of counts.keys()) if (capabilityNames.has(name)) overlap++
      if (overlap > 8) errors.push(`${script} 疑似硬编码能力清单（${overlap} 个字面量与能力名重合）`)
    }
  }
  ok('生成器无硬编码清单')
}

if (errors.length > 0) {
  console.error('\ncensus gate FAILED:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}
console.log('\ncensus gate PASS')
