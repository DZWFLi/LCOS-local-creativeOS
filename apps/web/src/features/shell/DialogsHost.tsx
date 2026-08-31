import type { ComponentProps, ReactNode } from 'react'
import { ProjectCreateDialog } from '../create/ProjectCreateDialog'
import { ProjectToolsDialog } from '../project/ProjectToolsDialog'
import { ArtifactWorkbench } from '../workbench/ArtifactWorkbench'
import { ScopeCreateDialog } from '../create/ScopeCreateDialog'
import { CreateContentDialog } from '../create/CreateContentDialog'
import { WorkspaceDialog } from '../workspace/WorkspaceDialog'
import { InlineNodeRename } from '../ui/InlineNodeRename'
import { InlineNoteEditor } from '../ui/InlineNoteEditor'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { HandoffDialog } from '../handoff/HandoffDialog'
import { LinkReferenceDialog } from '../create/LinkReferenceDialog'
import { UniversalImportPanel } from '../resources/UniversalImportPanel'
import { ConversationContextDialog } from '../conversations/ConversationContextDialog'
import { ObsidianImportDialog } from '../resources/ObsidianImportDialog'
import { ResourceDetailDialog } from '../resources/ResourceDetailDialog'
import { dominantDialogOwner, type DialogOwnerTier } from './dialogOwner'

export interface DialogLayerCandidate {
  readonly id: string
  readonly tier: DialogOwnerTier
  readonly node: ReactNode
}

export interface DialogsHostProps {
  readonly projectCreate: ComponentProps<typeof ProjectCreateDialog> | null
  readonly projectTools: ComponentProps<typeof ProjectToolsDialog> | null
  readonly workbench: ComponentProps<typeof ArtifactWorkbench> | null
  readonly scopeCreate: ComponentProps<typeof ScopeCreateDialog> | null
  readonly createContent: ComponentProps<typeof CreateContentDialog> | null
  readonly workspaceEditor: ComponentProps<typeof WorkspaceDialog> | null
  readonly nodeRename: ComponentProps<typeof InlineNodeRename> | null
  readonly noteEdit: ComponentProps<typeof InlineNoteEditor> | null
  readonly confirmWorkspaceDelete: ComponentProps<typeof ConfirmDialog> | null
  readonly confirmScopeDelete: ComponentProps<typeof ConfirmDialog> | null
  readonly confirmProjectDelete: ComponentProps<typeof ConfirmDialog> | null
  readonly handoff: ComponentProps<typeof HandoffDialog> | null
  readonly linkReference: ComponentProps<typeof LinkReferenceDialog> | null
  readonly universalImport: ComponentProps<typeof UniversalImportPanel> | null
  readonly conversationContext: ComponentProps<typeof ConversationContextDialog> | null
  readonly obsidianImport: ComponentProps<typeof ObsidianImportDialog> | null
  readonly resourceDetail: ComponentProps<typeof ResourceDetailDialog> | null
  /** 上层复杂浮层也必须显式进入 dominant-owner 候选，不再传 opaque Fragment。 */
  readonly extraDialogs: readonly DialogLayerCandidate[]
}

/**
 * Dialog/modal dominant owner.
 *
 * 只渲染当前最高优先级的一层。被遮住的父层 state 不被销毁；child/confirm
 * 关闭后父层可以自然恢复。这样避免 DialogsHost 同时把多个 non-null state
 * 平铺到 DOM，也不引入第二套全局 overlay state。
 */
export function DialogsHost(props: DialogsHostProps) {
  const candidates: DialogLayerCandidate[] = [
    ...(props.nodeRename ? [{ id: 'node-rename', tier: 'editor' as const, node: <InlineNodeRename key="node-rename" {...props.nodeRename} /> }] : []),
    ...(props.noteEdit ? [{ id: 'note-edit', tier: 'editor' as const, node: <InlineNoteEditor key="note-edit" {...props.noteEdit} /> }] : []),
    ...(props.projectCreate ? [{ id: 'project-create', tier: 'surface' as const, node: <ProjectCreateDialog key="project-create" {...props.projectCreate} /> }] : []),
    ...(props.projectTools ? [{ id: 'project-tools', tier: 'surface' as const, node: <ProjectToolsDialog key="project-tools" {...props.projectTools} /> }] : []),
    ...(props.workbench ? [{ id: 'workbench', tier: 'surface' as const, node: <ArtifactWorkbench key="workbench" {...props.workbench} /> }] : []),
    ...(props.scopeCreate ? [{ id: 'scope-create', tier: 'surface' as const, node: <ScopeCreateDialog key="scope-create" {...props.scopeCreate} /> }] : []),
    ...(props.createContent ? [{ id: 'create-content', tier: 'surface' as const, node: <CreateContentDialog key="create-content" {...props.createContent} /> }] : []),
    ...(props.workspaceEditor ? [{ id: 'workspace-editor', tier: 'surface' as const, node: <WorkspaceDialog key="workspace-editor" {...props.workspaceEditor} /> }] : []),
    ...(props.handoff ? [{ id: 'handoff', tier: 'surface' as const, node: <HandoffDialog key="handoff" {...props.handoff} /> }] : []),
    ...(props.universalImport ? [{ id: 'universal-import', tier: 'surface' as const, node: <UniversalImportPanel key="universal-import" {...props.universalImport} /> }] : []),
    ...(props.linkReference ? [{ id: 'link-reference', tier: 'child' as const, node: <LinkReferenceDialog key="link-reference" {...props.linkReference} /> }] : []),
    ...(props.conversationContext ? [{ id: 'conversation-context', tier: 'child' as const, node: <ConversationContextDialog key="conversation-context" {...props.conversationContext} /> }] : []),
    ...(props.obsidianImport ? [{ id: 'obsidian-import', tier: 'child' as const, node: <ObsidianImportDialog key="obsidian-import" {...props.obsidianImport} /> }] : []),
    ...(props.resourceDetail ? [{ id: 'resource-detail', tier: 'child' as const, node: <ResourceDetailDialog key="resource-detail" {...props.resourceDetail} /> }] : []),
    ...props.extraDialogs,
    ...(props.confirmWorkspaceDelete ? [{ id: 'confirm-workspace-delete', tier: 'blocking' as const, node: <ConfirmDialog key="confirm-workspace-delete" {...props.confirmWorkspaceDelete} /> }] : []),
    ...(props.confirmScopeDelete ? [{ id: 'confirm-scope-delete', tier: 'blocking' as const, node: <ConfirmDialog key="confirm-scope-delete" {...props.confirmScopeDelete} /> }] : []),
    ...(props.confirmProjectDelete ? [{ id: 'confirm-project-delete', tier: 'blocking' as const, node: <ConfirmDialog key="confirm-project-delete" {...props.confirmProjectDelete} /> }] : []),
  ]
  const dominantId = dominantDialogOwner(candidates.map((candidate) => ({ id: candidate.id, tier: candidate.tier, open: true })))
  return dominantId === null ? null : candidates.find((candidate) => candidate.id === dominantId)?.node ?? null
}
