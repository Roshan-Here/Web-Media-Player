import { memoryAccountStore, type OnlineAccount } from '../../src/online/account.js'
import { memoryBackend, SubtitleCache } from '../../src/online/cache.js'
import type { HttpRequest, HttpResponse, HttpTransport } from '../../src/online/http.js'
import { OnlineSubtitles } from '../../src/online/service.js'

/*
 * Test doubles for the online subtitle tests (TMPlayer's OnlineSubtitlesTest fixtures): a fake
 * HTTP layer that answers by address, a clock that only moves when something sleeps, and a
 * zip writer for SubDL's archives.
 */

export function response(
  status: number,
  body: string | Uint8Array,
  headers: Record<string, string> = {},
): HttpResponse {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return {
    status,
    header: (name) => lower[name.toLowerCase()] ?? null,
    body: typeof body === 'string' ? new TextEncoder().encode(body) : body,
  }
}

/** Answers by a part of the address, in turn; remembers every request. */
export class FakeHttp {
  readonly requests: HttpRequest[] = []
  private readonly routes: Array<[string, Array<HttpResponse | Error>]> = []

  on(part: string, ...answers: Array<HttpResponse | Error>): void {
    const route = this.routes.find(([p]) => p === part)
    if (route) route[1].push(...answers)
    else this.routes.push([part, [...answers]])
  }

  count(part: string): number {
    return this.requests.filter((r) => r.url.includes(part)).length
  }

  last(part: string): HttpRequest {
    const found = this.requests.filter((r) => r.url.includes(part)).at(-1)
    if (!found) throw new Error(`no request to ${part}`)
    return found
  }

  readonly transport: HttpTransport = async (request) => {
    this.requests.push(request)
    const route = this.routes.find(([part]) => request.url.includes(part))
    if (!route) throw new Error(`unexpected request ${request.method} ${request.url}`)
    const answer = route[1].shift()
    if (!answer) throw new Error(`no answer left for ${route[0]}`)
    if (answer instanceof Error) throw answer
    return answer
  }
}

export class Rig {
  clock = 1_800_000_000_000
  readonly sleeps: number[] = []
  readonly http = new FakeHttp()
  readonly store = memoryAccountStore()
  readonly cache = new SubtitleCache(memoryBackend(), () => this.clock)

  online(apiKey = 'test-key', account?: Partial<OnlineAccount>): OnlineSubtitles {
    if (account) this.store.update((a) => ({ ...a, ...account }))
    return new OnlineSubtitles({
      apiKey,
      appName: 'Reelbox',
      appVersion: '1.0.0',
      store: this.store,
      cache: this.cache,
      http: this.http.transport,
      now: () => this.clock,
      sleep: async (ms) => {
        this.sleeps.push(ms)
        this.clock += ms
      },
    })
  }
}

/** One OpenSubtitles search result, as the API sends it. */
export function hit(
  fileId: number,
  {
    lang = 'en',
    release = `Night.Sky.S01E02.WEB.${fileId}`,
    hash = false,
    downloads = 10,
    machine = false,
  }: {
    lang?: string
    release?: string
    hash?: boolean
    downloads?: number
    machine?: boolean
  } = {},
): unknown {
  return {
    id: String(fileId),
    type: 'subtitle',
    attributes: {
      language: lang,
      release,
      download_count: downloads,
      hearing_impaired: false,
      moviehash_match: hash,
      ai_translated: machine,
      machine_translated: false,
      files: [{ file_id: fileId, file_name: `${release}.srt` }],
    },
  }
}

/** A hit as OpenSubtitles files it: `show` is the feature's parent title for an episode. */
export function filed(
  fileId: number,
  release: string,
  show: string,
  {
    season = 1,
    episode = 4,
    downloads = 10,
  }: { season?: number | null; episode?: number | null; downloads?: number } = {},
): unknown {
  return {
    id: String(fileId),
    type: 'subtitle',
    attributes: {
      language: 'en',
      release,
      download_count: downloads,
      hearing_impaired: false,
      moviehash_match: false,
      ai_translated: false,
      machine_translated: false,
      feature_details: {
        feature_type: 'Episode',
        title: `Episode ${fileId}`,
        parent_title: show,
        season_number: season ?? 0,
        episode_number: episode ?? 0,
        year: 2021,
      },
      files: [{ file_id: fileId, file_name: `${release}.srt` }],
    },
  }
}

export function page(...hits: unknown[]): HttpResponse {
  return response(200, JSON.stringify({ total_count: hits.length, data: hits }))
}

export const json = (status: number, body: unknown, headers?: Record<string, string>) =>
  response(status, typeof body === 'string' ? body : JSON.stringify(body), headers)

/** A zip of text files, deflated, the way SubDL serves them. */
export async function zip(...entries: Array<[string, string]>): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of entries) {
    const nameBytes = encoder.encode(name)
    const raw = encoder.encode(text)
    const data = await deflateRaw(raw)
    const local = new Uint8Array(30 + nameBytes.length)
    const l = new DataView(local.buffer)
    l.setUint32(0, 0x04034b50, true)
    l.setUint16(4, 20, true)
    l.setUint16(6, 0x0800, true)
    l.setUint16(8, 8, true)
    l.setUint32(18, data.length, true)
    l.setUint32(22, raw.length, true)
    l.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    const central = new Uint8Array(46 + nameBytes.length)
    const c = new DataView(central.buffer)
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true)
    c.setUint16(10, 8, true)
    c.setUint32(20, data.length, true)
    c.setUint32(24, raw.length, true)
    c.setUint16(28, nameBytes.length, true)
    c.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    parts.push(local, data)
    centrals.push(central)
    offset += local.length + data.length
  }
  const directorySize = centrals.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, entries.length, true)
  e.setUint16(10, entries.length, true)
  e.setUint32(12, directorySize, true)
  e.setUint32(16, offset, true)
  return concat([...parts, ...centrals, end])
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}
