#!/usr/bin/env node
// S0 census-routes：从 apps/local-core/src/routes/*.ts + server.ts 机器提取 HTTP 能力。
// 形态（S0-1 摸底实测）：
//   静态：if (method === 'GET' && pathname === '/projects')
//   动态：const graphMatch = /^\/projects\/([^/]+)\/graph$/.exec(pathname)
//         if (method === 'GET' && graphMatch !== null)
// mutationClass 由 method 派生（GET/HEAD/OPTIONS=read；DELETE=delete；POST/PUT/PATCH=mutation），
// proposalMediated 由路径含 'proposal' 派生。不手工维护任何路径清单。
import { listFiles, readText, unique } from './census-shared.mjs'

function regexToTemplate(regexSource) {
  return regexSource
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .replaceAll('\\/', '/')
    .replace(/\(\[\^\/\]\+\)/g, ':id')
    .replace(/\(([\w-]+(?:\|[\w-]+)+)\)/g, '{$1}')
}

export function censusRoutes() {
  const routeFiles = [...listFiles('apps/local-core/src/routes', { extension: '.ts' }), 'apps/local-core/src/server.ts']
  const items = []

  for (const file of routeFiles) {
    const source = readText(file)
    const lines = source.split('\n')
    // 动态路由正则声明：const xMatch = /regex/.exec(pathname)（捕获不含定界斜杠）
    const matchVars = new Map()
    for (const line of lines) {
      const decl = /const (\w+) = \/(.*)\/\.exec\(pathname\)/.exec(line)
      if (decl !== null) matchVars.set(decl[1], decl[2])
    }
    let lineNumber = 0
    for (const line of lines) {
      lineNumber++
      const methods = [...line.matchAll(/method === '([A-Z]+)'/g)].map((m) => m[1])
      if (methods.length === 0) continue
      // 静态路径
      const staticPath = /pathname === '([^']+)'/.exec(line)
      if (staticPath !== null) {
        for (const method of methods) {
          items.push({
            method,
            path: staticPath[1],
            mutationClass: mutationClassOf(method, staticPath[1]),
            file,
            line: lineNumber,
          })
        }
        continue
      }
      // 动态路径：引用已声明的 Match 变量
      for (const [variable, regexSource] of matchVars) {
        if (line.includes(`${variable} !== null`) || line.includes(`${variable} === null`)) {
          if (line.includes(`${variable} === null`)) continue
          for (const method of methods) {
            items.push({
              method,
              path: regexToTemplate(regexSource),
              pathPattern: regexSource,
              mutationClass: mutationClassOf(method, regexSource),
              file,
              line: lineNumber,
            })
          }
        }
      }
    }
  }

  // 去重（同一 file:line:method:path）
  const seen = new Set()
  const deduped = items.filter((item) => {
    const key = `${item.method} ${item.path} @ ${item.file}:${item.line}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const byMethod = {}
  for (const item of deduped) byMethod[item.method] = (byMethod[item.method] ?? 0) + 1
  const byMutationClass = {}
  for (const item of deduped) byMutationClass[item.mutationClass] = (byMutationClass[item.mutationClass] ?? 0) + 1

  return {
    source: routeFiles,
    total: deduped.length,
    byMethod,
    byMutationClass,
    items: deduped,
  }
}

function mutationClassOf(method, path) {
  const upper = method.toUpperCase()
  if (upper === 'GET' || upper === 'HEAD' || upper === 'OPTIONS') return 'read'
  if (upper === 'DELETE') return 'delete'
  return path.includes('proposal') ? 'mutation-proposal' : 'mutation'
}

// 独立运行：node scripts/census-routes.mjs
if (process.argv[1] !== undefined && process.argv[1].endsWith('census-routes.mjs')) {
  console.log(JSON.stringify(censusRoutes(), null, 2))
}
