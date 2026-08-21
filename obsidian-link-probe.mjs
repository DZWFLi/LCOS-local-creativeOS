import { mkdtemp, mkdir, symlink, writeFile, lstat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = await mkdtemp(join(tmpdir(), 'lcos-link-probe-'))
const outside = await mkdtemp(join(tmpdir(), 'lcos-link-out-'))
await writeFile(join(outside, 'secret.md'), '# secret')
let err = 'none'
try { await symlink(join(outside, 'secret.md'), join(root, 'linked.md')) } catch (e) { err = e.message }
let st = null
try { st = await lstat(join(root, 'linked.md')) } catch (e) { st = 'ERR: ' + e.message }
console.log('SYMLINK_ERR:', err)
console.log('LSTAT:', st === null ? 'null' : { isSymbolicLink: st.isSymbolicLink(), isFile: st.isFile() })
await rm(root, { recursive: true, force: true }).catch(() => {})
