import { useMemo, useRef, useState } from 'react'
import { ArrowDownUp, Clock3, FolderOpen, HardDrive, Plus, Search, Trash2, Upload } from 'lucide-react'
import type { ProjectPackage } from '../../model'

interface Props {
  projects: ProjectPackage[]
  openProjectIds: string[]
  onOpen: (projectId: string) => void
  onCreate: () => void
  onDelete?: (project: ProjectPackage) => void
  onImportLcosproj?: (file: File) => void
}

type DriveSort = 'updated' | 'recent' | 'name'

const sortLabels: Record<DriveSort, string> = { updated: '最近更新', recent: '最近打开', name: '名称 A-Z' }

function sortProjects(projects: ProjectPackage[], sort: DriveSort): ProjectPackage[] {
  const copy = [...projects]
  if (sort === 'name') {
    return copy.sort((a, b) => a.label.localeCompare(b.label))
  }
  if (sort === 'recent') {
    return copy.sort((a, b) => String(b.lastOpenedAt ?? '').localeCompare(String(a.lastOpenedAt ?? '')))
  }
  return copy.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
}

export function ProjectDrive({ projects, openProjectIds, onOpen, onCreate, onDelete, onImportLcosproj }: Props) {
  const lcosprojInput = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<DriveSort>('updated')
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return projects
    return projects.filter((project) => `${project.label} ${project.localPath}`.toLowerCase().includes(keyword))
  }, [projects, query])
  const ordered = useMemo(() => sortProjects(filtered, sort), [filtered, sort])
  const recentlyOpened = useMemo(() => sortProjects(
    projects.filter((project) => Boolean(project.lastOpenedAt)),
    'recent',
  ).slice(0, 6), [projects])

  return <main className="project-drive" data-testid="project-drive">
    <header className="project-drive-header">
      <div className="project-drive-brand"><HardDrive size={20} /><span>LOCAL CREATIVE OS</span></div>
      <div className="drive-header-actions">
        {onImportLcosproj && <button className="drive-import chrome-control" onClick={() => lcosprojInput.current?.click()}><Upload size={15} />导入工程文件</button>}
        <input ref={lcosprojInput} hidden type="file" accept=".lcosproj,application/vnd.local-creative-os.project" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file && onImportLcosproj) onImportLcosproj(file); event.currentTarget.value = '' }} />
        <button className="drive-create chrome-control" onClick={onCreate}><Plus size={15} />创建项目</button>
      </div>
    </header>
    <section className="project-drive-hero"><span>项目磁盘</span><h1>继续一个项目</h1><p>每个项目包是一套长期存在的文件、关系、工作视角和 Canvas Scope。这里负责打开现场，不负责用圆环图假装一切井井有条。</p><label className="drive-search"><Search size={17} /><input aria-label="搜索项目" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目或本地目录" /></label></section>
    {recentlyOpened.length > 0 && <section className="project-drive-recent drive-recent-opened"><h2>最近打开</h2>{recentlyOpened.map((project) => <button key={project.id} onClick={() => onOpen(project.id)}><span>{project.label}</span><strong>{project.localPath}</strong><small>{project.lastOpenedAt}</small></button>)}</section>}
    <section className="project-drive-section"><div className="drive-section-title"><h2>本地项目</h2><label className="drive-sort"><ArrowDownUp size={12} /><select aria-label="项目排序" value={sort} onChange={(event) => setSort(event.target.value as DriveSort)}>{(['updated', 'recent', 'name'] as DriveSort[]).map((value) => <option key={value} value={value}>{sortLabels[value]}</option>)}</select></label><span>{filtered.length} 个项目包</span></div><div className="project-folder-grid">{ordered.map((project) => {
      const opened = openProjectIds.includes(project.id)
      return <div className="project-folder" key={project.id}>
        <button className="project-folder-main" onClick={() => onOpen(project.id)}>
          <span className="project-folder-icon"><FolderOpen size={24} /></span>
          <strong>{project.label}</strong>
          <small>{project.localPath}</small>
          <footer><span><Clock3 size={12} />{project.updatedAt}</span>{project.pendingCount > 0 && <b>{project.pendingCount} 个待确认</b>}{opened && <em>已打开</em>}</footer>
        </button>
        {onDelete && <button className="project-folder-delete" aria-label={`删除项目 ${project.label}`} title="从 LCOS 移除（源文件保留）" onClick={() => onDelete(project)}><Trash2 size={13} /></button>}
      </div>
    })}<button className="project-folder project-folder-new" onClick={onCreate}><span className="project-folder-icon"><Plus size={24} /></span><strong>空白项目</strong><small>创建 Root Canvas 后直接拖入本地文件</small></button></div>{!filtered.length && <div className="drive-empty"><b>没有匹配的项目</b><span>换个关键词，或者创建一个新项目包。</span></div>}</section>
    <section className="project-drive-recent"><h2>最近待处理</h2>{projects.filter((project) => project.pendingCount > 0).map((project) => <button key={project.id} onClick={() => onOpen(project.id)}><span>{project.label}</span><strong>有 {project.pendingCount} 个结果等待确认</strong><small>{project.updatedAt}</small></button>)}</section>
  </main>
}
