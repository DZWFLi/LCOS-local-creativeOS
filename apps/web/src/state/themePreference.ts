/**
 * LCOS theme preference — light / dark / auto (follow OS).
 *
 * The attribute lands on <html data-lcos-theme>; absence means auto, which
 * lets the token layer follow prefers-color-scheme. Preference persists in
 * localStorage and syncs across windows (main app + capture float) via the
 * storage event.
 */

export type LcosThemePreference = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'lcos-theme-preference'
export const THEME_CHANGE_EVENT = 'lcos-theme-change'

export function readThemePreference(): LcosThemePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'auto') return raw
  } catch {
    // localStorage unavailable — stay auto.
  }
  return 'auto'
}

export function applyThemePreference(preference: LcosThemePreference): void {
  if (preference === 'auto') delete document.documentElement.dataset.lcosTheme
  else document.documentElement.dataset.lcosTheme = preference
}

export function writeThemePreference(preference: LcosThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Storage may be blocked; the attribute still applies for this window.
  }
  applyThemePreference(preference)
  window.dispatchEvent(new CustomEvent<LcosThemePreference>(THEME_CHANGE_EVENT, { detail: preference }))
}

export function cycleThemePreference(current: LcosThemePreference): LcosThemePreference {
  return current === 'light' ? 'dark' : current === 'dark' ? 'auto' : 'light'
}

/** Boot-time wiring: apply the stored preference and keep every window in sync. */
export function bootThemePreference(): () => void {
  applyThemePreference(readThemePreference())
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    applyThemePreference(readThemePreference())
  }
  const onLocalChange = () => applyThemePreference(readThemePreference())
  window.addEventListener('storage', onStorage)
  window.addEventListener(THEME_CHANGE_EVENT, onLocalChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(THEME_CHANGE_EVENT, onLocalChange)
  }
}
