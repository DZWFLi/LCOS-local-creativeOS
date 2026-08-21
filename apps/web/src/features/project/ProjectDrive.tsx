import { useMemo, useRef, useState } from 'react'
import { ArrowDownUp, Clock3, FolderOpen, HardDrive, Plus, Search, Trash2, Upload } from 'lucide-react'
import type { ProjectPackage } from '../../model'

interface Props {
  projects: ProjectPackage[]
  openProjectIds: string[]
  onOpen: (projectId: string) => void
  onCreate: (intent?: 'create' | 'open') => void
  onDelete?: (project: ProjectPackage) => void
  onImportLcosproj?: (file: File) => void
  onRevealFolder?: (projectId: string) => void
  capturePendingCount?: number
  onOpenCaptureSpace?: () => void
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

export function ProjectDrive({ projects, openProjectIds, onOpen, onCreate, onDelete, onImportLcosproj, onRevealFolder, capturePendingCount = 0, onOpenCaptureSpace }: Props) {
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
  const firstRun = projects.length === 0 && query.trim() === ''

  return <main className="project-drive" data-testid="project-drive">
    <header className="project-drive-header">
      <div className="project-drive-brand"><HardDrive size={20} /><span>LOCAL CREATIVE OS</span></div>
      <div className="drive-header-actions">
        {!firstRun && onImportLcosproj && <button className="drive-import chrome-control" onClick={() => lcosprojInput.current?.click()}><Upload size={15} />导入工程文件</button>}
        <input ref={lcosprojInput} hidden type="file" accept=".lcosproj,application/vnd.local-creative-os.project" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file && onImportLcosproj) onImportLcosproj(file); event.currentTarget.value = '' }} />
        {!firstRun && <button className="drive-create chrome-control" onClick={() => onCreate('create')}><Plus size={15} />创建项目</button>}
      </div>
    </header>
    <section className={`project-drive-hero ${firstRun ? 'is-first-run' : ''}`}>
      <span>{firstRun ? '第一次使用 LCOS' : '项目磁盘'}</span>
      <h1>{firstRun ? '从一个真实项目开始' : '继续一个项目'}</h1>
      <p>{firstRun ? '选择你正在使用的创作文件夹，LCOS 只建立索引和工作现场，不会移动或覆盖原文件。' : '项目会保留文件、关系、工作视角与 Canvas 现场，随时从上次的位置继续。'}</p>
      {firstRun && <div className="drive-first-run-actions"><button className="primary" onClick={() => onCreate('open')}><FolderOpen size={18}/>打开已有创作文件夹</button><button onClick={() => onCreate('create')}><Plus size={18}/>创建空白项目</button>{onImportLcosproj && <button onClick={() => lcosprojInput.current?.click()}><Upload size={18}/>导入 LCOS 工程文件</button>}</div>}
      {!firstRun && <label className="drive-search"><Search size={17} /><input aria-label="搜索项目" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目或本地目录" /></label>}
    </section>
    {recentlyOpened.length > 0 && <section className="project-drive-recent drive-recent-opened"><h2>最近打开</h2>{recentlyOpened.map((project) => <button key={project.id} onClick={() => onOpen(project.id)}><span>{project.label}</span><strong>{project.localPath}</strong><small>{project.lastOpenedAt}</small></button>)}</section>}
    {onOpenCaptureSpace && <section className="project-drive-capture"><h2>Capture Space</h2><button type="button" className="project-drive-capture-card" onClick={onOpenCaptureSpace}><span>项目之前的常驻画布</span><strong>{capturePendingCount > 0 ? `${capturePendingCount} 项等待整理` : '暂时没有未整理材料'}</strong><small>打开画布 · 智能整理 · Semantic Drop 到已有项目</small></button></section>}
    {!firstRun && <section className="project-drive-section"><div className="drive-section-title"><h2>本地项目</h2><label className="drive-sort"><ArrowDownUp size={12} /><select aria-label="项目排序" value={sort} onChange={(event) => setSort(event.target.value as DriveSort)}>{(['updated', 'recent', 'name'] as DriveSort[]).map((value) => <option key={value} value={value}>{sortLabels[value]}</option>)}</select></label><span>{filtered.length} 个项目包</span></div><div className="project-folder-grid">{ordered.map((project) => {
      const opened = openProjectIds.includes(project.id)
      return <div className="project-folder" key={project.id}>
        <button className="project-folder-main" onClick={() => onOpen(project.id)}>
          <span className="project-folder-icon"><FolderOpen size={24} /></span>
          <strong>{project.label}</strong>
          <small>{project.localPath}</small>
          <footer><span><Clock3 size={12} />{project.updatedAt}</span>{project.pendingCount > 0 && <b>{project.pendingCount} 个待确认</b>}{opened && <em>已打开</em>}</footer>
        </button>
        <div className="project-folder-actions">
          {onRevealFolder && <button className="project-folder-reveal" aria-label={`打开项目目录 ${project.label}`} title="在资源管理器中打开项目目录" onClick={() => onRevealFolder(project.id)}><FolderOpen size={13} /></button>}
          {onDelete && <button className="project-folder-delete" aria-label={`删除项目 ${project.label}`} title="从 LCOS 移除（源文件保留）" onClick={() => onDelete(project)}><Trash2 size={13} /></button>}
        </div>
      </div>
    })}<button className="project-folder project-folder-new" onClick={() => onCreate('create')}><span className="project-folder-icon"><Plus size={24} /></span><strong>空白项目</strong><small>创建后直接拖入本地文件</small></button></div>{!filtered.length && <div className="drive-empty"><b>没有匹配的项目</b><span>换个关键词，或者创建一个新项目。</span></div>}</section>}
    {!firstRun && <section className="project-drive-recent"><h2>最近待处理</h2>{projects.filter((project) => project.pendingCount > 0).map((project) => <button key={project.id} onClick={() => onOpen(project.id)}><span>{project.label}</span><strong>有 {project.pendingCount} 个结果等待确认</strong><small>{project.updatedAt}</small></button>)}</section>}
  </main>
}
