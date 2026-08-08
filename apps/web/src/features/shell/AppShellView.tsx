import type { ComponentProps } from 'react'
import { ProjectDrive } from '../project/ProjectDrive'
import { ProjectStripVNext } from './ProjectStripVNext'
import { ImmersiveViewer } from '../viewer/ImmersiveViewer'
import type { CanvasNode } from '../../model'
import { DialogsHost, type DialogsHostProps } from './DialogsHost'
import { CanvasSceneHost, type CanvasSceneHostProps } from './CanvasSceneHost'
import { WorkRailHost } from './WorkRailHost'
import type { WorkRail } from '../workrail/WorkRail'

export interface AppShellViewProps {
  readonly notice: string | null
  readonly drive: {
    readonly open: boolean
    readonly projects: ComponentProps<typeof ProjectDrive>['projects']
    readonly openProjectIds: ComponentProps<typeof ProjectDrive>['openProjectIds']
    readonly onOpen: ComponentProps<typeof ProjectDrive>['onOpen']
    readonly onCreate: () => void
    readonly onDelete?: ComponentProps<typeof ProjectDrive>['onDelete']
    readonly onImportLcosproj?: ComponentProps<typeof ProjectDrive>['onImportLcosproj']
  }
  readonly strip: ComponentProps<typeof ProjectStripVNext>
  readonly scene: CanvasSceneHostProps
  readonly rail: ComponentProps<typeof WorkRail>
  readonly dialogs: DialogsHostProps
  readonly immersive: { readonly node: CanvasNode; readonly projectId: string; readonly onClose: () => void } | null
}

/** App Shell 纯展示层：把 Drive / Strip / Scene / WorkRail / Dialogs 组装成最终布局。 */
export function AppShellView(props: AppShellViewProps) {
  if (props.drive.open) {
    return <>
      {props.notice && <div data-testid="toast" className="notice" role="status" aria-live="polite">{props.notice}</div>}
      <ProjectDrive projects={props.drive.projects} openProjectIds={props.drive.openProjectIds} onOpen={props.drive.onOpen} onCreate={props.drive.onCreate} onDelete={props.drive.onDelete} onImportLcosproj={props.drive.onImportLcosproj} />
      <DialogsHost {...props.dialogs} />
    </>
  }
  return <main className="app-shell porcelain-studio-v2 lcos-reconstructed" data-testid="creative-os-app">
    <ProjectStripVNext {...props.strip} />
    <CanvasSceneHost {...props.scene} />
    <WorkRailHost rail={props.rail} />
    <DialogsHost {...props.dialogs} />
    {props.immersive && <ImmersiveViewer node={props.immersive.node} projectId={props.immersive.projectId} onClose={props.immersive.onClose} />}
  </main>
}
