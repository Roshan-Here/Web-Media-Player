// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { SubtitleHit, SubtitleProvider, SubtitleText } from './models.js'

/*
 * Online subtitles kept in this browser, so the same search or the same file is never asked
 * for twice (TMPlayer's SubtitleCache.kt): a second download of a file costs nothing from the
 * day's quota, and a second search costs nothing from the rate limit. Searches are keyed by the
 * file hash or the parsed name, plus the languages and the machine translation switch; files by
 * provider and file id. Nothing is kept longer than six months, the longest any provider's terms
 * allow; searches go stale after a month, since new uploads arrive.
 */

export const DAY_MS = 24 * 60 * 60 * 1000
export const MAX_TTL_MS = 180 * DAY_MS
export const SEARCH_TTL_MS = 30 * DAY_MS

interface SearchEntry {
  key: string
  saved: number
  hits: SubtitleHit[]
}

interface FileEntry {
  key: string
  saved: number
  extension: SubtitleText['extension']
  text: string
}

type Entry = SearchEntry | FileEntry
export type CacheStoreName = 'searches' | 'files'

/** Two key-value stores of entries keyed by `key`. */
export interface CacheBackend {
  get<T extends Entry>(store: CacheStoreName, key: string): Promise<T | undefined>
  put(store: CacheStoreName, value: Entry): Promise<void>
  delete(store: CacheStoreName, key: string): Promise<void>
  getAll<T extends Entry>(store: CacheStoreName): Promise<T[]>
  clear(store: CacheStoreName): Promise<void>
}

export class SubtitleCache {
  constructor(
    private readonly backend: CacheBackend,
    private readonly now: () => number = Date.now,
    private readonly searchTtlMs = SEARCH_TTL_MS,
    private readonly fileTtlMs = MAX_TTL_MS,
  ) {
    if (!(searchTtlMs > 0 && searchTtlMs <= MAX_TTL_MS && fileTtlMs > 0 && fileTtlMs <= MAX_TTL_MS))
      throw new RangeError('a cache time limit may not exceed six months')
  }

  /** A search's hits, if this exact search was made within the search time limit. */
  async search(key: string): Promise<SubtitleHit[] | null> {
    const entry = await this.safe(() => this.backend.get<SearchEntry>('searches', key))
    if (!entry) return null
    if (this.now() - entry.saved > this.searchTtlMs) {
      await this.safe(() => this.backend.delete('searches', key))
      return null
    }
    return entry.hits
  }

  async putSearch(key: string, hits: SubtitleHit[]): Promise<void> {
    await this.safe(() => this.backend.put('searches', { key, saved: this.now(), hits }))
  }

  /** A downloaded subtitle, if it was fetched within the file time limit. */
  async file(provider: SubtitleProvider, id: string): Promise<SubtitleText | null> {
    const key = fileKey(provider, id)
    const entry = await this.safe(() => this.backend.get<FileEntry>('files', key))
    if (!entry) return null
    if (this.now() - entry.saved > this.fileTtlMs) {
      await this.safe(() => this.backend.delete('files', key))
      return null
    }
    return { extension: entry.extension, text: entry.text }
  }

  /** Whether a file is kept, for greying out results without a read per row. */
  async hasFile(provider: SubtitleProvider, id: string): Promise<boolean> {
    return (await this.file(provider, id)) !== null
  }

  async putFile(provider: SubtitleProvider, id: string, text: SubtitleText): Promise<void> {
    const key = fileKey(provider, id)
    await this.safe(() =>
      this.backend.put('files', {
        key,
        saved: this.now(),
        extension: text.extension,
        text: text.text,
      }),
    )
  }

  /** Every entry older than its time limit, deleted. */
  async prune(): Promise<void> {
    const now = this.now()
    for (const [store, ttl] of [
      ['searches', this.searchTtlMs],
      ['files', this.fileTtlMs],
    ] as const) {
      const all = (await this.safe(() => this.backend.getAll<Entry>(store))) ?? []
      for (const entry of all)
        if (now - entry.saved > ttl) await this.safe(() => this.backend.delete(store, entry.key))
    }
  }

  /** Roughly what the cache holds, in bytes of text. */
  async bytes(): Promise<number> {
    let total = 0
    for (const store of ['searches', 'files'] as const) {
      const all = (await this.safe(() => this.backend.getAll<Entry>(store))) ?? []
      for (const entry of all)
        total += 'text' in entry ? entry.text.length : JSON.stringify(entry).length
    }
    return total
  }

  /** Everything, searches and files. */
  async purge(): Promise<void> {
    await this.safe(() => this.backend.clear('searches'))
    await this.safe(() => this.backend.clear('files'))
  }

  /** A cache that cannot be read (private windows, a blocked database) is an empty one. */
  private async safe<T>(task: () => Promise<T>): Promise<T | undefined> {
    try {
      return await task()
    } catch {
      return undefined
    }
  }
}

const fileKey = (provider: SubtitleProvider, id: string) => `${provider}|${id}`

/** Entries in memory, for tests and for browsers without IndexedDB. */
export function memoryBackend(): CacheBackend {
  const stores: Record<CacheStoreName, Map<string, Entry>> = {
    searches: new Map(),
    files: new Map(),
  }
  return {
    get: async <T extends Entry>(store: CacheStoreName, key: string) =>
      structuredClone(stores[store].get(key)) as T | undefined,
    put: async (store, value) => void stores[store].set(value.key, structuredClone(value)),
    delete: async (store, key) => void stores[store].delete(key),
    getAll: async <T extends Entry>(store: CacheStoreName) => [...stores[store].values()] as T[],
    clear: async (store) => stores[store].clear(),
  }
}

const DEFAULT_DB_NAME = 'web-media-player-subtitles'
const DB_VERSION = 1

/** The cache in an IndexedDB database of its own, `name`, apart from the page's other data. */
export function indexedDbBackend(name = DEFAULT_DB_NAME): CacheBackend {
  let dbPromise: Promise<IDBDatabase> | null = null
  const open = () => {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        for (const name of ['searches', 'files'])
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('IndexedDB is not available'))
      request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'))
    }).catch((error: unknown) => {
      dbPromise = null
      throw error
    })
    return dbPromise
  }
  const run = <T>(
    store: CacheStoreName,
    mode: IDBTransactionMode,
    body: (s: IDBObjectStore) => IDBRequest<T>,
  ) =>
    open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction(store, mode)
          const request = body(tx.objectStore(store))
          tx.oncomplete = () => resolve(request.result)
          tx.onerror = () => reject(tx.error ?? request.error)
          tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
        }),
    )
  return {
    get: <T extends Entry>(store: CacheStoreName, key: string) =>
      run<T | undefined>(store, 'readonly', (s) => s.get(key)),
    put: (store, value) => run(store, 'readwrite', (s) => s.put(value)).then(() => undefined),
    delete: (store, key) => run(store, 'readwrite', (s) => s.delete(key)).then(() => undefined),
    getAll: <T extends Entry>(store: CacheStoreName) =>
      run<T[]>(store, 'readonly', (s) => s.getAll()),
    clear: (store) => run(store, 'readwrite', (s) => s.clear()).then(() => undefined),
  }
}
