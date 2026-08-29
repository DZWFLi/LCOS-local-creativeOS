import { useMemo, useState } from 'react'
import { Palette } from 'lucide-react'
import {
  PROJECT_GLYPH_MARK_REPERTOIRE,
  PROJECT_TINT_TOKENS,
  type ProjectGlyphMarkId,
  type ProjectTintToken,
  type ProjectVisualProfileV0,
  type UpsertProjectVisualProfileInputV0,
} from '@local-creative-os/contracts'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { LcosPopover } from '../ui/LcosPopover'
import { ProjectGlyphMark } from './ProjectGlyphMark'

const TINT_LABELS: Readonly<Record<ProjectTintToken, string>> = {
  default: '默认',
  amber: '琥珀',
  sage: '鼠尾草',
  sky: '天空',
  rose: '玫瑰',
  violet: '紫罗兰',
}

const MARK_LABELS: Readonly<Record<ProjectGlyphMarkId, string>> = {
  pebble: '卵石',
  leaf: '叶片',
  capsule: '胶囊',
  egg: '卵形',
  squircle: '软方',
  petal: '花瓣',
  paper: '纸片',
}

interface Props {
  readonly client: LocalCoreClient
  readonly projectId: string
  readonly projectLabel: string
  readonly profile?: ProjectVisualProfileV0
  readonly onProfileChange: (profile: ProjectVisualProfileV0) => void
}

function draftFrom(profile?: ProjectVisualProfileV0) {
  return {
    tintToken: profile?.tintToken ?? 'default' as ProjectTintToken,
    glythMarkId: profile?.glythMarkId ?? 'pebble' as ProjectGlyphMarkId,
    scale: profile?.scale ?? 1,
    orientation: profile?.orientation ?? 0,
  }
}

export function ProjectVisualProfileControl({ client, projectId, projectLabel, profile, onProfileChange }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => draftFrom(profile))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const dirty = useMemo(() => {
    const current = draftFrom(profile)
    return current.tintToken !== draft.tintToken
      || current.glythMarkId !== draft.glythMarkId
      || Math.abs(current.scale - draft.scale) > 0.001
      || Math.abs(current.orientation - draft.orientation) > 0.001
  }, [draft, profile])

  const save = async () => {
    if (busy || !dirty) return
    setBusy(true)
    setMessage(null)
    const desired = { ...draft }

    const attempt = async (expectedVersion: number) => {
      const input: UpsertProjectVisualProfileInputV0 = {
        tintToken: desired.tintToken,
        glythMarkId: desired.glythMarkId,
        scale: desired.scale,
        orientation: desired.orientation,
        expectedVersion,
      }
      return client.saveProjectVisualProfile(projectId, input).catch(() => null)
    }

    let call = await attempt(profile?.version ?? 0)
    if (call && !call.result.ok && ['CONFLICT', 'STALE', 'STALE_PRESENTATION_VERSION'].includes(call.result.error.code)) {
      const latest = await client.projectVisualProfile(projectId).catch(() => null)
      if (latest?.result.ok) call = await attempt(latest.result.value?.version ?? 0)
    }

    setBusy(false)
    if (!call || !call.result.ok) {
      setMessage(call && !call.result.ok ? `没有保存：${call.result.error.message}` : '没有保存：本地项目服务暂时不可用')
      return
    }
    onProfileChange(call.result.value)
    setDraft(draftFrom(call.result.value))
    setMessage('已保存项目标记')
  }

  return <LcosPopover
    open={open}
    onOpenChange={(next) => {
      setOpen(next)
      if (next) {
        setDraft(draftFrom(profile))
        setMessage(null)
      }
    }}
    anchorSide="bottom"
    anchorAlign="end"
    width={320}
    triggerClassName="project-profile-trigger"
    trigger={<><Palette size={13}/><span className="sr-only">调整 {projectLabel} 项目标记</span></>}
  >
    <div className="project-profile-popover" data-testid={`project-profile-${projectId}`}>
      <header><span>PROJECT IDENTITY</span><strong>{projectLabel}</strong><small>只改变项目入口的视觉身份，不会修改项目内容。</small></header>

      <div className="project-profile-preview" aria-hidden="true">
        <ProjectGlyphMark label="项目标记预览" variantSeed={projectId} shapeId={draft.glythMarkId} scale={draft.scale} orientation={draft.orientation} size={62}/>
      </div>

      <fieldset>
        <legend>标记</legend>
        <div className="project-profile-mark-grid">
          {PROJECT_GLYPH_MARK_REPERTOIRE.map((mark) => <button key={mark} type="button" className={draft.glythMarkId === mark ? 'is-active' : ''} onClick={() => setDraft((current) => ({ ...current, glythMarkId: mark }))} aria-pressed={draft.glythMarkId === mark}>
            <ProjectGlyphMark label={`${MARK_LABELS[mark]}项目标记`} variantSeed={`${projectId}:${mark}`} shapeId={mark} size={25}/><span>{MARK_LABELS[mark]}</span>
          </button>)}
        </div>
      </fieldset>

      <fieldset>
        <legend>底色</legend>
        <div className="project-profile-tints">
          {PROJECT_TINT_TOKENS.map((tint) => <button key={tint} type="button" data-tint={tint} className={draft.tintToken === tint ? 'is-active' : ''} onClick={() => setDraft((current) => ({ ...current, tintToken: tint }))} aria-pressed={draft.tintToken === tint}><span/><small>{TINT_LABELS[tint]}</small></button>)}
        </div>
      </fieldset>

      <div className="project-profile-sliders">
        <label><span>大小</span><input type="range" min="0.82" max="1.16" step="0.02" value={draft.scale} onChange={(event) => setDraft((current) => ({ ...current, scale: Number(event.target.value) }))}/></label>
        <label><span>方向</span><input type="range" min="-12" max="12" step="2" value={draft.orientation} onChange={(event) => setDraft((current) => ({ ...current, orientation: Number(event.target.value) }))}/></label>
      </div>

      <footer><span role="status">{message ?? (dirty ? '有未保存调整' : ' ')}</span><button type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? '保存中…' : '保存'}</button></footer>
    </div>
  </LcosPopover>
}
