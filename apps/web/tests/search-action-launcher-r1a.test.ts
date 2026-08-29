import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..', 'src')
const palette = readFileSync(join(root, 'features/shell/CommandPalette.tsx'), 'utf8')
const providers = readFileSync(join(root, 'features/shell/commandPaletteProviders.ts'), 'utf8')
const search = readFileSync(join(root, 'features/project/ProjectSearchLens.tsx'), 'utf8')

describe('F6 R1A Search / Action Launcher product contract', () => {
  it('Ctrl+K is actions-only and no longer exposes content-source IA', () => {
    expect(palette).toContain('placeholder="你想做什么？"')
    expect(palette).toContain('aria-label="查找操作"')
    expect(palette).not.toContain('搜索命令、节点、文件、会话与技能')
    expect(providers).not.toContain('id: \'nodes\'')
    expect(providers).not.toContain('id: \'files\'')
    expect(providers).toContain('交给「${conversation.label}」')
    expect(providers).toContain('再次使用「${skill.name}」')
  })

  it('Search explains relevance and location in user language', () => {
    expect(search).toContain('名字最接近你输入的内容')
    expect(search).toContain('这张图上有相关文字')
    expect(search).toContain('内容意思很接近')
    expect(search).toContain('在 {item.locationCount} 个地方用过')
    expect(search).toContain('它现在还没放在画布上')
    expect(search).not.toContain('Core 还没有返回可定位投影')
    expect(search).not.toContain('标题命中')
    expect(search).not.toContain('语义相近')
  })
})
