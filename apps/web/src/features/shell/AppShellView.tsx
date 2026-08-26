import type { ComponentProps, CSSProperties } from 'react'
import { ProjectDrive } from '../project/ProjectDrive'
import { ProjectStripVNext } from './ProjectStripVNext'
import { ImmersiveViewer } from '../viewer/ImmersiveViewer'
import type { CanvasNode } from '../../model'
import { DialogsHost, type DialogsHostProps } from './DialogsHost'
import { CanvasSceneHost, type CanvasSceneHostProps } from './CanvasSceneHost'
import { WorkRailHost } from './WorkRailHost'
import { LcosToaster } from '../ui/LcosToaster'
import { CaptureSpace } from '../capture/CaptureSpace'
import type { WorkRail } from '../workrail/WorkRail'

export interface AppShellViewProps {
  readonly layoutDensity: 'comfortable' | 'compact' | 'constrained'
  readonly layoutMode: 'desktop' | 'sidecar'
  readonly layoutStyle: CSSProperties
  readonly narrowCollaboration?: boolean
  readonly notice: string | null
  readonly capture: {
    readonly open: boolean
    readonly client: ComponentProps<typeof CaptureSpace>['client']
    readonly projects: ComponentProps<typeof CaptureSpace>['projects']
    readonly onClose: ComponentProps<typeof CaptureSpace>['onClose']
    readonly onOpenProject?: ComponentProps<typeof CaptureSpace>['onOpenProject']
    readonly onNotice?: ComponentProps<typeof CaptureSpace>['onNotice']
  }
  readonly drive: {
    readonly open: boolean
    readonly projects: ComponentProps<typeof ProjectDrive>['projects']
    readonly openProjectIds: ComponentProps<typeof ProjectDrive>['openProjectIds']
    readonly onOpen: ComponentProps<typeof ProjectDrive>['onOpen']
    readonly onCreate: ComponentProps<typeof ProjectDrive>['onCreate']
    readonly onDelete?: ComponentProps<typeof ProjectDrive>['onDelete']
    readonly onImportLcosproj?: ComponentProps<typeof ProjectDrive>['onImportLcosproj']
    readonly onRevealFolder?: ComponentProps<typeof ProjectDrive>['onRevealFolder']
    readonly capturePendingCount?: number
    readonly onOpenCaptureSpace?: ComponentProps<typeof ProjectDrive>['onOpenCaptureSpace']
  }
  readonly strip: ComponentProps<typeof ProjectStripVNext>
  readonly scene: CanvasSceneHostProps
  readonly rail: ComponentProps<typeof WorkRail>
  readonly dialogs: DialogsHostProps
  readonly immersive: { readonly node: CanvasNode; readonly projectId: string; readonly onClose: () => void } | null
}

/** App Shell 纯展示层：把 Drive / Strip / Scene / WorkRail / Dialogs 组装成最终布局。 */
export function AppShellView(props: AppShellViewProps) {
  if (props.capture.open) {
    return <>
      <LcosToaster notice={props.notice} />
      <CaptureSpace client={props.capture.client} projects={props.capture.projects} onClose={props.capture.onClose} onOpenProject={props.capture.onOpenProject} onNotice={props.capture.onNotice} />
    </>
  }
  if (props.drive.open) {
    return <>
      <LcosToaster notice={props.notice} />
      <ProjectDrive projects={props.drive.projects} openProjectIds={props.drive.openProjectIds} onOpen={props.drive.onOpen} onCreate={props.drive.onCreate} onDelete={props.drive.onDelete} onImportLcosproj={props.drive.onImportLcosproj} onRevealFolder={props.drive.onRevealFolder} capturePendingCount={props.drive.capturePendingCount} onOpenCaptureSpace={props.drive.onOpenCaptureSpace} />
      <DialogsHost {...props.dialogs} />
    </>
  }
  // porcelain 退役（Tier-3c）：shell 只挂 reconstruction 栈；旧 porcelain 主题 shell class 已移除。
  // --lcos-ui-scale 由 CSS 根默认值固定为 1（0.1 收口禁用组件级缩放，见 App.tsx 注释）。
  return <main className="app-shell lcos-reconstructed" style={props.layoutStyle} data-testid="creative-os-app" data-layout-density={props.layoutDensity} data-layout-mode={props.layoutMode} data-collaboration-mode={props.narrowCollaboration ? "narrow" : "normal"}>
    <LcosToaster notice={props.notice} />
    <ProjectStripVNext {...props.strip} />
    <CanvasSceneHost {...props.scene} />
    {props.layoutMode === 'desktop' ? <WorkRailHost rail={props.rail} /> : null}
    <DialogsHost {...props.dialogs} />
    {props.immersive && <ImmersiveViewer node={props.immersive.node} projectId={props.immersive.projectId} onClose={props.immersive.onClose} />}
  </main>
}
