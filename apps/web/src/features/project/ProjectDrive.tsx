import { useMemo, useState } from 'react'
import { Clock3, FolderOpen, HardDrive, Plus, Search } from 'lucide-react'
import type { ProjectPackage } from '../../model'

interface Props {
  projects: ProjectPackage[]
  openProjectIds: string[]
  onOpen: (projectId: string) => void
  onCreate: () => void
}

export function ProjectDrive({ projects, openProjectIds, onOpen, onCreate }: Props) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return projects
    return projects.filter((project) => `${project.label} ${project.localPath}`.toLowerCase().includes(keyword))
  }, [projects, query])

  return <main className="project-drive" data-testid="project-drive">
    <header className="project-drive-header"><div className="project-drive-brand"><HardDrive size={20} /><span>LOCAL CREATIVE OS</span></div><button className="drive-create chrome-control" onClick={onCreate}><Plus size={15} />创建项目</button></header>
    <section className="project-drive-hero"><span>项目磁盘</span><h1>继续一个项目</h1><p>每个项目包是一套长期存在的文件、关系、工作视角和 Canvas Scope。这里负责打开现场，不负责用圆环图假装一切井井有条。</p><label className="drive-search"><Search size={17} /><input aria-label="搜索项目" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目或本地目录" /></label></section>
    <section className="project-drive-section"><div className="drive-section-title"><h2>本地项目</h2><span>{filtered.length} 个项目包</span></div><div className="project-folder-grid">{filtered.map((project) => {
      const opened = openProjectIds.includes(project.id)
      return <button className="project-folder" key={project.id} onClick={() => onOpen(project.id)}><span className="project-folder-icon"><FolderOpen size={24} /></span><strong>{project.label}</strong><small>{project.localPath}</small><footer><span><Clock3 size={12} />{project.updatedAt}</span>{project.pendingCount > 0 && <b>{project.pendingCount} 个待确认</b>}{opened && <em>已打开</em>}</footer></button>
    })}<button className="project-folder project-folder-new" onClick={onCreate}><span className="project-folder-icon"><Plus size={24} /></span><strong>空白项目</strong><small>创建 Root Canvas 后直接拖入本地文件</small></button></div>{!filtered.length && <div className="drive-empty"><b>没有匹配的项目</b><span>换个关键词，或者创建一个新项目包。</span></div>}</section>
    <section className="project-drive-recent"><h2>最近待处理</h2>{projects.filter((project) => project.pendingCount > 0).map((project) => <button key={project.id} onClick={() => onOpen(project.id)}><span>{project.label}</span><strong>有 {project.pendingCount} 个结果等待确认</strong><small>{project.updatedAt}</small></button>)}</section>
  </main>
}
