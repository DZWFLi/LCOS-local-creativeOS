import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Download, FolderOpen, Link2Off, Search, X } from 'lucide-react'
import type { ProviderSessionBindingV1 } from '@local-creative-os/contracts'
import type { ProjectPackage } from '../../model'
import type { LocalCoreClient } from '../../runtime/localCoreClient'

interface SearchResult {
  readonly id: string
  readonly title: string
  readonly kind: string
  readonly currentRevisionId?: string
}

interface Props {
  open: boolean
  project: ProjectPackage
  projects: readonly ProjectPackage[]
  client: LocalCoreClient
  onClose: () => void
  onProjectOpened: () => void
  onSelectArtifact: (artifactId: string) => void
  onNotice: (message: string) => void
}

type BusyAction = 'download' | 'backup' | 'open' | 'search' | 'session' | null

export function ProjectToolsDialog(props: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly SearchResult[]>([])
  const [session, setSession] = useState<ProviderSessionBindingV1 | null>(null)

  useEffect(() => {
    if (!props.open) return
    setError(null)
    setQuery('')
    setResults([])
    setBusy('session')
    void props.client.getProviderSession(props.project.id, 'codex').then((call) => {
      if (call.result.ok) setSession(call.result.value)
      else setError(call.result.error.message)
    }).finally(() => setBusy((current) => current === 'session' ? null : current))
  }, [props.client, props.open, props.project.id])

  const sessionLabel = useMemo(() => {
    if (session === null) return '尚未建立项目会话'
    if (session.status === 'active') return '当前项目会优先继续这个 Codex 会话'
    if (session.status === 'stale') return '原会话需要重新连接，系统只会新建一次替代会话'
    return '原会话已关闭'
  }, [session])

  if (!props.open) return null

  const downloadCurrent = async (): Promise<void> => {
    setBusy('download'); setError(null)
    const call = await props.client.downloadLcosproj(props.project.id)
    if (!call.result.ok) {
      setError(call.result.error.message)
    } else {
      const url = URL.createObjectURL(call.result.value.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = call.result.value.fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      props.onNotice('工程文件已导出。对话原始时间线和向量索引默认不随包复制。')
    }
    setBusy(null)
  }

  const backupAll = async (): Promise<void> => {
    setBusy('backup'); setError(null)
    const selected = await props.client.selectDirectory('选择 LCOS 工程备份目录')
    if (!selected.result.ok) { setError(selected.result.error.message); setBusy(null); return }
    if (selected.result.value.cancelled || selected.result.value.path === undefined) { setBusy(null); return }
    const call = await props.client.exportAllLcosproj(selected.result.value.path, props.projects.map((project) => project.id))
    if (!call.result.ok) setError(call.result.error.message)
    else props.onNotice(`已把 ${props.projects.length} 个项目备份到所选目录。`)
    setBusy(null)
  }

  const openProjectFile = async (file: File): Promise<void> => {
    setBusy('open'); setError(null)
    const call = await props.client.openLcosprojUpload(file)
    if (!call.result.ok) setError(call.result.error.message)
    else {
      props.onNotice('工程文件已打开，正在刷新项目列表。')
      props.onProjectOpened()
    }
    setBusy(null)
  }

  const search = async (): Promise<void> => {
    const normalized = query.trim()
    if (!normalized) { setResults([]); return }
    setBusy('search'); setError(null)
    const call = await props.client.artifactSearch(props.project.id, normalized)
    if (!call.result.ok) setError(call.result.error.message)
    else setResults(call.result.value)
    setBusy(null)
  }

  const clearSession = async (): Promise<void> => {
    setBusy('session'); setError(null)
    const call = await props.client.deleteProviderSession(props.project.id, 'codex')
    if (!call.result.ok) setError(call.result.error.message)
    else {
      setSession(null)
      props.onNotice('已解除首选 Codex 会话。下一次任务会建立一次新会话。')
    }
    setBusy(null)
  }

  return <div className="project-tools-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) props.onClose() }}>
    <section className="project-tools-dialog" role="dialog" aria-modal="true" aria-label="项目工具" data-testid="project-tools-dialog">
      <header><div><small>项目工具</small><h2>{props.project.label}</h2></div><button className="icon-button pressable" aria-label="关闭" onClick={props.onClose}><X size={15} /></button></header>
      <div className="project-tools-body">
        <section>
          <h3>查找画布内容</h3>
          <div className="project-tools-search"><Search size={14} /><input value={query} placeholder="输入文件名、标题或类型" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void search() }} /><button className="pressable" disabled={busy === 'search'} onClick={() => { void search() }}>查找</button></div>
          {results.length > 0 && <div className="project-tools-results">{results.map((result) => <button key={result.id} className="pressable" onClick={() => { props.onSelectArtifact(result.id); props.onClose() }}><b>{result.title}</b><small>{humanKind(result.kind)}</small></button>)}</div>}
          {query.trim() && busy !== 'search' && results.length === 0 && <p className="project-tools-empty">没有找到匹配内容。</p>}
        </section>

        <section>
          <h3>工程文件</h3>
          <div className="project-tools-grid">
            <button className="pressable" disabled={busy !== null} onClick={() => { void downloadCurrent() }}><Download size={15} /><span><b>导出当前工程</b><small>下载可恢复的 .lcosproj</small></span></button>
            <button className="pressable" disabled={busy !== null} onClick={() => { void backupAll() }}><Archive size={15} /><span><b>备份所有项目</b><small>选择目录后批量保存</small></span></button>
            <button className="pressable" disabled={busy !== null} onClick={() => fileInput.current?.click()}><FolderOpen size={15} /><span><b>打开工程文件</b><small>从 .lcosproj 恢复项目</small></span></button>
          </div>
          <input ref={fileInput} hidden type="file" accept=".lcosproj,application/vnd.local-creative-os.project" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void openProjectFile(file); event.currentTarget.value = '' }} />
          <p className="project-tools-note">默认工程包保存项目结构、版本、决策、章节与钉选消息；完整原始对话和可重建向量不默认打包。</p>
        </section>

        <section>
          <h3>Codex 项目会话</h3>
          <div className="project-session-card"><div><b>{sessionLabel}</b><small>{session ? `${session.externalSessionId.slice(0, 12)}… · ${session.origin === 'manual' ? '手动建立' : '自动建立'} · 最近使用 ${formatTime(session.lastSeenAt)}` : '首次执行时自动建立，无需填写 Session ID。'}</small></div>{session && <button className="quiet pressable" disabled={busy === 'session'} onClick={() => { void clearSession() }}><Link2Off size={13} />开启新会话</button>}</div>
        </section>

        {error && <div className="project-tools-error"><p>{humanError(error)}</p><button className="quiet pressable" onClick={() => { void navigator.clipboard?.writeText(error) }}>复制诊断信息</button></div>}
      </div>
    </section>
  </div>
}

function humanKind(kind: string): string {
  if (/markdown|text/i.test(kind)) return '文本内容'
  if (/image/i.test(kind)) return '图片'
  if (/presentation|ppt/i.test(kind)) return '演示文稿'
  if (/pdf/i.test(kind)) return 'PDF'
  return '项目内容'
}

function humanError(message: string): string {
  if (/offline|unavailable|ECONNREFUSED|fetch failed/i.test(message)) return '本地项目服务暂时不可用。你的项目内容没有丢失，重新启动 LCOS 后再试。'
  if (/conflict|stale|version/i.test(message)) return '项目已在其他位置发生变化，请刷新后再试。'
  if (/lcosproj|project file/i.test(message)) return '这个工程文件无法打开，可能不完整或来自不兼容版本。'
  return message
}

function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}
