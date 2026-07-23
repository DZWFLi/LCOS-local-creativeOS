import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

import type { Result, ValidatedProjectRoot } from '@local-creative-os/contracts'

import { failure } from './errors.js'

export interface ReadonlyFileSystem {
  stat(path: string): Promise<{ isDirectory(): boolean }>
  access(path: string, mode: number): Promise<void>
}

const defaultFileSystem: ReadonlyFileSystem = { stat, access }

function isWithinAllowedRoot(path: string, allowedRoot: string): boolean {
  const relation = relative(allowedRoot, path)
  return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))
}

export async function validateProjectRoot(
  rootPath: string,
  options: {
    readonly signal?: AbortSignal
    readonly allowedRoot?: string
    readonly fileSystem?: ReadonlyFileSystem
  } = {},
): Promise<Result<ValidatedProjectRoot>> {
  if (options.signal?.aborted) return failure('ABORTED', 'Project root validation was aborted.')
  if (rootPath.trim() === '') return failure('INVALID_ARGUMENT', 'Project root path is required.')

  const normalizedPath = resolve(rootPath)
  if (
    options.allowedRoot !== undefined
    && !isWithinAllowedRoot(normalizedPath, resolve(options.allowedRoot))
  ) {
    return failure('PATH_OUTSIDE_ALLOWED_ROOT', 'Project root is outside the configured allowed root.')
  }

  const fileSystem = options.fileSystem ?? defaultFileSystem
  let details: Awaited<ReturnType<ReadonlyFileSystem['stat']>>
  try {
    details = await fileSystem.stat(normalizedPath)
  } catch (error: unknown) {
    if (options.signal?.aborted) return failure('ABORTED', 'Project root validation was aborted.')
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : undefined
    if (code === 'ENOENT') return failure('PROJECT_ROOT_NOT_FOUND', 'Project root does not exist.')
    if (code === 'EACCES' || code === 'EPERM') {
      return failure('PROJECT_ROOT_NOT_READABLE', 'Project root is not readable.')
    }
    return failure('INTERNAL', 'Project root could not be inspected.')
  }

  if (!details.isDirectory()) {
    return failure('PROJECT_ROOT_NOT_DIRECTORY', 'Project root must be a directory.')
  }

  try {
    await fileSystem.access(normalizedPath, constants.R_OK)
  } catch {
    if (options.signal?.aborted) return failure('ABORTED', 'Project root validation was aborted.')
    return failure('PROJECT_ROOT_NOT_READABLE', 'Project root is not readable.')
  }

  if (options.signal?.aborted) return failure('ABORTED', 'Project root validation was aborted.')
  return {
    ok: true,
    value: {
      normalizedPath,
      exists: true,
      isDirectory: true,
      readable: true,
    },
  }
}
