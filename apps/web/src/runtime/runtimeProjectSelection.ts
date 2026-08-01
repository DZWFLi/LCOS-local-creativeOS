/**
 * Runtime boot project selection with an explicit Source Gate.
 *
 * The gate rule (approved for MVP closure): when the user explicitly requested a
 * project id, a catalog miss must NEVER silently fall back to the MVP sample,
 * another project, localStorage or Fixture. It is an explicit error state.
 */

export interface ProjectCatalogLike {
  readonly id: string
}

export type RuntimeProjectSelection =
  | { readonly kind: 'found'; readonly projectId: string }
  | { readonly kind: 'missing-requested'; readonly requestedProjectId: string }
  | { readonly kind: 'empty-catalog' }

export function selectRuntimeProject(
  entries: readonly ProjectCatalogLike[],
  requestedProjectId: string | null,
  fallbackProjectId: string,
): RuntimeProjectSelection {
  if (requestedProjectId !== null) {
    if (!entries.some((entry) => entry.id === requestedProjectId)) {
      return { kind: 'missing-requested', requestedProjectId }
    }
    return { kind: 'found', projectId: requestedProjectId }
  }
  if (entries.some((entry) => entry.id === fallbackProjectId)) {
    return { kind: 'found', projectId: fallbackProjectId }
  }
  const first = entries[0]
  return first === undefined
    ? { kind: 'empty-catalog' }
    : { kind: 'found', projectId: first.id }
}
