import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ObsidianVaultScanV1 } from '@local-creative-os/contracts'
import { ObsidianImportDialog } from '../src/features/resources/ObsidianImportDialog'

/**
 * 文件夹扫描确认页（上午遗留验收项 #4）：
 * 原生目录选择器无法自动化，这里对确认页的「只读扫描 → 默认勾选 → 过滤 → 导入」逻辑
 * 做源码契约 + SSR 冒烟验证；真人点击验收仍需真机 Obsidian vault。
 */
describe('Obsidian import confirmation page contract', () => {
  const source = readFileSync(new URL('../src/features/resources/ObsidianImportDialog.tsx', import.meta.url), 'utf8')

  it('defaults to selecting all notes only when the scan is small (<=30)', () => {
    expect(source).toContain('scan.noteCount <= 30')
    expect(source).toContain('scan.notes.map((note) => note.relativePath)')
  })

  it('filters by title / relativePath / tags', () => {
    expect(source).toContain('`${note.title} ${note.relativePath} ${note.tags.join(\' \')}`')
  })

  it('imports only confirmed relativePaths and never modifies the vault', () => {
    expect(source).toContain('onImport([...selected])')
    expect(source).toContain('导入后会复制进项目，不修改 Vault')
    expect(source).toContain('disabled={busy || selected.size === 0 || selected.size > 200}')
  })

  it('renders a scan summary page with notes and warnings (SSR smoke)', () => {
    const scan: ObsidianVaultScanV1 = {
      schemaVersion: 1,
      connector: 'obsidian',
      scanId: 'scan-acceptance',
      vaultName: '验收 Vault',
      readOnly: true,
      noteCount: 3,
      totalBytes: 1024,
      notes: [
        { relativePath: 'notes/a.md', title: 'Alpha', size: 10, modifiedAt: '2026-08-11T00:00:00.000Z', tags: ['brand'], outlinks: [] },
        { relativePath: 'notes/b.md', title: 'Beta', size: 10, modifiedAt: '2026-08-11T00:00:00.000Z', tags: [], outlinks: [] },
        { relativePath: 'notes/c.md', title: 'Gamma', size: 10, modifiedAt: '2026-08-11T00:00:00.000Z', tags: ['client'], outlinks: [] },
      ],
      warnings: ['2 篇链接笔记未包含正文'],
      expiresAt: '2026-08-12T00:00:00.000Z',
    }
    const html = renderToString(createElement(ObsidianImportDialog, {
      scan,
      busy: false,
      error: null,
      onClose: () => undefined,
      onImport: () => undefined,
    }))
    expect(html).toContain('验收 Vault')
    expect(html).toContain('Alpha')
    expect(html).toContain('Beta')
    expect(html).toContain('Gamma')
    expect(html).toContain('导入 0 篇')
    expect(html).toContain('2 篇链接笔记未包含正文')
  })
})
