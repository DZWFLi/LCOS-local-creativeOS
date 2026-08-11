import { Brain, FileText, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { ResourceDescriptorV0 } from '@local-creative-os/contracts'

import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

export function ResourceDetailDialog({ open, projectId, artifactId, client, onClose, onChanged }: {
  open: boolean
  projectId: string
  artifactId: string
  client: LocalCoreClient
  onClose: () => void
  onChanged: () => void
}) {
  const [resourceId, setResourceId] = useState<string | null>(null)
  const [descriptor, setDescriptor] = useState<ResourceDescriptorV0 | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError('')
    setDescriptor(null)
    setPreview('')
    void (async () => {
      const listed = await client.resourceList(projectId)
      if (cancelled || !listed.result.ok) return
      const entry = listed.result.value.find((item) => item.artifactId === artifactId)
      if (entry === undefined) {
        setError('该对象没有详情记录')
        return
      }
      setResourceId(entry.resourceId)
      const descriptorCall = await client.resourceDescriptor(projectId, entry.resourceId)
      if (cancelled) return
      if (descriptorCall.result.ok) setDescriptor(descriptorCall.result.value)
      else setError(descriptorCall.result.error.message)
      const readCall = await client.resourceRead(projectId, entry.resourceId, { limit: 3000 })
      if (cancelled) return
      if (readCall.result.ok) setPreview(readCall.result.value.data.slice(0, 3000))
    })()
    return () => { cancelled = true }
  }, [artifactId, client, open, projectId])

  if (!open) return null

  const reanalyze = (): void => {
    if (resourceId === null) return
    setBusy(true)
    void client.resourceReanalyze(projectId, resourceId).then((call) => {
      setBusy(false)
      if (call.result.ok) {
        setDescriptor(call.result.value)
        onChanged()
      } else {
        setError(call.result.error.message)
      }
    })
  }

  const statusLabel = descriptor === null ? '' : descriptor.understanding.status
  const confidenceLabel = (value: number): string => value >= 0.8 ? '高可信' : value >= 0.5 ? '可能' : '待确认'

  return <div className="modal-backdrop" onPointerDown={(event) => dismissFromBackdrop(event, onClose, busy)}><section className="resource-detail-dialog" role="dialog" aria-label="资源详情" data-testid="resource-detail-dialog">
    <header><div><Brain size={18} /><h2>资源详情</h2></div><button type="button" className="icon-button pressable" aria-label="关闭" onClick={onClose}><X size={16} /></button></header>
    {error && <p className="import-error" role="alert">{error}</p>}
    {descriptor === null && !error && <p>读取理解结果中…</p>}
    {descriptor !== null && <>
      <div className="resource-status-line">
        <span className={`resource-status resource-status-${statusLabel}`}>{statusLabel === 'ready' ? '已理解' : statusLabel === 'partial' ? '部分理解' : statusLabel === 'failed' ? '理解失败' : '理解中'}</span>
        <small>Analyzer: {descriptor.understanding.analyzerVersion}</small>
      </div>
      <h3>{descriptor.display.title}</h3>
      <section><h4>系统识别</h4>
        {descriptor.detectedKinds.length === 0 && <p className="resource-muted">暂未识别（unknown 合法）</p>}
        <ul className="resource-kind-list">{descriptor.detectedKinds.map((kind) => (
          <li key={kind.kind}><b>{kind.kind}</b><span>{confidenceLabel(kind.confidence)}</span></li>
        ))}</ul>
      </section>
      {descriptor.capabilities.length > 0 && <section><h4>可能能力</h4><ul className="resource-kind-list">{descriptor.capabilities.map((capability) => (
        <li key={capability.name}><b>{capability.name}</b><span>{confidenceLabel(capability.confidence)}</span></li>
      ))}</ul></section>}
      {descriptor.readFirst.length > 0 && <section><h4>Read First</h4><ul className="resource-kind-list">{descriptor.readFirst.map((path) => (
        <li key={path}><span>{path}</span></li>
      ))}</ul></section>}
      <section><h4>安全状态</h4><p className="resource-security"><ShieldCheck size={13} /> 信任：{descriptor.trust.level} · 可读：{descriptor.trust.readable ? '是' : '否'} · 可执行：{descriptor.trust.executable ? '是' : '否'}{descriptor.trust.requiresApproval ? ' · 执行需批准' : ''}</p></section>
      {descriptor.understanding.summary !== undefined && <section><h4>摘要</h4><p className="resource-summary">{descriptor.understanding.summary}</p></section>}
      {descriptor.understanding.warnings.length > 0 && <section><h4>警告</h4><ul className="resource-kind-list">{descriptor.understanding.warnings.map((warning) => (
        <li key={warning}><span>{warning}</span></li>
      ))}</ul></section>}
      {preview !== '' && <section><h4>内容预览</h4><pre className="resource-preview"><FileText size={12} />{preview.slice(0, 2000)}</pre></section>}
      <footer><button className="pressable" type="button" disabled={busy} onClick={reanalyze}><RefreshCw size={14} />重新分析</button><button className="pressable primary" type="button" onClick={onClose}>关闭</button></footer>
    </>}
  </section></div>
}
