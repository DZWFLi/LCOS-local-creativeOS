/**
 * Action Launcher provider architecture.
 *
 * Keeps the useful grok-bot donor mechanics (provider interface, fuzzy ranking,
 * async six-state snapshots, stale request protection, keyboard-first action injection)
 * while enforcing LCOS product IA: Ctrl/Cmd+K searches actions only.
 * Project content belongs to Search (Ctrl/Cmd+F); Focus (F) locates an already-known object.
 */

import {
  makeCancelled,
  makeEmpty,
  makeFailed,
  makeReady,
  makeUnavailable,
  type AsyncSnapshot,
} from '../ui/asyncState'

/** Action Launcher has one user-facing IA bucket: actions. */
export type PaletteGroupId = '操作'

/** Single action section. Providers may still be split internally without leaking taxonomy to users. */
export const PALETTE_GROUP_ORDER: readonly PaletteGroupId[] = ['操作']

export interface PaletteEntry {
  readonly id: string
  readonly title: string
  readonly hint?: string
  readonly group: PaletteGroupId
  readonly keywords?: string
}

export type PaletteSearchOutcome =
  | AsyncSnapshot<readonly PaletteEntry[]>
  | Promise<AsyncSnapshot<readonly PaletteEntry[]>>

export interface PaletteProvider {
  readonly id: string
  readonly label: string
  search(query: string): PaletteSearchOutcome
}

export interface SyncPaletteProvider {
  readonly group: PaletteGroupId
  query(term: string): readonly PaletteEntry[]
}

export type PaletteProviderInput = PaletteProvider | SyncPaletteProvider

export function scorePaletteEntry(entry: PaletteEntry, term: string): number | null {
  const needle = term.trim().toLowerCase()
  if (!needle) return 0
  const title = entry.title.toLowerCase()
  if (title.startsWith(needle)) return 3
  if (title.includes(needle)) return 2
  if (entry.keywords !== undefined && entry.keywords.toLowerCase().includes(needle)) return 1
  return null
}

const MAX_PROVIDER_ENTRIES = 50

export function rankPaletteEntries(entries: readonly PaletteEntry[], term: string): readonly PaletteEntry[] {
  const scored = entries
    .map((entry, index) => ({ entry, index, score: scorePaletteEntry(entry, term) }))
    .filter((row): row is { entry: PaletteEntry; index: number; score: number } => row.score !== null)
  scored.sort((left, right) => right.score - left.score || left.index - right.index)
  return scored.slice(0, MAX_PROVIDER_ENTRIES).map((row) => row.entry)
}

export function snapshotOfEntries(entries: readonly PaletteEntry[]): AsyncSnapshot<readonly PaletteEntry[]> {
  return entries.length === 0 ? makeEmpty() : makeReady(entries)
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export interface PaletteProviderConfig {
  readonly id: string
  readonly label: string
  readonly fetch: (query: string) => readonly PaletteEntry[] | Promise<readonly PaletteEntry[]>
  readonly availability?: () => string | null
}

export function createPaletteProvider(config: PaletteProviderConfig): PaletteProvider {
  let seq = 0
  return {
    id: config.id,
    label: config.label,
    search(query: string): PaletteSearchOutcome {
      const unavailableReason = config.availability?.() ?? null
      if (unavailableReason !== null) return makeUnavailable(unavailableReason)
      const ticket = ++seq
      let fetched: readonly PaletteEntry[] | Promise<readonly PaletteEntry[]>
      try {
        fetched = config.fetch(query)
      } catch (error: unknown) {
        return makeFailed(toErrorMessage(error))
      }
      if (!(fetched instanceof Promise)) return snapshotOfEntries(fetched)
      return fetched.then(
        (entries) => (ticket === seq ? snapshotOfEntries(entries) : makeCancelled()),
        (error: unknown) => (ticket === seq ? makeFailed(toErrorMessage(error)) : makeCancelled()),
      )
    },
  }
}

export function normalizePaletteProviderInput(input: PaletteProviderInput): PaletteProvider {
  if ('search' in input) return input
  return {
    id: `sync:${input.group}`,
    label: input.group,
    search(query: string): PaletteSearchOutcome {
      try {
        return snapshotOfEntries(input.query(query))
      } catch (error: unknown) {
        return makeFailed(toErrorMessage(error))
      }
    },
  }
}

export function mergePaletteEntries(lists: readonly (readonly PaletteEntry[])[]): readonly PaletteEntry[] {
  const seen = new Set<string>()
  const buckets = new Map<PaletteGroupId, PaletteEntry[]>()
  for (const entries of lists) {
    for (const entry of entries) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      const bucket = buckets.get(entry.group)
      if (bucket === undefined) buckets.set(entry.group, [entry])
      else bucket.push(entry)
    }
  }
  return PALETTE_GROUP_ORDER.flatMap((group) => buckets.get(group) ?? [])
}

export interface PaletteSection {
  readonly group: PaletteGroupId
  readonly items: readonly PaletteEntry[]
}

export function groupPaletteEntries(entries: readonly PaletteEntry[]): readonly PaletteSection[] {
  return PALETTE_GROUP_ORDER
    .map((group) => ({ group, items: entries.filter((entry) => entry.group === group) }))
    .filter((section) => section.items.length > 0)
}
