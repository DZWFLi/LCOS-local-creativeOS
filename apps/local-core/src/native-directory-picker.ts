import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface DirectoryPickerInput {
  readonly title: string
}

export interface DirectoryPickerResult {
  readonly path?: string
  readonly cancelled: boolean
}

export async function selectNativeDirectory(input: DirectoryPickerInput): Promise<DirectoryPickerResult> {
  if (process.platform !== 'win32') {
    throw new Error('Native directory selection is currently available on Windows only.')
  }

  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    `$dialog.Description = '${input.title.replace(/'/g, "''")}'`,
    '$dialog.ShowNewFolderButton = $true',
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  [Console]::Out.Write($dialog.SelectedPath)',
    '}',
  ].join('; ')

  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-STA',
    '-Command',
    script,
  ], {
    encoding: 'utf8',
    timeout: 5 * 60 * 1_000,
    windowsHide: false,
  })
  const selectedPath = stdout.trim()
  return selectedPath ? { path: selectedPath, cancelled: false } : { cancelled: true }
}
