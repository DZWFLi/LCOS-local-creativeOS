#!/usr/bin/env node
// S0 census-mcp：从 tools/lcos-agent/mcp-server.mjs + executor-tools.mjs 机器提取 MCP 能力。
// 形态（S0-1 摸底实测）：
//   tool("name", "desc", {props}, [required]) 集中注册（两个文件各有一份 tool() 工厂）
//   const ACTIVE_AGENT_TOOL_NAMES = new Set([...])   ← agent 角色可见集
//   export const executorToolNames = new Set([...])   ← executor 角色全集
//   function domainOf(toolName) { if (/…/.test(toolName)) return "domain" … }
// domain 分组不是重写：从源码提取 domainOf 的每条 regex 规则，按源码顺序应用到工具名。
import { extractSetStrings, extractToolCalls, readText } from './census-shared.mjs'

const MCP_MAIN = 'tools/lcos-agent/mcp-server.mjs'
const EXECUTOR_TOOLS = 'tools/lcos-agent/executor-tools.mjs'
const EXECUTOR_ENTRY = 'tools/lcos-agent/mcp-executor-server.mjs'

/** 提取 domainOf 源码规则：[{ kind: 'regex', pattern, domain }] + executor 集合规则。 */
function extractDomainRules(source) {
  const rules = []
  const pattern = /if \((\/.*?\/)\.test\(toolName\)\) return ["'](\w+)["']/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    rules.push({ kind: 'regex', pattern: match[1], domain: match[2] })
  }
  const hasRule = /if \((\w+)\.has\(toolName\)\) return ["'](\w+)["']/g
  while ((match = hasRule.exec(source)) !== null) {
    rules.push({ kind: 'set-has', set: match[1], domain: match[2] })
  }
  return rules
}

export function censusMcp() {
  const mainSource = readText(MCP_MAIN)
  const executorSource = readText(EXECUTOR_TOOLS)
  const entrySource = readText(EXECUTOR_ENTRY)

  const activeAgentTools = extractSetStrings(mainSource, 'ACTIVE_AGENT_TOOL_NAMES = new Set([')
  const executorToolNames = extractSetStrings(executorSource, 'executorToolNames = new Set([')
  const domainRules = extractDomainRules(mainSource)

  const domainOf = (toolName) => {
    for (const rule of domainRules) {
      if (rule.kind === 'regex' && new RegExp(rule.pattern.replace(/^\/|\/$/g, '')).test(toolName)) return rule.domain
      if (rule.kind === 'set-has' && rule.set === 'EXECUTOR_TOOL_NAMES' && executorToolNames.includes(toolName)) return rule.domain
    }
    return 'other'
  }

  const mainCalls = extractToolCalls(mainSource)
  const executorCalls = extractToolCalls(executorSource)
  const allNames = new Set([...mainCalls.map((c) => c.name), ...executorCalls.map((c) => c.name)])

  const items = [...allNames].sort().map((name) => {
    const roles = []
    if (activeAgentTools.includes(name)) roles.push('agent')
    if (executorToolNames.includes(name)) roles.push('executor')
    const definitionFile = executorCalls.some((c) => c.name === name) ? EXECUTOR_TOOLS : MCP_MAIN
    const call = mainCalls.find((c) => c.name === name) ?? executorCalls.find((c) => c.name === name)
    return {
      name,
      domain: domainOf(name),
      roles,
      requiredParams: call?.required ?? [],
      file: definitionFile,
    }
  })

  const domains = {}
  for (const item of items) domains[item.domain] = (domains[item.domain] ?? 0) + 1
  const roleExposure = {
    agent: items.filter((item) => item.roles.includes('agent')).length,
    executor: items.filter((item) => item.roles.includes('executor')).length,
  }
  // 漂移发现：domainOf 规则声明了域但无任何注册工具落入（如 provider 域只剩 CLI 入口）
  const ruleDomains = [...new Set(domainRules.map((rule) => rule.domain))]
  const itemDomains = [...new Set(items.map((item) => item.domain))]
  const deadDomains = ruleDomains.filter((domain) => !itemDomains.includes(domain))

  return {
    source: [MCP_MAIN, EXECUTOR_TOOLS, EXECUTOR_ENTRY],
    entryNote: 'mcp-executor-server.mjs 复用 mcp-server.mjs（LCOS_MCP_ROLE=executor），无独立工具注册',
    serverName: /const SERVER = \{ name: ROLE === "executor" \? "([\w-]+)" : "([\w-]+)", version: "([\w.]+)" \}/.exec(mainSource)?.slice(1) ?? [],
    totalTools: items.length,
    registeredToolCalls: { 'mcp-server.mjs': mainCalls.length, 'executor-tools.mjs': executorCalls.length },
    domains,
    deadDomains,
    roleExposure,
    domainRules,
    items,
  }
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('census-mcp.mjs')) {
  console.log(JSON.stringify(censusMcp(), null, 2))
}
