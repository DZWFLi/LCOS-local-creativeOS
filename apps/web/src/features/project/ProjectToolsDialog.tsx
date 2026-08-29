import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Download, FolderOpen, Link2Off, RotateCcw, RotateCw, X } from 'lucide-react'
import type { ContinuityResumeSnapshotV1, MutationChangeSetV1, ProviderSessionBindingV1 } from '@local-creative-os/contracts'
import type { ProjectFocusSearchEntry } from '../../state/projectFocus'
import type { ProjectPackage } from '../../model'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'
import { ProjectSearchLens } from './ProjectSearchLens'

interface Props {
  open: boolean
  searchOnly?: boolean
  initialSearchQuery?: string
  project: ProjectPackage
  projects: readonly ProjectPackage[]
  client: LocalCoreClient
  onClose: () => void
  onProjectOpened: () => void
  onSelectArtifact: (artifactId: string) => void
  onSelectSourceIds?: (sourceIds: readonly string[], title: string) => void
  searchEntries?: readonly ProjectFocusSearchEntry[]
  onNotice: (message: string) => void
}

type BusyAction = 'download' | 'backup' | 'open' | 'session' | 'change' | 'continuity' | null

export function ProjectToolsDialog(props: Props) {
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<ProviderSessionBindingV1 | null>(null)
  const [changeSets, setChangeSets] = useState<readonly MutationChangeSetV1[]>([])
  const [continuity, setContinuity] = useState<ContinuityResumeSnapshotV1 | null>(null)

  useEffect(() => {
    if (!props.open) return
    setError(null)
    if (props.searchOnly) {
      setSession(null)
      setBusy(null)
      return
    }
    setBusy('session')
    void Promise.all([
      props.client.getProviderSession(props.project.id, 'codex'),
      props.client.changeSets(props.project.id, 12),
    ]).then(([sessionCall, changeCall]) => {
      if (sessionCall.result.ok) setSession(sessionCall.result.value)
      else setError(sessionCall.result.error.message)
      if (changeCall.result.ok) setChangeSets(changeCall.result.value)
      setContinuity(null)
    }).finally(() => setBusy((current) => current === 'session' ? null : current))
  }, [props.client, props.open, props.project.id, props.searchOnly])

  // 关闭按钮文案承诺了 Esc：这里兑现（对话框非原生，浏览器不会代劳）。
  useEffect(() => {
    if (!props.open || props.searchOnly) return
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', closeFromEscape, true)
    return () => window.removeEventListener('keydown', closeFromEscape, true)
  }, [props.onClose, props.open])

  const inspectContinuity = async (): Promise<void> => {
    setBusy('continuity'); setError(null)
    const call = await props.client.continuityResume(props.project.id, {})
    if (call.result.ok) setContinuity(call.result.value)
    else setError(call.result.error.message)
    setBusy(null)
  }

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

  const refreshChangeSets = async (): Promise<void> => {
    const call = await props.client.changeSets(props.project.id, 12)
    if (call.result.ok) setChangeSets(call.result.value)
  }

  const mutateChangeSet = async (changeSet: MutationChangeSetV1, action: 'revert' | 'reapply'): Promise<void> => {
    setBusy('change'); setError(null)
    const call = action === 'revert'
      ? await props.client.revertChangeSet(props.project.id, changeSet.id)
      : await props.client.reapplyChangeSet(props.project.id, changeSet.id)
    if (!call.result.ok) setError(call.result.error.message)
    else {
      props.onNotice(action === 'revert' ? '已安全撤销这次项目修改' : '已安全重做这次项目修改')
      await refreshChangeSets()
    }
    setBusy(null)
  }

  if (props.searchOnly) {
    return <ProjectSearchLens
      open={props.open}
      initialQuery={props.initialSearchQuery}
      project={props.project}
      client={props.client}
      onClose={props.onClose}
      onSelectArtifact={props.onSelectArtifact}
      onSelectSourceIds={props.onSelectSourceIds}
      searchEntries={props.searchEntries}
      onNotice={props.onNotice}
    />
  }

  return <div className="project-tools-backdrop" role="presentation" onPointerDown={(event) => dismissFromBackdrop(event, props.onClose, busy !== null)}>
    <section className={`project-tools-dialog${props.searchOnly ? ' search-only' : ''}`} role="dialog" aria-modal="true" aria-label={props.searchOnly ? '项目搜索' : '项目工具'} data-testid="project-tools-dialog">
      <header className={props.searchOnly ? 'project-search-header' : undefined}><div><small>{props.searchOnly ? 'Search · Ctrl/Cmd F' : '项目工具'}</small><h2>{props.searchOnly ? '查找项目内容' : props.project.label}</h2></div><button className="dialog-close-action pressable" aria-label={props.searchOnly ? '关闭项目搜索' : '关闭项目工具'} title="关闭" onClick={props.onClose}><X size={15} /><span>{props.searchOnly ? 'Esc' : '关闭'}</span></button></header>
      <div className="project-tools-body">
        {!props.searchOnly && <section>
          <h3>工程文件</h3>
          <div className="project-tools-grid">
            <button className="pressable" disabled={busy !== null} onClick={() => { void downloadCurrent() }}><Download size={15} /><span><b>导出当前工程</b><small>下载可恢复的 .lcosproj</small></span></button>
            <button className="pressable" disabled={busy !== null} onClick={() => { void backupAll() }}><Archive size={15} /><span><b>备份所有项目</b><small>选择目录后批量保存</small></span></button>
            <button className="pressable" disabled={busy !== null} onClick={() => fileInput.current?.click()}><FolderOpen size={15} /><span><b>打开工程文件</b><small>从 .lcosproj 恢复项目</small></span></button>
          </div>
          <input ref={fileInput} hidden type="file" accept=".lcosproj,application/vnd.local-creative-os.project" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void openProjectFile(file); event.currentTarget.value = '' }} />
          <p className="project-tools-note">默认工程包保存项目结构、版本、决策、章节与钉选消息；完整原始对话和可重建向量不默认打包。</p>
        </section>}

        {!props.searchOnly && <section>
          <h3>Codex 项目会话</h3>
          <div className="project-session-card"><div><b>{sessionLabel}</b><small>{session ? `${session.externalSessionId.slice(0, 12)}… · ${session.origin === 'manual' ? '手动建立' : '自动建立'} · 最近使用 ${formatTime(session.lastSeenAt)}` : '首次执行时自动建立，无需填写 Session ID。'}</small></div>{session && <button className="quiet pressable" disabled={busy === 'session'} onClick={() => { void clearSession() }}><Link2Off size={13} />开启新会话</button>}</div>
        </section>}

        {!props.searchOnly && <section>
          <h3>项目连续性</h3>
          {continuity ? <div className="project-session-card"><div><b>{continuity.attentionRuntime.intent.goal}</b><small>{continuity.workspaceId ? `当前工作现场 ${continuity.workspaceId.slice(0, 12)}…` : '项目总览'} · 上下文 {continuity.attentionRuntime.contextPack.items.length} 项 / 约 {continuity.attentionRuntime.contextPack.estimatedTokens} tokens · {continuity.attentionRuntime.skillTarget.sideEffect === 'READ_ONLY' ? '只读判断' : continuity.attentionRuntime.skillTarget.sideEffect === 'PREPARE' ? '准备动作' : '涉及修改'}</small></div><button className="quiet pressable" disabled={busy !== null} onClick={() => { void inspectContinuity() }}>刷新</button></div> : <div className="project-session-card"><div><b>按需检查当前连续性状态</b><small>会运行当前意图 / 注意力与上下文组合；如配置了 Utility API，可能产生一次模型调用。</small></div><button className="quiet pressable" disabled={busy !== null} onClick={() => { void inspectContinuity() }}>{busy === 'continuity' ? '检查中…' : '检查'}</button></div>}
        </section>}

        {!props.searchOnly && <section>
          <h3>最近项目修改</h3>
          {changeSets.length === 0 ? <p className="project-tools-note">还没有可追踪的持久化修改。</p> : <div className="project-tools-results">{changeSets.map((changeSet) => <div key={changeSet.id} className="project-change-record"><span><b>{changeSetLabel(changeSet)}</b><small>{formatTime(changeSet.createdAt)} · {changeSet.status === 'applied' ? '已应用' : '已撤销'} · {changeSet.changes.length} 项</small></span><nav>{changeSet.status === 'applied' ? <button className="quiet pressable" disabled={busy === 'change'} onClick={() => { void mutateChangeSet(changeSet, 'revert') }}><RotateCcw size={12}/>撤销</button> : <button className="quiet pressable" disabled={busy === 'change'} onClick={() => { void mutateChangeSet(changeSet, 'reapply') }}><RotateCw size={12}/>重做</button>}</nav></div>)}</div>}
        </section>}

        {error && <div className="project-tools-error"><p>{humanError(error)}</p><button className="quiet pressable" onClick={() => { void navigator.clipboard?.writeText(error) }}>复制诊断信息</button></div>}
      </div>
    </section>
  </div>
}


/**
 * 把块级锚点翻译成人类可读文案（搜索块级引用消费链）。
 * 锚点来源：后端 projectSearch 返回的 SearchHitV0.chunkAnchor
 * （packages/contracts/src/search.ts，语义同 ContextManifestOrderedItemV0.sourceAnchor），
 * 形如 'section:风险' / 'pdf:p3' / 'pdf:p3-p5' / 'chunk:2-4'。
 * 翻译规则：
 * - 'section:XXX' → '§ XXX'（章节块，章节名为空时视为未知格式）；
 * - 'pdf:pN' → '第 N 页'；'pdf:pA-pB' → '第 A-B 页'（PDF 页块）；
 * - 其他格式（含空串、未知前缀）原样返回。
 */
export function formatChunkAnchorLabel(anchor: string): string {
  // 章节锚点：'section:风险' → '§ 风险'
  if (anchor.startsWith('section:')) {
    const sectionName = anchor.slice('section:'.length)
    return sectionName ? `§ ${sectionName}` : anchor
  }
  // PDF 页锚点：'pdf:p3' → '第 3 页'；'pdf:p3-p5' → '第 3-5 页'
  const pdfMatch = /^pdf:p(\d+)(?:-p(\d+))?$/.exec(anchor)
  if (pdfMatch) {
    const fromPage = pdfMatch[1]
    const toPage = pdfMatch[2]
    return toPage === undefined ? `第 ${fromPage} 页` : `第 ${fromPage}-${toPage} 页`
  }
  // 段落窗口锚点(无标题纯文本):'chunk:1' → '第 1 段'；'chunk:1-3' → '第 1-3 段'
  const chunkMatch = /^chunk:(\d+)(?:-(\d+))?$/.exec(anchor)
  if (chunkMatch) {
    const fromSeg = chunkMatch[1]
    const toSeg = chunkMatch[2]
    return toSeg === undefined ? `第 ${fromSeg} 段` : `第 ${fromSeg}-${toSeg} 段`
  }
  // 未知格式：原样返回
  return anchor
}

function changeSetLabel(changeSet: MutationChangeSetV1): string {
  const kinds = new Set(changeSet.changes.map((change) => change.type))
  if ([...kinds].some((kind) => kind.startsWith('relation_'))) return '项目关系修改'
  if (kinds.has('presentation_state')) return '视图整理修改'
  return '项目修改'
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
