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
  /** 需要 IIFE 推导的复杂弹窗（如 WorkspaceStatesDialog）由上层渲染后传入。 */
  readonly extraDialogs: ReactNode
}

/** 所有弹窗/浮层的纯展示宿主；行为全部来自上层注入的 props。 */
export function DialogsHost(props: DialogsHostProps) {
  return <>{[
    props.projectCreate && <ProjectCreateDialog key="project-create" {...props.projectCreate} />,
    props.projectTools && <ProjectToolsDialog key="project-tools" {...props.projectTools} />,
    props.workbench && <ArtifactWorkbench key="workbench" {...props.workbench} />,
    props.scopeCreate && <ScopeCreateDialog key="scope-create" {...props.scopeCreate} />,
    props.createContent && <CreateContentDialog key="create-content" {...props.createContent} />,
    props.workspaceEditor && <WorkspaceDialog key="workspace-editor" {...props.workspaceEditor} />,
    props.nodeRename && <InlineNodeRename key="node-rename" {...props.nodeRename} />,
    props.noteEdit && <InlineNoteEditor key="note-edit" {...props.noteEdit} />,
    props.confirmWorkspaceDelete && <ConfirmDialog key="confirm-workspace-delete" {...props.confirmWorkspaceDelete} />,
    props.confirmScopeDelete && <ConfirmDialog key="confirm-scope-delete" {...props.confirmScopeDelete} />,
    props.confirmProjectDelete && <ConfirmDialog key="confirm-project-delete" {...props.confirmProjectDelete} />,
    props.handoff && <HandoffDialog key="handoff" {...props.handoff} />,
    props.linkReference && <LinkReferenceDialog key="link-reference" {...props.linkReference} />,
    props.universalImport && <UniversalImportPanel key="universal-import" {...props.universalImport} />,
    props.conversationContext && <ConversationContextDialog key="conversation-context" {...props.conversationContext} />,
    props.obsidianImport && <ObsidianImportDialog key="obsidian-import" {...props.obsidianImport} />,
    props.resourceDetail && <ResourceDetailDialog key="resource-detail" {...props.resourceDetail} />,
  ]}{props.extraDialogs}</>
}
