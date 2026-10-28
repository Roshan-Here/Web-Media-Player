// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { isSeriesName, nameQuery, parseMediaName } from './media-name.js'
import {
  anonQuotaUsed,
  DEFAULT_HOST,
  localAccountStore,
  memoryAccountStore,
  quotaUsed,
  signedIn,
  type AccountStore,
  type OnlineAccount,
} from './account.js'
import { DAY_MS, indexedDbBackend, memoryBackend, SubtitleCache } from './cache.js'
import { fetchTransport, type HttpTransport } from './http.js'
import { iso1 } from './languages.js'
import type {
  DownloadResult,
  SearchResult,
  SubtitleHit,
  SubtitleNotice,
  SubtitleTarget,
  SubtitleText,
} from './models.js'
import { OpenSubtitlesApi, refusedRequest, type OsQuery, type Reply } from './opensubtitles-api.js'
import { rank, relevant } from './ranking.js'
import { RateLimiter } from './rate-limiter.js'
import { SubdlApi } from './subdl-api.js'
import { subtitleFromBytes } from './text.js'
import { defaultLabels, makeTranslate } from '../lib/labels.js'
import { trackLabel } from './words.js'
import { logDecoder } from 'web-buildin-decoder'

/** The shortest title OpenSubtitles accepts as a query; shorter ones get a 400. */
export const MIN_QUERY = 3
/** How long a refused key keeps the feature off before one more try, in case it was a blip. */
export const REFUSED_RETRY_MS = DAY_MS

export type SignInResult =
  { kind: 'ok' } | { kind: 'wrongPassword' } | { kind: 'failed'; notice: SubtitleNotice }

/** What Settings shows for the feature, from top to bottom of how much of it works. */
export type OnlineStatus =
  | { kind: 'unavailable' }
  | { kind: 'signedOut' }
  | { kind: 'expired'; username: string }
  | { kind: 'signedIn'; username: string; remaining: number; allowed: number }
  | { kind: 'quotaUsed'; username: string; resetAt: number | null }
  | { kind: 'freeQuotaUsed'; resetAt: number | null }

/**
 * What the player's "Search online" panel needs from a subtitle service. {@link OnlineSubtitles}
 * (OpenSubtitles, with SubDL as a fallback) is the one built in; implement this to search
 * anywhere else.
 */
export interface OnlineSubtitleService {
  /** The subtitles on offer for the video, best first, and why there may be fewer than hoped. */
  search(target: SubtitleTarget): Promise<SearchResult>
  /** One of them as text, or why not. */
  download(hit: SubtitleHit, target: SubtitleTarget | null): Promise<DownloadResult>
  /** Which hits are kept on this device already, so choosing them costs nothing. */
  cachedIds(hits: SubtitleHit[]): Promise<Set<string>>
  /** Why a hit cannot be downloaded right now (it is dimmed, and the reason said), or null. */
  blockedFor(hit: SubtitleHit, cached: boolean): SubtitleNotice | null
  /** Told when what `blockedFor` answers may have changed (a sign in, a used up quota). */
  subscribe?(listener: () => void): () => void
}

export interface OnlineSubtitlesServiceOptions {
  /** Your OpenSubtitles API key (opensubtitles.com, Consumers). */
  apiKey: string
  /** The name your key is registered under at OpenSubtitles, sent as its user agent. */
  appName: string
  appVersion: string
  /** Where the account and quota figures are kept. */
  store: AccountStore
  /** Where searches and downloaded files are kept. */
  cache: SubtitleCache
  http?: HttpTransport
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

/**
 * Subtitles from the internet, for a video that has none in the language wanted (after
 * TMPlayer's OnlineSubtitles.kt):
 *
 * - One app key, an account if the person wants one. Downloads work without signing in, against
 *   an allowance OpenSubtitles gives the app key (100 a day when TMPlayer tried); a signed in
 *   person downloads against their own quota. What the last answer reported is respected before
 *   asking again.
 * - Search by the file hash first, then by the parsed title (with season and episode). Machine
 *   and AI translations are left out unless switched on.
 * - Never in the way. A refused key turns the provider off with a sentence saying so (tried
 *   again a day later, and at once with a new key); a 429 backs off and tries once more; whatever
 *   is cached keeps working; an optional SubDL key of the person's own is the fallback.
 * - Polite. Five requests a second at most and one sign in a second; one search per video at a
 *   time; everything kept in the cache for up to six months.
 */
export class OnlineSubtitles implements OnlineSubtitleService {
  readonly store: AccountStore
  readonly cache: SubtitleCache
  private readonly api: OpenSubtitlesApi
  private readonly subdl: SubdlApi
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>
  private readonly keyPrint: string
  private readonly searches = new Map<string, Promise<unknown>>()

  constructor(options: OnlineSubtitlesServiceOptions) {
    this.store = options.store
    this.cache = options.cache
    this.now = options.now ?? Date.now
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    const http = options.http ?? fetchTransport
    this.api = new OpenSubtitlesApi(
      options.apiKey,
      `${options.appName} v${options.appVersion}`,
      http,
      new RateLimiter(200, this.now, this.sleep),
      new RateLimiter(1000, this.now, this.sleep),
    )
    this.subdl = new SubdlApi(http, new RateLimiter(200, this.now, this.sleep))
    this.keyPrint = fingerprint(options.apiKey)
  }

  subscribe = (listener: () => void): (() => void) => this.store.subscribe(listener)

  /** True while OpenSubtitles is refusing this build's key. */
  keyRefused(a: OnlineAccount = this.store.get()): boolean {
    return a.rejectedKey === this.keyPrint && this.now() - a.rejectedAt < REFUSED_RETRY_MS
  }

  // ---- account --------------------------------------------------------------------------

  async signIn(username: string, password: string): Promise<SignInResult> {
    if (this.keyRefused()) return { kind: 'failed', notice: { kind: 'unavailable' } }
    const name = username.trim()
    const reply = await this.api.login(name, password)
    switch (reply.kind) {
      case 'ok': {
        const session = reply.value
        const info = await this.api.userInfo(session.token, session.baseUrl)
        const quota = info.kind === 'ok' ? info.value : null
        this.store.update((a) => ({
          ...a,
          username: name,
          token: session.token,
          host: session.baseUrl,
          allowed: quota?.allowed ?? session.allowed,
          remaining: quota?.remaining ?? session.allowed,
          resetAt: 0,
          expired: false,
        }))
        return { kind: 'ok' }
      }
      case 'unauthorized':
        return { kind: 'wrongPassword' }
      case 'forbidden':
        this.refuseKey()
        return { kind: 'failed', notice: { kind: 'unavailable' } }
      case 'throttled':
        return { kind: 'failed', notice: { kind: 'busy' } }
      default:
        return { kind: 'failed', notice: { kind: 'offline' } }
    }
  }

  /** Ends the session here and, as a courtesy, at OpenSubtitles. Never fails for the person. */
  async signOut(): Promise<void> {
    const a = this.store.get()
    if (signedIn(a) && !this.keyRefused(a)) await this.api.logout(a.token, a.host).catch(() => null)
    this.store.update((x) => ({
      ...x,
      username: '',
      token: '',
      host: DEFAULT_HOST,
      allowed: 0,
      remaining: -1,
      resetAt: 0,
      expired: false,
    }))
  }

  setIncludeMachine(value: boolean): void {
    this.store.update((a) => ({ ...a, includeMachine: value }))
  }

  setSubdlKey(key: string): void {
    this.store.update((a) => ({ ...a, subdlKey: key.trim(), subdlRefused: false }))
  }

  /** What Settings says under "Online subtitles". */
  status(a: OnlineAccount = this.store.get()): OnlineStatus {
    const now = this.now()
    if (this.keyRefused(a)) return { kind: 'unavailable' }
    if (signedIn(a) && quotaUsed(a, now))
      return { kind: 'quotaUsed', username: a.username, resetAt: a.resetAt > 0 ? a.resetAt : null }
    if (signedIn(a))
      return {
        kind: 'signedIn',
        username: a.username,
        remaining: this.remainingNow(a),
        allowed: a.allowed,
      }
    if (a.expired) return { kind: 'expired', username: a.username }
    if (anonQuotaUsed(a, now))
      return { kind: 'freeQuotaUsed', resetAt: a.anonResetAt > 0 ? a.anonResetAt : null }
    return { kind: 'signedOut' }
  }

  /** The last remaining figure, or the full allowance once the reset time has passed. */
  private remainingNow(a: OnlineAccount): number {
    return a.remaining === 0 && a.resetAt > 0 && this.now() >= a.resetAt ? a.allowed : a.remaining
  }

  // ---- search ---------------------------------------------------------------------------

  /**
   * The subtitles on offer for `target`, best first: hash matches, then relevance, then the
   * wanted languages in order, then the most downloaded. One search per video at a time; a
   * second caller waits and then reads the first one's answer from the cache.
   */
  search(target: SubtitleTarget): Promise<SearchResult> {
    const key = target.hash ?? target.name
    const before = this.searches.get(key) ?? Promise.resolve()
    const run = before.then(() => this.searchNow(target))
    const settled = run.catch(() => undefined)
    this.searches.set(key, settled)
    void settled.then(() => {
      if (this.searches.get(key) === settled) this.searches.delete(key)
    })
    return run
  }

  private async searchNow(target: SubtitleTarget): Promise<SearchResult> {
    const a = this.store.get()
    const parsed = parseMediaName(target.name, target.caption ?? null)
    const languages = uniqueLanguages(target.languages)
    const machine = a.includeMachine
    const tail = `|${languages.join(',')}|${machine ? 'm' : '-'}`
    const name = (isSeriesName(parsed) ? parsed.title : nameQuery(parsed)).trim()
    const show = (n: number | null) => (n === null ? 'null' : String(n))

    const queries: Array<[string, OsQuery]> = []
    if (target.hash)
      queries.push([
        `os|hash:${target.hash}${tail}`,
        { hash: target.hash, languages, includeMachine: machine },
      ])
    if (name.length >= MIN_QUERY)
      queries.push([
        `os|name:${name.toLowerCase()}|${show(parsed.season)}|${show(parsed.episode)}${tail}`,
        {
          name,
          season: parsed.season,
          episode: parsed.episode,
          languages,
          includeMachine: machine,
        },
      ])

    let hits: SubtitleHit[] = []
    let fromCache = false
    let problem: SubtitleNotice | null = null
    const merge = (more: SubtitleHit[]) => {
      const seen = new Set(hits.map((h) => h.id))
      hits = [...hits, ...more.filter((h) => !seen.has(h.id))]
    }
    // A search that matches nothing of this video can still answer, with other people's films:
    // a hash nobody has seen brings back whatever is recent in the languages asked for, and a
    // name with a year in it every release of that year. Only an answer with something in it
    // for this video ends the search; anything else is kept and judged with the rest below.
    const settles = (found: SubtitleHit[]) => relevant(found, parsed).length > 0

    if (this.keyRefused(a)) {
      problem = { kind: 'unavailable' }
    } else {
      for (const [key, query] of queries) {
        const cached = await this.cache.search(key)
        if (cached) {
          if (cached.length === 0) continue
          merge(cached)
          fromCache = true
          if (settles(cached)) break
          continue
        }
        const reply = await this.withBackoff(() => this.api.search(query, a.host))
        if (reply.kind === 'ok') {
          await this.cache.putSearch(key, reply.value)
          merge(reply.value)
          if (settles(reply.value)) break
        } else if (reply.kind === 'forbidden' || reply.kind === 'unauthorized') {
          this.refuseKey()
          problem = { kind: 'unavailable' }
          break
        } else if (reply.kind === 'throttled' || reply.kind === 'quota') {
          problem = { kind: 'busy' }
          break
        } else {
          // The service answered and turned this one query down: the next one may still find
          // something, and the connection is not what failed.
          if (refusedRequest(reply)) continue
          problem = { kind: 'offline' }
          break
        }
      }
    }
    if (!machine) hits = hits.filter((h) => !h.machine)

    // SubDL, when the person has a key and OpenSubtitles came back empty handed or cannot hand
    // over a file today.
    let subdlProblem: SubtitleNotice | null = null
    const now = this.now()
    const fallback =
      a.subdlKey.trim() !== '' &&
      !a.subdlRefused &&
      name !== '' &&
      (hits.length === 0 || problem !== null || quotaUsed(a, now) || anonQuotaUsed(a, now))
    if (fallback) {
      const key = `subdl|${name.toLowerCase()}|${show(parsed.season)}|${show(parsed.episode)}${tail}`
      const cached = await this.cache.search(key)
      if (cached) {
        hits = [...hits, ...cached]
        fromCache = fromCache || hits.length > 0
      } else {
        const reply = await this.withBackoff(() =>
          this.subdl.search(a.subdlKey, name, parsed.season, parsed.episode, languages),
        )
        if (reply.kind === 'ok') {
          await this.cache.putSearch(key, reply.value)
          hits = [...hits, ...reply.value]
        } else if (reply.kind === 'unauthorized' || reply.kind === 'forbidden') {
          this.store.update((x) => ({ ...x, subdlRefused: true }))
          subdlProblem = { kind: 'subdlKeyRefused' }
        }
      }
    }

    const sorted = rank(hits, parsed, languages)
    const anyOpenSubtitles = sorted.some((h) => h.provider === 'OpenSubtitles')
    const notice =
      sorted.length === 0
        ? (problem ?? subdlProblem)
        : (problem ?? (anyOpenSubtitles ? (this.accountNotice(a) ?? subdlProblem) : subdlProblem))
    return { hits: sorted, notice, fromCache }
  }

  /**
   * The line above OpenSubtitles results: a used up quota, the person's or the free one, or a
   * sign in that ran out. An expired sign in blocks nothing; downloads carry on without an
   * account meanwhile.
   */
  private accountNotice(a: OnlineAccount): SubtitleNotice | null {
    return this.downloadBlock(a) ?? (!signedIn(a) && a.expired ? { kind: 'signInExpired' } : null)
  }

  /** What stands between the person and a download from OpenSubtitles, before asking. */
  private downloadBlock(a: OnlineAccount): SubtitleNotice | null {
    const now = this.now()
    if (quotaUsed(a, now)) return { kind: 'quotaUsed', resetAt: a.resetAt > 0 ? a.resetAt : null }
    if (anonQuotaUsed(a, now))
      return { kind: 'freeQuotaUsed', resetAt: a.anonResetAt > 0 ? a.anonResetAt : null }
    return null
  }

  /**
   * Why `hit` cannot be downloaded right now, or null when it can: kept in this browser already
   * (`cached`), from SubDL, or from OpenSubtitles with downloads left and the key accepted. The
   * list greys out what this names, and says why above it.
   */
  blockedFor(
    hit: SubtitleHit,
    cached: boolean,
    a: OnlineAccount = this.store.get(),
  ): SubtitleNotice | null {
    if (hit.provider !== 'OpenSubtitles' || cached) return null
    if (this.keyRefused(a)) return { kind: 'unavailable' }
    return this.downloadBlock(a)
  }

  /** Which of `hits` are kept in this browser already, so choosing them costs nothing. */
  async cachedIds(hits: SubtitleHit[]): Promise<Set<string>> {
    const out = new Set<string>()
    for (const hit of hits)
      if (await this.cache.hasFile(hit.provider, hit.id)) out.add(cacheId(hit))
    return out
  }

  // ---- download -------------------------------------------------------------------------

  /**
   * `hit` as subtitle text. A file fetched before comes from the cache and uses nothing;
   * otherwise this is the call that uses one of the day's downloads.
   */
  async download(hit: SubtitleHit, target: SubtitleTarget | null = null): Promise<DownloadResult> {
    const cached = await this.cache.file(hit.provider, hit.id)
    if (cached)
      return {
        kind: 'done',
        subtitle: cached,
        label: trackLabel(englishWords, hit),
        fromCache: true,
      }
    return hit.provider === 'OpenSubtitles'
      ? this.downloadOpenSubtitles(hit)
      : this.downloadSubdl(hit, target)
  }

  private async downloadOpenSubtitles(hit: SubtitleHit): Promise<DownloadResult> {
    const a = this.store.get()
    if (this.keyRefused(a)) return failed({ kind: 'unavailable' })
    if (!signedIn(a)) return this.downloadAnonymously(hit, a)
    if (quotaUsed(a, this.now()))
      return failed({ kind: 'quotaUsed', resetAt: a.resetAt > 0 ? a.resetAt : null })
    const reply = await this.withBackoff(() => this.api.download(hit.id, a.token, a.host))
    switch (reply.kind) {
      case 'ok': {
        const link = reply.value
        this.store.update((x) => ({
          ...x,
          remaining: link.remaining >= 0 ? link.remaining : x.remaining,
          resetAt: link.resetAt ?? x.resetAt,
        }))
        return this.fetchLink(hit, link.url, link.fileName)
      }
      case 'quota': {
        const reset = reply.resetAt ?? this.now() + DAY_MS
        this.store.update((x) => ({ ...x, remaining: 0, resetAt: reset }))
        return failed({ kind: 'quotaUsed', resetAt: reset })
      }
      case 'unauthorized':
        this.store.update((x) => ({ ...x, token: '', expired: true }))
        return failed({ kind: 'signInExpired' })
      case 'forbidden':
        this.refuseKey()
        return failed({ kind: 'unavailable' })
      case 'throttled':
        return failed({ kind: 'busy' })
      default:
        return failed({ kind: 'offline' })
    }
  }

  /**
   * The same download with the app key alone, against the allowance OpenSubtitles gives without
   * an account. Its figures are kept apart from the account's.
   */
  private async downloadAnonymously(hit: SubtitleHit, a: OnlineAccount): Promise<DownloadResult> {
    if (anonQuotaUsed(a, this.now()))
      return failed({ kind: 'freeQuotaUsed', resetAt: a.anonResetAt > 0 ? a.anonResetAt : null })
    const reply = await this.withBackoff(() => this.api.download(hit.id, null, DEFAULT_HOST))
    switch (reply.kind) {
      case 'ok': {
        const link = reply.value
        this.store.update((x) => {
          const remaining = link.remaining >= 0 ? link.remaining : x.anonRemaining
          return {
            ...x,
            anonRemaining: remaining,
            // A used up allowance with no time given is tried again a day later rather than never.
            anonResetAt: link.resetAt ?? (remaining === 0 ? this.now() + DAY_MS : x.anonResetAt),
          }
        })
        return this.fetchLink(hit, link.url, link.fileName)
      }
      case 'quota': {
        const reset = reply.resetAt ?? this.now() + DAY_MS
        this.store.update((x) => ({ ...x, anonRemaining: 0, anonResetAt: reset }))
        return failed({ kind: 'freeQuotaUsed', resetAt: reset })
      }
      // OpenSubtitles asking for an account after all: signing in is the way through.
      case 'unauthorized':
        return failed({ kind: 'signInToDownload' })
      case 'forbidden':
        this.refuseKey()
        return failed({ kind: 'unavailable' })
      case 'throttled':
        return failed({ kind: 'busy' })
      default:
        return failed({ kind: 'offline' })
    }
  }

  private async fetchLink(
    hit: SubtitleHit,
    url: string,
    fileName: string,
  ): Promise<DownloadResult> {
    const body = await this.api.fetch(url)
    if (body.kind !== 'ok') return failed({ kind: 'offline' })
    return this.save(hit, await subtitleFromBytes(body.value, fileName.trim() || hit.fileName))
  }

  private async downloadSubdl(
    hit: SubtitleHit,
    target: SubtitleTarget | null,
  ): Promise<DownloadResult> {
    const parsed = target ? parseMediaName(target.name, target.caption ?? null) : null
    const body = await this.withBackoff(() => this.subdl.fetch(hit.id))
    if (body.kind === 'throttled') return failed({ kind: 'busy' })
    if (body.kind !== 'ok') return failed({ kind: 'offline' })
    return this.save(
      hit,
      await subtitleFromBytes(
        body.value,
        hit.fileName,
        parsed?.season ?? null,
        parsed?.episode ?? null,
      ),
    )
  }

  private async save(hit: SubtitleHit, text: SubtitleText | null): Promise<DownloadResult> {
    if (!text) return failed({ kind: 'unreadable' })
    await this.cache.putFile(hit.provider, hit.id, text)
    return { kind: 'done', subtitle: text, label: trackLabel(englishWords, hit), fromCache: false }
  }

  // ---- shared ---------------------------------------------------------------------------

  /** Everything kept: every search and file. The account stays. */
  purge(): Promise<void> {
    return this.cache.purge()
  }

  /** One retry after the wait a 429 asks for. */
  private async withBackoff<T>(call: () => Promise<Reply<T>>): Promise<Reply<T>> {
    const first = await call()
    if (first.kind !== 'throttled') return first
    await this.sleep(first.retryAfterMs)
    return call()
  }

  private refuseKey(): void {
    logDecoder(
      'subtitles: OpenSubtitles refused the app key; online subtitles are off for now',
      undefined,
      'warn',
    )
    this.store.update((a) => ({ ...a, rejectedKey: this.keyPrint, rejectedAt: this.now() }))
  }
}

/** Labels for the results' names here; the player names them again in its own language. */
const englishWords = { t: makeTranslate(defaultLabels) }

export interface CreateOnlineSubtitlesOptions {
  /** Your OpenSubtitles API key (opensubtitles.com, Consumers). */
  apiKey: string
  /** The name your key is registered under at OpenSubtitles. */
  appName: string
  appVersion: string
  /** localStorage key for the account and quota figures. */
  accountKey?: string
  /** IndexedDB database for searches and files. */
  cacheName?: string
  http?: HttpTransport
}

/**
 * The built-in online subtitle service, ready to use: OpenSubtitles with your API key, the
 * viewer's optional account and SubDL key kept in localStorage, and searches and files kept
 * in IndexedDB (in memory where there is none) for up to six months.
 */
export function createOnlineSubtitles(options: CreateOnlineSubtitlesOptions): OnlineSubtitles {
  const backend =
    typeof indexedDB === 'undefined' ? memoryBackend() : indexedDbBackend(options.cacheName)
  const service = new OnlineSubtitles({
    apiKey: options.apiKey,
    appName: options.appName,
    appVersion: options.appVersion,
    store:
      typeof localStorage === 'undefined'
        ? memoryAccountStore()
        : localAccountStore(options.accountKey),
    cache: new SubtitleCache(backend),
    http: options.http,
  })
  // Old entries go off the playback path, a moment after the page settles.
  setTimeout(() => void service.cache.prune(), 0)
  return service
}

/** The id the result list keys a hit by. */
export const cacheId = (hit: SubtitleHit) => `${hit.provider}|${hit.id}`

const failed = (notice: SubtitleNotice): DownloadResult => ({ kind: 'failed', notice })

function uniqueLanguages(codes: string[]): string[] {
  const out: string[] = []
  for (const code of codes) {
    const c = iso1(code)
    if (c && !out.includes(c)) out.push(c)
  }
  return out.length > 0 ? out : ['en']
}

/** A short, one-way fingerprint of the key (FNV-1a, 64 bits), which is all the account keeps. */
function fingerprint(key: string): string {
  let hash = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(key)) {
    hash ^= BigInt(byte)
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0').slice(0, 12)
}
