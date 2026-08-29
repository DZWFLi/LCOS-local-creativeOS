#!/usr/bin/env node
// S0 census 共享工具：只提供文件读取/解析原语，不包含任何能力清单。
// 纪律：本文件与所有 census-*.mjs 一样，禁止硬编码能力清单（validate-census.mjs 会扫描）。
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function repoPath(...segments) {
  return join(REPO_ROOT, ...segments)
}

export function readText(relativePath) {
  return readFileSync(repoPath(relativePath), 'utf8')
}

export function listFiles(relativeDir, { recursive = false, extension } = {}) {
  const absolute = repoPath(relativeDir)
  if (!existsSync(absolute)) return []
  const out = []
  for (const entry of readdirSync(absolute)) {
    const full = join(absolute, entry)
    if (statSync(full).isDirectory()) {
      if (recursive) out.push(...listFiles(join(relativeDir, entry), { recursive: true, extension }))
    } else if (extension === undefined || entry.endsWith(extension)) {
      out.push(join(relativeDir, entry).replaceAll('\\', '/'))
    }
  }
  return out.sort()
}

/** 提取 TS union 字面量：`export type X = 'a' | 'b' | ...`（支持单行与多行 union）。 */
export function extractStringUnion(source, typeName) {
  const match = new RegExp(`export type ${typeName}\\s*=\\s*([\\s\\S]*?)(?:;|\\n\\s*\\n|\\nexport )`).exec(source)
  if (match === null) return []
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/** 提取 Set 字面量里的字符串：`new Set([ "a", "b" ])`（跨行，直到闭合 `])`）。 */
export function extractSetStrings(source, declaration) {
  const start = source.indexOf(declaration)
  if (start < 0) return []
  const open = source.indexOf('[', start)
  const close = source.indexOf(']', open)
  if (open < 0 || close < 0) return []
  return [...source.slice(open, close).matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
}

/** 从 `tool("name", "desc", {...}, ["a","b"])` 调用中提取（含 required 数组，平衡括号扫描）。 */
export function extractToolCalls(source) {
  const calls = []
  const pattern = /\btool\(\s*(["'])([\w]+)\1/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    let depth = 0
    let end = -1
    for (let i = match.index; i < source.length; i++) {
      const ch = source[i]
      if (ch === '(') depth++
      else if (ch === ')') {
        depth--
        if (depth === 0) { end = i; break }
      }
    }
    if (end < 0) continue
    const body = source.slice(match.index, end + 1)
    const requiredMatch = /\[\s*((?:"[^"]*"\s*,?\s*)*)\]\s*\)\s*$/.exec(body)
    const required = requiredMatch === null
      ? []
      : [...requiredMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
    calls.push({ name: match[2], required, body })
  }
  return calls
}

export function unique(values) {
  return [...new Set(values)]
}
