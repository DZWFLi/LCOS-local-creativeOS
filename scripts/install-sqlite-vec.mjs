import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const VERSION = '0.1.9'
const repoRoot = resolve(import.meta.dirname, '..')
const runtimeRoot = join(repoRoot, '.runtime', 'sqlite-vec')
const packageRoot = join(runtimeRoot, 'package')
mkdirSync(runtimeRoot, { recursive: true })

function run(command, args, cwd = runtimeRoot) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true, shell: process.platform === 'win32' })
  if (result.error || (result.status ?? 1) !== 0) {
    throw new Error(`${command} ${args.join(' ')} 失败\n${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim())
  }
  return result.stdout.trim()
}
function walk(root) {
  const out = []
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, name.name)
    if (name.isDirectory()) out.push(...walk(path)); else out.push(path)
  }
  return out
}
const targetName = process.platform === 'win32' ? 'vec0.dll' : process.platform === 'darwin' ? 'vec0.dylib' : 'vec0.so'
const existing = join(runtimeRoot, targetName)
if (existsSync(existing)) {
  console.log(`sqlite-vec 已存在：${existing}`)
  process.exit(0)
}
rmSync(packageRoot, { recursive: true, force: true })
const platformPackage = process.platform === 'win32'
  ? `sqlite-vec-windows-x64@${VERSION}`
  : process.platform === 'darwin'
    ? (process.arch === 'arm64' ? `sqlite-vec-darwin-arm64@${VERSION}` : `sqlite-vec-darwin-x64@${VERSION}`)
    : process.arch === 'arm64'
      ? `sqlite-vec-linux-arm64@${VERSION}`
      : `sqlite-vec-linux-x64@${VERSION}`
const npmCli = process.env.npm_execpath !== undefined
  ? process.execPath
  : (process.platform === 'win32' ? 'npm.cmd' : 'npm')
const packArgs = process.env.npm_execpath !== undefined
  ? [process.env.npm_execpath, 'pack', platformPackage, '--registry=https://registry.npmjs.org', '--silent']
  : ['pack', platformPackage, '--registry=https://registry.npmjs.org', '--silent']
const archive = run(npmCli, packArgs)
const archivePath = join(runtimeRoot, archive.split(/\r?\n/).at(-1))
run('tar', ['-xf', archivePath], runtimeRoot)
const candidate = walk(packageRoot).find((path) => path.toLowerCase().endsWith(targetName.toLowerCase()))
  ?? walk(join(runtimeRoot, 'package')).find((path) => path.toLowerCase().endsWith(targetName.toLowerCase()))
if (!candidate) throw new Error(`sqlite-vec npm 包中没有找到 ${targetName}`)
renameSync(candidate, existing)
rmSync(archivePath, { force: true })
console.log(`sqlite-vec ${VERSION} 已安装：${existing}`)
console.log('Local Core 下次启动会自动加载；导入和 FTS5 不依赖该扩展。')
