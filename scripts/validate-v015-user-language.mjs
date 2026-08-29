#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let ts
try {
  ts = require('typescript')
} catch {
  const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim()
  ts = require(path.join(globalRoot, 'typescript/lib/typescript.js'))
}

const ROOT = process.cwd()
const APP_FILE = path.join(ROOT, 'apps/web/src/App.tsx')
const FEATURES_ROOT = path.join(ROOT, 'apps/web/src/features')
const HELPER_COPY_FILES = [
  path.join(ROOT, 'apps/web/src/features/execution/commandDraft.ts'),
  path.join(ROOT, 'apps/web/src/features/workflow/runEvents.ts'),
]
const FORBIDDEN = [
  ['Core', /\bCore\b/i],
  ['ReceiverRef', /\bReceiverRef\b/i],
  ['ActiveReceiver', /\bActiveReceiver\b/i],
  ['ContextManifest', /\bContextManifest\b/i],
  ['OrderedReference', /\bOrderedReference\b/i],
  ['ResultSlot', /\bResultSlot\b/i],
  ['ChangeSet', /\bChangeSet\b/i],
  ['Projection', /\bProjection\b/i],
  ['PresentationState', /\bPresentationState\b/i],
  ['Provider', /\bProvider\b/i],
  ['Adapter', /\bAdapter\b/i],
  ['RuntimeBinding', /\bRuntimeBinding\b/i],
  ['FTS', /\bFTS\b/i],
  ['Vector', /\bVector\b/i],
  ['Embedding', /\bEmbedding\b/i],
  ['RAG', /\bRAG\b/i],
  ['OCR', /\bOCR\b/i],
  ['MCP', /\bMCP\b/i],
  ['CLI', /\bCLI\b/i],
  ['Session ID', /\bSession\s+ID\b/i],
  ['READ_ONLY', /\bREAD_ONLY\b/i],
  ['PREPARE', /\bPREPARE\b/i],
  ['tokens', /\btokens?\b/i],
  ['Project Truth', /\bProject\s+Truth\b/i],
  ['ConnectedConversation', /\bConnectedConversation\b/i],
  ['Receiver Glyth', /\bReceiver\s+Glyth\b/i],
  ['Context Pack', /\bContext\s+Pack\b/i],
  ['Checkpoint', /\bCheckpoint\b/i],
  ['Run', /\bRun\b/i],
  ['Runtime', /\bRuntime\b/i],
  ['canonical', /\bcanonical\b/i],
]

const USER_VISIBLE_ATTRIBUTES = new Set(['title', 'aria-label', 'placeholder', 'alt'])
const USER_COPY_CALLS = new Set(['setNotice', 'onNotice', 'setProgress'])
const EXCLUDED_SEGMENTS = ['/diagnostics/', '/__tests__/', '/test/', '/tests/']

function posix(file) {
  return file.split(path.sep).join('/')
}

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

function isExcluded(file) {
  const normalized = `/${posix(path.relative(ROOT, file))}`
  return EXCLUDED_SEGMENTS.some((segment) => normalized.includes(segment))
}

function lineColumn(sourceFile, node) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  return `${posix(path.relative(ROOT, sourceFile.fileName))}:${line + 1}:${character + 1}`
}

function visibleFragments(node) {
  if (!node) return []
  if (ts.isStringLiteralLike(node)) return [node.text]
  if (ts.isTemplateExpression(node)) {
    const values = [node.head.text]
    for (const span of node.templateSpans) {
      values.push(...visibleFragments(span.expression), span.literal.text)
    }
    return values
  }
  if (ts.isConditionalExpression(node)) {
    return [...visibleFragments(node.whenTrue), ...visibleFragments(node.whenFalse)]
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) {
    return visibleFragments(node.expression)
  }
  if (ts.isBinaryExpression(node)) {
    const kind = node.operatorToken.kind
    if (kind === ts.SyntaxKind.PlusToken) return [...visibleFragments(node.left), ...visibleFragments(node.right)]
    if (kind === ts.SyntaxKind.QuestionQuestionToken || kind === ts.SyntaxKind.BarBarToken || kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return [...visibleFragments(node.left), ...visibleFragments(node.right)]
    }
    return []
  }
  return []
}

function checkText(sourceFile, node, text, violations) {
  const compact = String(text).replace(/\s+/g, ' ').trim()
  if (!compact) return
  for (const [label, pattern] of FORBIDDEN) {
    if (!pattern.test(compact)) continue
    violations.push({ location: lineColumn(sourceFile, node), label, text: compact.slice(0, 180) })
  }
}

function scanRenderedFile(file, violations) {
  const text = fs.readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

  function visit(node) {
    if (ts.isJsxText(node)) checkText(sourceFile, node, node.getText(sourceFile), violations)

    if (ts.isJsxAttribute(node) && USER_VISIBLE_ATTRIBUTES.has(node.name.getText(sourceFile)) && node.initializer) {
      for (const value of visibleFragments(node.initializer)) checkText(sourceFile, node, value, violations)
    }

    if (ts.isJsxExpression(node) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      for (const value of visibleFragments(node.expression)) checkText(sourceFile, node, value, violations)
    }

    if (ts.isCallExpression(node)) {
      const expression = node.expression
      const name = ts.isIdentifier(expression)
        ? expression.text
        : ts.isPropertyAccessExpression(expression)
          ? expression.name.text
          : ''
      if (USER_COPY_CALLS.has(name) || /^(?:set|on).*(?:Notice|Message|Error|Progress)$/.test(name)) {
        for (const arg of node.arguments) for (const value of visibleFragments(arg)) checkText(sourceFile, arg, value, violations)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function scanHelperCopyFile(file, violations) {
  const text = fs.readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  function visit(node) {
    if (ts.isReturnStatement(node) && node.expression) {
      for (const value of visibleFragments(node.expression)) checkText(sourceFile, node, value, violations)
    }
    if (ts.isPropertyAssignment(node) && node.name.getText(sourceFile) === 'reason') {
      for (const value of visibleFragments(node.initializer)) checkText(sourceFile, node, value, violations)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

const files = [APP_FILE, ...walk(FEATURES_ROOT)].filter((file, index, all) => all.indexOf(file) === index && !isExcluded(file))
const violations = []
for (const file of files) scanRenderedFile(file, violations)
for (const file of HELPER_COPY_FILES) if (fs.existsSync(file)) scanHelperCopyFile(file, violations)

const unique = [...new Map(violations.map((item) => [`${item.location}|${item.label}|${item.text}`, item])).values()]
if (unique.length) {
  console.error(`v0.15 user-language gate failed: ${unique.length} user-facing internal term(s) found.`)
  for (const item of unique) console.error(`- ${item.location} [${item.label}] ${item.text}`)
  process.exit(1)
}

console.log(`v0.15 user-language gate passed (${files.length} product-surface source files scanned; Diagnostics/tests exempt).`)
