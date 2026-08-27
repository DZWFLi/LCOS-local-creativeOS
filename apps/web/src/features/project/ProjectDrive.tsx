import { useMemo, useRef, useState } from 'react'
import { ArrowDownUp, FolderOpen, HardDrive, Plus, Search, Trash2, Upload } from 'lucide-react'
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
  // A-5b：hero「继续一个项目」大卡已删，「继续」由列表首项承担——默认排序取最近打开（最近使用排最前）。
  const [sort, setSort] = useState<DriveSort>('recent')
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return projects
    return projects.filter((project) => `${project.label} ${project.localPath}`.toLowerCase().includes(keyword))
  }, [projects, query])
  const ordered = useMemo(() => sortProjects(filtered, sort), [filtered, sort])
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
    {firstRun ? <section className="project-drive-hero is-first-run">
      <span>第一次使用 LCOS</span>
      <h1>从一个真实项目开始</h1>
      <p>选择你正在使用的创作文件夹，LCOS 只建立索引和工作现场，不会移动或覆盖原文件。</p>
      <div className="drive-first-run-actions"><button className="primary" onClick={() => onCreate('open')}><FolderOpen size={18}/>打开已有创作文件夹</button><button onClick={() => onCreate('create')}><Plus size={18}/>创建空白项目</button>{onImportLcosproj && <button onClick={() => lcosprojInput.current?.click()}><Upload size={18}/>导入 LCOS 工程文件</button>}</div>
    </section> : <section className="project-drive-title">
      <h1>项目磁盘</h1>
      <label className="drive-search"><Search size={15} /><input aria-label="搜索项目" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目或本地目录" /></label>
    </section>}
    {!firstRun && <section className="project-drive-section"><div className="drive-section-title"><h2>本地项目</h2><label className="drive-sort"><ArrowDownUp size={12} /><select aria-label="项目排序" value={sort} onChange={(event) => setSort(event.target.value as DriveSort)}>{(['updated', 'recent', 'name'] as DriveSort[]).map((value) => <option key={value} value={value}>{sortLabels[value]}</option>)}</select></label><span>{filtered.length} 个项目包</span></div><div className="project-list">{ordered.map((project) => {
      const opened = openProjectIds.includes(project.id)
      return <div className={`project-row${opened ? ' is-open' : ''}`} key={project.id}>
        <button className="project-row-main" onClick={() => onOpen(project.id)}>
          <span className="project-row-icon"><FolderOpen size={17} /></span>
          <span className="project-row-body"><strong>{project.label}</strong><small>{project.localPath} · {project.updatedAt}</small></span>
          {project.pendingCount > 0 && <b className="project-row-pending">{project.pendingCount} 待确认</b>}
          {opened && <em className="project-row-open">已打开</em>}
        </button>
        <div className="project-row-actions">
          {onRevealFolder && <button className="project-row-reveal" aria-label={`打开项目目录 ${project.label}`} title="在资源管理器中打开项目目录" onClick={() => onRevealFolder(project.id)}><FolderOpen size={13} /></button>}
          {onDelete && <button className="project-row-delete" aria-label={`删除项目 ${project.label}`} title="从 LCOS 移除（源文件保留）" onClick={() => onDelete(project)}><Trash2 size={13} /></button>}
        </div>
      </div>
    })}</div>{!filtered.length && <div className="drive-empty"><b>没有匹配的项目</b><span>换个关键词，或者创建一个新项目。</span></div>}</section>}
    {onOpenCaptureSpace && <section className="project-drive-capture"><button type="button" className="project-drive-capture-card" onClick={onOpenCaptureSpace}>
      <strong className="project-drive-capture-title">Capture Space</strong>
      {/* A-5b 占位：此处应展示最近 2~3 个 capture 材料名小字预览（成员叠放语言）。
          launcher 目前只能拿到 capturePendingCount，无最近 capture 列表状态（取数需动 runtime/contracts，本刀禁动），
          接线留给 Wave B-1 Project Folder Object 批次；空态保持「一个空间对象」，不回退成虚线上传框。 */}
      <span className="project-drive-capture-preview">{capturePendingCount > 0 ? `${capturePendingCount} 项捕获等待整理` : '捕获的材料会先落在这里'}</span>
      <small>打开画布 · 智能整理 · Semantic Drop 到已有项目</small>
      {capturePendingCount > 0 && <em className="capture-pending-badge" aria-label={`${capturePendingCount} 项待整理`}>{capturePendingCount}</em>}
    </button></section>}
  </main>
}