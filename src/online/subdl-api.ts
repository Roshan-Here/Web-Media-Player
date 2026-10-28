// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import {
  arr,
  bool,
  logProvider,
  obj,
  responseJson,
  sortedQuery,
  str,
  type HttpTransport,
} from './http.js'
import { codeOfEnglishName } from './languages.js'
import { makeHit, type SubtitleHit } from './models.js'
import type { Reply } from './opensubtitles-api.js'
import type { RateLimiter } from './rate-limiter.js'

export const SUBDL_API = 'https://api.subdl.com/api/v1/subtitles'
export const SUBDL_DOWNLOAD = 'https://dl.subdl.com'
const PROVIDER = 'SubDL'

/**
 * SubDL (https://subdl.com/api-doc), the fallback when OpenSubtitles has nothing or cannot hand
 * over a file today: a free key of the person's own (2,000 requests a day), searched by name,
 * season and episode. Its files are zip archives. Requests carry no headers a browser would
 * preflight, and the key travels in the address, so addresses are never logged whole.
 */
export class SubdlApi {
  constructor(
    private readonly http: HttpTransport,
    private readonly limiter: RateLimiter,
  ) {}

  async search(
    key: string,
    name: string,
    season: number | null,
    episode: number | null,
    languages: string[],
  ): Promise<Reply<SubtitleHit[]>> {
    const params: Record<string, string> = {
      api_key: key,
      film_name: name,
      languages: [...new Set(languages.map((l) => l.toUpperCase()))].join(','),
      subs_per_page: '30',
      type: season !== null || episode !== null ? 'tv' : 'movie',
    }
    if (season !== null) params.season_number = String(season)
    if (episode !== null) params.episode_number = String(episode)
    await this.limiter.acquire()
    let status: number
    let json: Record<string, unknown> | null
    try {
      const response = await this.http({
        method: 'GET',
        url: `${SUBDL_API}?${sortedQuery(params)}`,
        headers: { Accept: 'application/json' },
      })
      status = response.status
      json = responseJson(response)
    } catch (error) {
      logProvider(
        PROVIDER,
        'GET',
        SUBDL_API,
        error instanceof Error ? error.message : String(error),
      )
      return { kind: 'failed', code: 0 }
    }
    if (status < 200 || status > 299) logProvider(PROVIDER, 'GET', SUBDL_API, `HTTP ${status}`)
    if (status === 401 || status === 403) return { kind: 'unauthorized' }
    if (status === 429) return { kind: 'throttled', retryAfterMs: 1000 }
    if (!json) return { kind: 'failed', code: status }
    if (!bool(json.status)) {
      // "No subtitles found" and the like are an empty answer; a refused key is not.
      return /key/i.test(str(json.error)) ? { kind: 'unauthorized' } : { kind: 'ok', value: [] }
    }
    return {
      kind: 'ok',
      value: arr(json.subtitles).flatMap((entry): SubtitleHit[] => {
        const item = obj(entry)
        const path = str(item?.url)
        if (!item || !path.trim()) return []
        return [
          makeHit({
            provider: 'Subdl',
            id: path,
            language: languageCode(str(item.lang), str(item.language)),
            release: str(item.release_name).trim() || str(item.name),
            fileName: str(item.name),
            hearingImpaired: bool(item.hi),
          }),
        ]
      }),
    }
  }

  /** The zip behind a hit's download path. */
  async fetch(path: string): Promise<Reply<Uint8Array>> {
    await this.limiter.acquire()
    const address = path.startsWith('http') ? path : `${SUBDL_DOWNLOAD}/${path.replace(/^\/+/, '')}`
    try {
      const response = await this.http({ method: 'GET', url: address })
      if (response.status >= 200 && response.status <= 299)
        return { kind: 'ok', value: response.body }
      logProvider(PROVIDER, 'GET', address, `HTTP ${response.status}`)
      if (response.status === 429) return { kind: 'throttled', retryAfterMs: 1000 }
      return { kind: 'failed', code: response.status }
    } catch (error) {
      logProvider(PROVIDER, 'GET', address, error instanceof Error ? error.message : String(error))
      return { kind: 'failed', code: 0 }
    }
  }
}

/** SubDL answers "english" in `lang` and "EN" in `language`; the two-letter code is what is kept. */
function languageCode(lang: string, language: string): string {
  if (language.length === 2) return language.toLowerCase()
  return codeOfEnglishName(lang) ?? lang
}
