import { useEffect, useState } from 'react'
import { Search, Sparkles } from 'lucide-react'
import type { SkillCatalogEntryV1, SkillCatalogReadV1 } from '@local-creative-os/contracts'
import type { LocalCoreClient } from '../../runtime/localCoreClient'

export function AssemblySkillSource({ client, projectId, onNotice }: {
  readonly client: LocalCoreClient
  readonly projectId: string | null
  readonly onNotice?: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [skills, setSkills] = useState<readonly SkillCatalogEntryV1[]>([])
  const [selected, setSelected] = useState<SkillCatalogReadV1 | null>(null)

  useEffect(() => {
    if (!projectId) { setSkills([]); setSelected(null); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void client.projectSkills(projectId, query, controller.signal).then((call) => {
        if (controller.signal.aborted) return
        if (!call.result.ok) { onNotice?.(`Skill Catalog 加载失败：${call.result.error.message}`); return }
        setSkills(call.result.value)
      }).catch(() => onNotice?.('Skill Catalog 加载失败'))
    }, 140)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [client, onNotice, projectId, query])

  const openSkill = async (skill: SkillCatalogEntryV1) => {
    if (!projectId) return
    const call = await client.projectSkill(projectId, skill.id).catch(() => null)
    if (!call?.result.ok) { onNotice?.(call && !call.result.ok ? `Skill 读取失败：${call.result.error.message}` : 'Skill 读取失败'); return }
    setSelected(call.result.value)
  }

  return <div className="assembly-skill-source" data-skill-assembly="read-only">
    <div className="assembly-source-toolbar"><label><Search size={13}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Skills" aria-label="搜索 Skills"/></label></div>
    <div className="assembly-skill-readonly-note">Skills 在 v0.15 先作为能力目录浏览。当前还不能把能力直接装配到对象上，所以这里<strong>不提供假拖拽</strong>。</div>
    <div className="assembly-skill-grid">
      {skills.map((skill) => <button type="button" key={`${skill.source}:${skill.id}`} className="assembly-skill-object" onClick={() => void openSkill(skill)}>
        <span aria-hidden="true"><Sparkles size={15}/></span><strong>{skill.name}</strong><small>{skill.description || skill.source}</small>
      </button>)}
    </div>
    {selected ? <aside className="lcos-popover assembly-skill-preview"><button type="button" aria-label="关闭 Skill 预览" onClick={() => setSelected(null)}>×</button><strong>{selected.id}</strong><pre>{selected.content}</pre></aside> : null}
  </div>
}
