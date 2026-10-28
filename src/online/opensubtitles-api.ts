// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { DEFAULT_HOST } from './account.js'
import {
  arr,
  bool,
  logProvider,
  num,
  obj,
  responseJson,
  responseText,
  sortedQuery,
  str,
  type HttpResponse,
  type HttpTransport,
} from './http.js'
import { makeHit, type SubtitleHit } from './models.js'
import type { RateLimiter } from './rate-limiter.js'

/** A provider's answer, sorted into what the caller has to tell apart. */
export type Reply<T> =
  | { kind: 'ok'; value: T }
  /** 401: the token (or, at sign in, the password) was not accepted. */
  | { kind: 'unauthorized' }
  /** 403: the app key itself was refused. */
  | { kind: 'forbidden' }
  /** The day's downloads are used up. */
  | { kind: 'quota'; resetAt: number | null }
  /** 429 without a quota attached: too many requests, try again after retryAfterMs. */
  | { kind: 'throttled'; retryAfterMs: number }
  /**
   * No connection (code 0), a server error, or an answer that could not be read. A 4xx other
   * than the ones above is the provider turning down this one request (OpenSubtitles answers
   * 400 to a title under three letters, for one).
   */
  | { kind: 'failed'; code: number }

/** The provider answered and said no to the request itself, so the network is fine. */
export const refusedRequest = (reply: Reply<unknown>) =>
  reply.kind === 'failed' && reply.code >= 400 && reply.code <= 499

export interface OsSession {
  token: string
  baseUrl: string
  allowed: number
}
export interface OsQuota {
  allowed: number
  remaining: number
}
export interface OsLink {
  url: string
  fileName: string
  /** -1 when the answer did not say. */
  remaining: number
  resetAt: number | null
}

/** A search: the hash, or a name with season and episode; never both. */
export interface OsQuery {
  hash?: string | null
  name?: string | null
  season?: number | null
  episode?: number | null
  languages: string[]
  includeMachine: boolean
}

const PROVIDER = 'OpenSubtitles'

/**
 * OpenSubtitles.com's REST API, version 1 (https://opensubtitles.stoplight.io/docs/opensubtitles-api):
 * sign in and out, the account's quota, search, and the download link. Every call carries the
 * app key and goes through `limiter` (five a second); sign in also through `loginLimiter` (one a
 * second). Parameters are sent sorted and in lower case, which the API wants to avoid a redirect
 * on every search.
 *
 * Browsers do not let a page set User-Agent, which the API asks every client for; OpenSubtitles
 * reads `X-User-Agent` from browser clients instead. It is a custom header, so it has to pass the
 * cross-origin preflight; should a preflight ever refuse it, the request is sent once more
 * without it and later requests leave it out.
 */
export class OpenSubtitlesApi {
  private sendUserAgent = true

  constructor(
    private readonly apiKey: string,
    private readonly userAgent: string,
    private readonly http: HttpTransport,
    private readonly limiter: RateLimiter,
    private readonly loginLimiter: RateLimiter,
  ) {}

  async login(username: string, password: string): Promise<Reply<OsSession>> {
    await this.loginLimiter.acquire()
    const body = JSON.stringify({ username, password })
    return this.call('POST', url(DEFAULT_HOST, 'login'), { body }, (json) => {
      const token = str(json.token)
      if (!token.trim()) return null
      return {
        token,
        baseUrl: str(json.base_url).trim() || DEFAULT_HOST,
        allowed: num(obj(json.user)?.allowed_downloads),
      }
    })
  }

  userInfo(token: string, host: string): Promise<Reply<OsQuota>> {
    return this.call('GET', url(host, 'infos/user'), { token }, (json) => {
      const data = obj(json.data)
      if (!data) return null
      return { allowed: num(data.allowed_downloads), remaining: num(data.remaining_downloads) }
    })
  }

  logout(token: string, host: string): Promise<Reply<true>> {
    return this.call('DELETE', url(host, 'logout'), { token }, () => true)
  }

  search(query: OsQuery, host: string): Promise<Reply<SubtitleHit[]>> {
    const params: Record<string, string> = {
      // `machine_translated` is no longer a parameter: the API answers every search that sends
      // it with a 301 to the same address without it. Machine translations are flagged on each
      // hit instead, and filtered there.
      ai_translated: query.includeMachine ? 'include' : 'exclude',
      languages: [...new Set(query.languages.map((l) => l.toLowerCase()))].sort().join(','),
    }
    if (query.hash) params.moviehash = query.hash.toLowerCase()
    if (query.name) params.query = query.name.toLowerCase().trim()
    if (query.season != null) params.season_number = String(query.season)
    if (query.episode != null) params.episode_number = String(query.episode)
    return this.call('GET', `${url(host, 'subtitles')}?${sortedQuery(params)}`, {}, (json) =>
      arr(json.data).flatMap((item): SubtitleHit[] => {
        const attributes = obj(obj(item)?.attributes)
        const file = obj(arr(attributes?.files)[0])
        if (!attributes || !file) return []
        const fileId = num(file.file_id)
        if (fileId <= 0) return []
        // An episode is filed under its own title ("The Nexus Event") with the show as the
        // parent ("Loki"); a film under its title alone.
        const feature = obj(attributes.feature_details)
        const named = (v: unknown) => {
          const s = str(v)
          return s.trim() && s !== 'null' ? s : ''
        }
        const positive = (v: unknown) => (num(v) > 0 ? num(v) : null)
        return [
          makeHit({
            provider: 'OpenSubtitles',
            id: String(fileId),
            language: str(attributes.language),
            release: str(attributes.release).trim() || str(file.file_name),
            fileName: str(file.file_name),
            downloads: num(attributes.download_count),
            hashMatch: bool(attributes.moviehash_match),
            hearingImpaired: bool(attributes.hearing_impaired),
            machine: bool(attributes.ai_translated) || bool(attributes.machine_translated),
            featureTitle: feature ? named(feature.parent_title) || named(feature.title) : '',
            featureSeason: positive(feature?.season_number),
            featureEpisode: positive(feature?.episode_number),
            featureYear: positive(feature?.year),
          }),
        ]
      }),
    )
  }

  /**
   * Asks for a file's download link. This is the call that uses one of the day's downloads:
   * the account's with a token, or the allowance OpenSubtitles gives the app key without one.
   */
  download(fileId: string, token: string | null, host: string): Promise<Reply<OsLink>> {
    const body = JSON.stringify({ file_id: Number(fileId) })
    return this.call('POST', url(host, 'download'), { token, body, quotaCall: true }, (json) => {
      const link = str(json.link)
      if (!link.trim()) return null
      return {
        url: link,
        fileName: str(json.file_name),
        remaining: typeof json.remaining === 'number' ? json.remaining : -1,
        resetAt: resetAt(json),
      }
    })
  }

  /**
   * The file behind a download link: OpenSubtitles' own file server, which needs no key. Sent
   * with no headers at all, so the browser asks without a preflight.
   */
  async fetch(link: string): Promise<Reply<Uint8Array>> {
    await this.limiter.acquire()
    let response: HttpResponse
    try {
      response = await this.http({ method: 'GET', url: link })
    } catch (error) {
      logProvider(PROVIDER, 'GET', link, describe(error))
      return { kind: 'failed', code: 0 }
    }
    if (response.status >= 200 && response.status <= 299)
      return { kind: 'ok', value: response.body }
    logProvider(PROVIDER, 'GET', link, `HTTP ${response.status}`)
    return { kind: 'failed', code: response.status }
  }

  private async call<T>(
    method: 'GET' | 'POST' | 'DELETE',
    address: string,
    options: { token?: string | null; body?: string; quotaCall?: boolean },
    parse: (json: Record<string, unknown>) => T | null,
  ): Promise<Reply<T>> {
    await this.limiter.acquire()
    const send = (withAgent: boolean) => {
      const headers: Record<string, string> = { 'Api-Key': this.apiKey, Accept: 'application/json' }
      if (withAgent) headers['X-User-Agent'] = this.userAgent
      if (options.body !== undefined) headers['Content-Type'] = 'application/json'
      if (options.token) headers.Authorization = `Bearer ${options.token}`
      return this.http({ method, url: address, headers, body: options.body })
    }
    let response: HttpResponse
    try {
      response = await send(this.sendUserAgent)
    } catch (error) {
      if (!this.sendUserAgent) {
        logProvider(PROVIDER, method, address, describe(error))
        return { kind: 'failed', code: 0 }
      }
      // Perhaps the preflight refused X-User-Agent, perhaps the connection is down: once more
      // without the header tells the two apart.
      try {
        response = await send(false)
        this.sendUserAgent = false
      } catch (again) {
        logProvider(PROVIDER, method, address, describe(again))
        return { kind: 'failed', code: 0 }
      }
    }
    const json = responseJson(response)
    const ok = response.status >= 200 && response.status <= 299
    const parsed = ok && json ? parse(json) : null
    if (parsed !== null) return { kind: 'ok', value: parsed }
    const said = responseText(response).slice(0, 200).replace(/\s+/g, ' ').trim()
    logProvider(PROVIDER, method, address, `HTTP ${response.status}${said ? `: ${said}` : ''}`)
    if (ok) return { kind: 'failed', code: response.status }
    if (response.status === 401) return { kind: 'unauthorized' }
    if (response.status === 403) return { kind: 'forbidden' }
    // 406 is the documented "download limit reached"; a 429 that carries the quota fields is
    // the same thing said with the rate limit's status.
    if (
      options.quotaCall &&
      (response.status === 406 || (response.status === 429 && json && looksLikeQuota(json)))
    )
      return { kind: 'quota', resetAt: json ? resetAt(json) : null }
    if (response.status === 429) return { kind: 'throttled', retryAfterMs: retryAfter(response) }
    return { kind: 'failed', code: response.status }
  }
}

function looksLikeQuota(json: Record<string, unknown>): boolean {
  return 'remaining' in json || 'reset_time_utc' in json || /allowed/i.test(str(json.message))
}

function retryAfter(response: HttpResponse): number {
  const value = response.header('Retry-After')?.trim() ?? ''
  if (!/^\d+$/.test(value)) return 1000
  return Math.min(10_000, Math.max(200, Number(value) * 1000))
}

function resetAt(json: Record<string, unknown>): number | null {
  const at = Date.parse(str(json.reset_time_utc))
  return Number.isFinite(at) ? at : null
}

function url(host: string, path: string): string {
  const clean = host.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return `https://${clean}/api/v1/${path}`
}

const describe = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e))
