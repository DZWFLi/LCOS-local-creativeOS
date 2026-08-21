export interface LcosDesktopPort {
  readonly platform: string
  getAppInfo(): Promise<{ readonly name: string; readonly version: string; readonly packaged: boolean; readonly platform: string }>
  getRuntimeStatus(): Promise<unknown>
  restartRuntime(): Promise<unknown>
  installCodexIntegration(): Promise<unknown>
  selectDirectory(title: string): Promise<{ readonly path?: string; readonly cancelled: boolean }>
  showItemInFolder(path: string): Promise<boolean>
  openCaptureSpace?(): Promise<void>
  showCaptureFloat?(): Promise<void>
  hideCaptureFloat?(): Promise<void>
  onCaptureReceived?(listener: (value: unknown) => void): () => void
  onCaptureError?(listener: (value: { readonly message?: string }) => void): () => void
  onOpenCaptureSpace?(listener: () => void): () => void
  onRuntimeStatus(listener: (value: unknown) => void): () => void
}

declare global {
  interface Window {
    readonly lcosDesktop?: LcosDesktopPort
  }
}

export function getDesktopPort(): LcosDesktopPort | undefined {
  return typeof window === 'undefined' ? undefined : window.lcosDesktop
}
