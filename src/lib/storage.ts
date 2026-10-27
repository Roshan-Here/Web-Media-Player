// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/**
 * Where the player remembers things on this device: volume, track languages, the decoder, the
 * subtitle look and per-video subtitle timing. `localStorage` under a `web-media-player:` prefix by
 * default; turned off (or swapped for your own store) with {@link configureStorage}. When storage
 * is blocked or off, settings last for the page view.
 */
export interface PlayerStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

let store: PlayerStorage | null | undefined
let prefix = 'web-media-player:'

export interface StorageOptions {
  /**
   * Where to keep settings: `'local'` (the default) for `localStorage`, `false` to keep nothing
   * beyond the page view, or your own object with `getItem` and `setItem`.
   */
  storage?: 'local' | false | PlayerStorage
  /** Prefix for every key. Default `web-media-player:`. */
  prefix?: string
}

export function configureStorage(options: StorageOptions): void {
  if (options.prefix !== undefined) prefix = options.prefix
  if (options.storage !== undefined)
    store =
      options.storage === 'local' ? undefined : options.storage === false ? null : options.storage
  memoryReset()
}

const resets = new Set<() => void>()
/** Lets the in-memory copies start again when the storage changes. */
export function onStorageReset(reset: () => void): void {
  resets.add(reset)
}
function memoryReset() {
  for (const reset of resets) reset()
}

function backing(): PlayerStorage | null {
  if (store === null) return null
  if (store) return store
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readJson(key: string): unknown {
  try {
    const raw = backing()?.getItem(prefix + key)
    return raw == null ? undefined : (JSON.parse(raw) as unknown)
  } catch {
    return undefined
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    backing()?.setItem(prefix + key, JSON.stringify(value))
  } catch {
    // Kept in memory only.
  }
}
