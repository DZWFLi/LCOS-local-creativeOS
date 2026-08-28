import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowDownUp, FolderOpen, HardDrive, Plus, Search, Trash2, Upload } from 'lucide-react'
import type { ProjectPackage } from '../../model'
import type { ProjectSummaryV1, ProjectVisualProfileV0 } from '@local-creative-os/contracts'
import { useLocalCoreClientOrNull } from '../../runtime/LocalCoreClientContext'
import { ProjectGlyphMark } from './ProjectGlyphMark'
import { ProjectVisualProfileControl } from './ProjectVisualProfileControl'

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
  if (sort === 'name') return copy.sort((a, b) => a.label.localeCompare(b.label))
  if (sort === 'recent') return copy.sort((a, b) => String(b.lastOpenedAt ?? '').localeCompare(String(a.lastOpenedAt ?? '')))
  return copy.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
}

function projectHue(projectId: string): number {
  let hash = 0
  for (const char of projectId) hash = (hash * 33 + char.charCodeAt(0)) | 0
  return 205 + (Math.abs(hash) % 115)
}

const PROJECT_TINT_HUES: Readonly<Record<string, number>> = { default: 225, amber: 42, sage: 126, sky: 205, rose: 344, violet: 272 }

function projectPortalHue(projectId: string, profile?: ProjectVisualProfileV0): number {
  if (profile && profile.tintToken !== 'default') return PROJECT_TINT_HUES[profile.tintToken] ?? projectHue(projectId)
  return projectHue(projectId)
}

function relativeTime(value?: string): string {
  if (!value) return '尚无编辑时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diff = Math.max(0, Date.now() - date.getTime())
  if (diff < 60_000) return '刚刚编辑'
  if (diff < 60 * 60_000) return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前编辑`
  if (diff < 24 * 60 * 60_000) return `${Math.max(1, Math.floor(diff / (60 * 60_000)))} 小时前编辑`
  if (diff < 7 * 24 * 60 * 60_000) return `${Math.max(1, Math.floor(diff / (24 * 60 * 60_000)))} 天前编辑`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function ProjectDrive({ projects, openProjectIds, onOpen, onCreate, onDelete, onImportLcosproj, onRevealFolder, capturePendingCount = 0, onOpenCaptureSpace }: Props) {
  const client = useLocalCoreClientOrNull()
  const lcosprojInput = useRef<HTMLInputElement | null>(null)
  const [summaries, setSummaries] = useState<Record<string, ProjectSummaryV1>>({})
  const [visualProfiles, setVisualProfiles] = useState<Record<string, ProjectVisualProfileV0 | undefined>>({})

  useEffect(() => {
    if (client === null || projects.length === 0) { setSummaries({}); setVisualProfiles({}); return }
    let cancelled = false
    void Promise.all(projects.map(async (project) => {
      const [summaryCall, profileCall] = await Promise.all([
        client.projectSummary(project.id).catch(() => null),
        client.projectVisualProfile(project.id).catch(() => null),
      ])
      return { projectId: project.id, summaryCall, profileCall }
    })).then((rows) => {
      if (cancelled) return
      const nextSummaries: Record<string, ProjectSummaryV1> = {}
      const nextProfiles: Record<string, ProjectVisualProfileV0 | undefined> = {}
      for (const row of rows) {
        if (row.summaryCall?.result.ok) nextSummaries[row.projectId] = row.summaryCall.result.value
        if (row.profileCall?.result.ok) nextProfiles[row.projectId] = row.profileCall.result.value
      }
      setSummaries(nextSummaries)
      setVisualProfiles(nextProfiles)
    })
    return () => { cancelled = true }
  }, [client, projects])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<DriveSort>('recent')
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return projects
    return projects.filter((project) => `${project.label} ${project.localPath}`.toLowerCase().includes(keyword))
  }, [projects, query])
  const ordered = useMemo(() => {
    if (sort !== 'updated') return sortProjects(filtered, sort)
    return [...filtered].sort((a, b) => String(summaries[b.id]?.lastMeaningfulEditedAt ?? b.updatedAt ?? '').localeCompare(String(summaries[a.id]?.lastMeaningfulEditedAt ?? a.updatedAt ?? '')))
  }, [filtered, sort, summaries])
  const firstRun = projects.length === 0 && query.trim() === ''

  return <main className="project-drive project-launcher" data-testid="project-drive">
    <header className="project-drive-header">
      <div className="project-drive-brand"><HardDrive size={18}/><span>LCOS</span></div>
      <div className="drive-header-actions">
        {!firstRun && onImportLcosproj && <button className="drive-import chrome-control" onClick={() => lcosprojInput.current?.click()}><Upload size={14}/>导入</button>}
        <input ref={lcosprojInput} hidden type="file" accept=".lcosproj,application/vnd.local-creative-os.project" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file && onImportLcosproj) onImportLcosproj(file); event.currentTarget.value = '' }} />
        {!firstRun && <button className="drive-create chrome-control" onClick={() => onCreate('create')}><Plus size={14}/>新建项目</button>}
      </div>
    </header>

    {firstRun ? <section className="project-drive-hero is-first-run">
      <span>第一次使用 LCOS</span>
      <h1>从一个真实项目开始</h1>
      <p>选择你正在使用的创作文件夹。LCOS 建立项目现场和索引，不移动或覆盖源文件。</p>
      <div className="drive-first-run-actions"><button className="primary" onClick={() => onCreate('open')}><FolderOpen size={18}/>打开已有创作文件夹</button><button onClick={() => onCreate('create')}><Plus size={18}/>创建空白项目</button>{onImportLcosproj && <button onClick={() => lcosprojInput.current?.click()}><Upload size={18}/>导入 LCOS 工程</button>}</div>
    </section> : <>
      <section className="project-launcher-intro">
        <div><span>PROJECTS</span><h1>回到你的项目</h1></div>
        <label className="drive-search"><Search size={15}/><input aria-label="搜索项目" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目" /></label>
        <label className="drive-sort"><ArrowDownUp size={12}/><select aria-label="项目排序" value={sort} onChange={(event) => setSort(event.target.value as DriveSort)}>{(['recent', 'updated', 'name'] as DriveSort[]).map((value) => <option key={value} value={value}>{sortLabels[value]}</option>)}</select></label>
      </section>

      <section className="project-portal-section" aria-label="项目入口">
        <div className="project-portal-grid">
          {ordered.map((project) => {
            const opened = openProjectIds.includes(project.id)
            const summary = summaries[project.id]
            const profile = visualProfiles[project.id]
            const timestamp = summary?.lastMeaningfulEditedAt ?? project.updatedAt ?? project.lastOpenedAt
            return <article className={`project-portal-wrap${opened ? ' is-open' : ''}`} key={project.id}>
              <button
                type="button"
                className="project-portal"
                style={{ '--project-portal-hue': projectPortalHue(project.id, profile) } as CSSProperties}
                onClick={() => onOpen(project.id)}
                aria-label={`打开项目 ${project.label}`}
              >
                <span className="project-portal-surface" aria-hidden="true"/>
                <ProjectGlyphMark label={`${project.label} project mark`} variantSeed={project.id} shapeId={profile?.glythMarkId} color={profile?.glythMarkColor} scale={profile?.scale} orientation={profile?.orientation} size={76}/>
                <span className="project-portal-state">{opened ? 'OPEN' : 'PROJECT'}</span>
              </button>
              <div className="project-portal-meta">
                <strong>{project.label}</strong>
                <span>{summary ? `${summary.objectCount} 个对象` : '— 个对象'} · {relativeTime(timestamp)}</span>
              </div>
              <div className="project-portal-actions">
                {client && <ProjectVisualProfileControl client={client} projectId={project.id} projectLabel={project.label} profile={profile} onProfileChange={(next) => setVisualProfiles((current) => ({ ...current, [project.id]: next }))}/>}
                {onRevealFolder && <button type="button" aria-label={`打开项目目录 ${project.label}`} title="在资源管理器中打开" onClick={() => onRevealFolder(project.id)}><FolderOpen size={13}/></button>}
                {onDelete && <button type="button" className="is-destructive" aria-label={`移除项目 ${project.label}`} title="从 LCOS 移除，源文件保留" onClick={() => onDelete(project)}><Trash2 size={13}/></button>}
              </div>
            </article>
          })}

          <article className="project-portal-wrap is-create">
            <button type="button" className="project-portal project-create-portal" onClick={() => onCreate('create')} aria-label="创建项目"><span className="project-portal-surface" aria-hidden="true"/><Plus size={28}/><span>新建项目</span></button>
          </article>
        </div>
        {!filtered.length && <div className="drive-empty"><b>没有匹配的项目</b><span>换个关键词。</span></div>}
      </section>

      {onOpenCaptureSpace && <section className="project-capture-inbox">
        <button type="button" onClick={onOpenCaptureSpace} aria-label="打开 Capture 装配来源">
          <span>Capture</span><strong>{capturePendingCount > 0 ? `${capturePendingCount} new` : 'Inbox'}</strong><small>新材料先停在这里，再决定装到哪个项目。</small>
        </button>
      </section>}
    </>}
  </main>
}
