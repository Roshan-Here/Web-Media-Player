// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/*
 * The person's OpenSubtitles account and the online subtitle switches, as this browser knows
 * them (TMPlayer's OnlineSubtitlesStore.kt). The token is the session OpenSubtitles hands out at
 * sign in; the password is never kept. The quota figures are the last ones OpenSubtitles
 * reported. `anonRemaining` and `anonResetAt` are the same figures for downloads made without an
 * account, kept apart so signing in or out never mixes the two. `rejectedKey` is a fingerprint of
 * an app key OpenSubtitles refused, so the feature stays off for that key and comes back by
 * itself when a new build brings another.
 */

export const DEFAULT_HOST = 'api.opensubtitles.com'

export interface OnlineAccount {
  username: string
  token: string
  host: string
  allowed: number
  /** -1 when unknown. */
  remaining: number
  /** Epoch milliseconds; 0 when unknown. */
  resetAt: number
  /** Signed in once, then OpenSubtitles stopped taking the token. */
  expired: boolean
  includeMachine: boolean
  subdlKey: string
  subdlRefused: boolean
  rejectedKey: string
  rejectedAt: number
  /** Downloads left without an account, as the last anonymous download reported; -1 unknown. */
  anonRemaining: number
  anonResetAt: number
}

export const EMPTY_ACCOUNT: OnlineAccount = {
  username: '',
  token: '',
  host: DEFAULT_HOST,
  allowed: 0,
  remaining: -1,
  resetAt: 0,
  expired: false,
  includeMachine: false,
  subdlKey: '',
  subdlRefused: false,
  rejectedKey: '',
  rejectedAt: 0,
  anonRemaining: -1,
  anonResetAt: 0,
}

export const signedIn = (a: OnlineAccount) => a.token.trim().length > 0

/** No downloads left until resetAt, as far as the last answer said. */
export const quotaUsed = (a: OnlineAccount, now: number) =>
  signedIn(a) && a.remaining === 0 && (a.resetAt === 0 || now < a.resetAt)

/** Not signed in, and the downloads allowed without an account are used up until anonResetAt. */
export const anonQuotaUsed = (a: OnlineAccount, now: number) =>
  !signedIn(a) && a.anonRemaining === 0 && (a.anonResetAt === 0 || now < a.anonResetAt)

/** Where the account lives: localStorage, or memory (tests, or nothing kept). */
export interface AccountStore {
  get(): OnlineAccount
  update(change: (a: OnlineAccount) => OnlineAccount): void
  subscribe(listener: () => void): () => void
}

export function memoryAccountStore(initial: Partial<OnlineAccount> = {}): AccountStore {
  let value: OnlineAccount = { ...EMPTY_ACCOUNT, ...initial }
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    update(change) {
      const next = change(value)
      if (shallowEqual(next, value)) return
      value = next
      for (const l of listeners) l()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * The account in localStorage under `key`, shared by every tab of this browser. A sign in or
 * out in one tab shows in the others.
 */
export function localAccountStore(key = 'web-media-player:online-subtitles-account'): AccountStore {
  const STORAGE_KEY = key
  const load = (): OnlineAccount => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const saved = raw ? (JSON.parse(raw) as Partial<OnlineAccount>) : {}
      return sanitize(saved)
    } catch {
      return EMPTY_ACCOUNT
    }
  }
  const memory = memoryAccountStore(load())
  // A sign in or out in another tab shows here too.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) memory.update(() => load())
    })
  }
  return {
    get: memory.get,
    subscribe: memory.subscribe,
    update(change) {
      memory.update(change)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memory.get()))
      } catch {
        // Private windows and full storage: the account lasts for this page only.
      }
    },
  }
}

function sanitize(saved: Partial<OnlineAccount>): OnlineAccount {
  const out: OnlineAccount = { ...EMPTY_ACCOUNT }
  for (const key of Object.keys(EMPTY_ACCOUNT) as (keyof OnlineAccount)[]) {
    const value = saved[key]
    if (typeof value === typeof EMPTY_ACCOUNT[key])
      (out as unknown as Record<string, unknown>)[key] = value
  }
  if (!out.host) out.host = DEFAULT_HOST
  return out
}

function shallowEqual(a: OnlineAccount, b: OnlineAccount): boolean {
  return (Object.keys(a) as (keyof OnlineAccount)[]).every((k) => a[k] === b[k])
}
