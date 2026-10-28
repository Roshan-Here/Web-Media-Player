import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DAY_MS,
  MAX_TTL_MS,
  memoryBackend,
  SEARCH_TTL_MS,
  SubtitleCache,
} from '../../src/online/cache.js'
import { makeHit, type SubtitleTarget } from '../../src/online/models.js'
import { REFUSED_RETRY_MS } from '../../src/online/service.js'
import { filed, hit, json, page, response, Rig, zip } from './test-helpers.js'
import { noticeText } from '../../src/online/words.js'
import { defaultLabels, makeTranslate } from '../../src/lib/labels.js'

const words = { t: makeTranslate(defaultLabels) }

/*
 * Online subtitles against a fake HTTP layer: what is asked of OpenSubtitles and SubDL, and what
 * the app does with each kind of answer. A port of TMPlayer's OnlineSubtitlesTest.
 */

const episode: SubtitleTarget = {
  name: 'Night.Sky.S01E02.1080p.WEB.mkv',
  hash: '8e245d9679d31e12',
  languages: ['es', 'en'],
}

const srt = '1\n00:00:01,000 --> 00:00:02,000\nHola\n'
const osHit = makeHit({
  provider: 'OpenSubtitles',
  id: '4242',
  language: 'es',
  release: 'Night.Sky.S01E02',
  fileName: 'Night.Sky.S01E02.srt',
})
const ids = (hits: { id: string }[]) => hits.map((h) => h.id)

let rig: Rig
beforeEach(() => {
  rig = new Rig()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

async function signIn(o: ReturnType<Rig['online']>, allowed = 20, remaining = 20) {
  rig.http.on(
    '/login',
    json(200, {
      user: { allowed_downloads: allowed },
      base_url: 'vip-api.opensubtitles.com',
      token: 'tok-1',
      status: 200,
    }),
  )
  rig.http.on(
    '/infos/user',
    json(200, { data: { allowed_downloads: allowed, remaining_downloads: remaining } }),
  )
  expect(await o.signIn('viewer', 'secret')).toEqual({ kind: 'ok' })
}

describe('search', () => {
  it('sends the hash, the key, the agent and sorted lower case parameters', async () => {
    const o = rig.online()
    rig.http.on(
      '/subtitles',
      page(
        hit(1, { lang: 'en', downloads: 900 }),
        hit(2, { lang: 'es', hash: true, downloads: 3 }),
        hit(3, { lang: 'es', downloads: 50 }),
      ),
    )
    const result = await o.search(episode)
    const request = rig.http.requests[0]!
    expect(rig.http.requests).toHaveLength(1)
    expect(request.method).toBe('GET')
    expect(request.url).toBe(
      'https://api.opensubtitles.com/api/v1/subtitles?ai_translated=exclude&languages=en%2Ces&moviehash=8e245d9679d31e12',
    )
    expect(request.headers?.['Api-Key']).toBe('test-key')
    expect(request.headers?.['X-User-Agent']).toBe('Reelbox v1.0.0')
    expect(request.headers?.Authorization).toBeUndefined()
    // Hash match first, then the wanted languages in order, then downloads.
    expect(ids(result.hits)).toEqual(['2', '3', '1'])
    expect(result.notice).toBeNull()
    expect(o.blockedFor(result.hits[0]!, false)).toBeNull()
  })

  it('falls back to the name with season and episode when the hash finds nothing', async () => {
    const o = rig.online()
    rig.http.on('moviehash=', page())
    rig.http.on('query=', page(hit(7)))
    const result = await o.search(episode)
    expect(rig.http.requests).toHaveLength(2)
    const byName = rig.http.requests[1]!.url
    expect(byName).toContain('query=night+sky')
    expect(byName).toContain('season_number=1')
    expect(byName).toContain('episode_number=2')
    expect(byName).not.toContain('moviehash')
    expect(ids(result.hits)).toEqual(['7'])
  })

  it('searches a film without a hash by title and year', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', page(hit(9)))
    await o.search({ name: 'The.Matrix.1999.1080p.BluRay.mkv', languages: ['en'] })
    expect(rig.http.requests[0]!.url).toContain('query=the+matrix+1999')
  })

  it('leaves machine translations out unless switched on', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', page(hit(1, { machine: true }), hit(2)))
    expect(ids((await o.search(episode)).hits)).toEqual(['2'])

    o.setIncludeMachine(true)
    rig.http.on('/subtitles', page(hit(1, { machine: true }), hit(2)))
    const withMachine = await o.search(episode)
    expect(rig.http.requests.at(-1)!.url).toContain('ai_translated=include')
    expect(new Set(ids(withMachine.hits))).toEqual(new Set(['1', '2']))
  })

  it('never sends machine_translated, which the API answers with a redirect', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', page(hit(1)))
    await o.search(episode)
    expect(rig.http.requests[0]!.url).not.toContain('machine_translated')
  })

  it('answers a repeated search from the cache until it goes stale', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', page(hit(1)))
    await o.search(episode)
    const again = await o.search(episode)
    expect(rig.http.requests).toHaveLength(1)
    expect(again.fromCache).toBe(true)
    expect(ids(again.hits)).toEqual(['1'])

    rig.clock += SEARCH_TTL_MS + 1
    rig.http.on('/subtitles', page(hit(2)))
    const fresh = await o.search(episode)
    expect(rig.http.requests).toHaveLength(2)
    expect(fresh.fromCache).toBe(false)
    expect(ids(fresh.hits)).toEqual(['2'])
  })

  it('backs off for Retry-After on a 429 and tries once more', async () => {
    const o = rig.online()
    rig.http.on(
      '/subtitles',
      json(429, { message: 'Throttle limit reached' }, { 'Retry-After': '2' }),
      page(hit(1)),
    )
    expect(ids((await o.search(episode)).hits)).toEqual(['1'])
    expect(rig.sleeps).toContain(2000)
  })

  it('says busy after two 429s in a row, and caches nothing', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', json(429, {}), json(429, {}))
    const result = await o.search(episode)
    expect(result.notice).toEqual({ kind: 'busy' })
    expect(result.hits).toEqual([])
    rig.http.on('/subtitles', page(hit(1)))
    expect(ids((await o.search(episode)).hits)).toEqual(['1'])
  })

  it('spaces requests to five a second', async () => {
    const o = rig.online()
    for (let i = 0; i < 5; i++) {
      rig.http.on('/subtitles', page(hit(i + 1, { release: `Film${i}.WEB` })))
      await o.search({
        ...episode,
        hash: (i + 1).toString(16).padStart(16, '0'),
        name: `Film${i}.mkv`,
      })
    }
    expect(rig.http.requests).toHaveLength(5)
    // The clock only moves when the limiter sleeps, so four gaps of 200 ms are four sleeps.
    expect(rig.sleeps).toEqual([200, 200, 200, 200])
  })

  it('says offline when there is no connection', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', new TypeError('Failed to fetch'), new TypeError('Failed to fetch'))
    const result = await o.search({ ...episode, hash: null })
    expect(result.notice).toEqual({ kind: 'offline' })
  })

  it('says offline on a server error or an answer that is not JSON', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', response(502, 'Bad gateway'))
    expect((await o.search({ ...episode, hash: null })).notice).toEqual({ kind: 'offline' })
    rig.http.on('/subtitles', response(200, '<html>'))
    expect((await o.search({ name: 'Other.Film.2001.mkv', languages: ['en'] })).notice).toEqual({
      kind: 'offline',
    })
  })

  it('drops X-User-Agent for good when a request only goes through without it', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', new TypeError('Failed to fetch'), page(hit(1)), page(hit(2)))
    expect(ids((await o.search({ ...episode, hash: null })).hits)).toEqual(['1'])
    expect(rig.http.requests[0]!.headers?.['X-User-Agent']).toBe('Reelbox v1.0.0')
    expect(rig.http.requests[1]!.headers?.['X-User-Agent']).toBeUndefined()
    await o.search({ name: 'Other.Film.2001.mkv', languages: ['en'] })
    expect(rig.http.requests[2]!.headers?.['X-User-Agent']).toBeUndefined()
  })

  it('lets the name have its turn when the service turns the hash query down', async () => {
    const o = rig.online()
    rig.http.on('moviehash=', json(400, { errors: ['Not enough parameters'], status: 400 }))
    rig.http.on('query=', page(hit(7)))
    const result = await o.search(episode)
    expect(ids(result.hits)).toEqual(['7'])
    expect(result.notice).toBeNull()
  })

  it('treats a refused query with nothing else to try as no results, not unreachable', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', json(400, { errors: ['Query is too short'], status: 400 }))
    const result = await o.search({ name: 'Movie title.mkv', languages: ['en'] })
    expect(result.hits).toEqual([])
    expect(result.notice).toBeNull()
  })

  it('never sends a title under three letters', async () => {
    const o = rig.online()
    const result = await o.search({ name: 'Up.mkv', languages: ['en'] })
    expect(rig.http.requests).toEqual([])
    expect(result.notice).toBeNull()
  })

  it('runs one search per video at a time; the second reads the first one from the cache', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', page(hit(1)))
    const [a, b] = await Promise.all([o.search(episode), o.search(episode)])
    expect(rig.http.requests).toHaveLength(1)
    expect(ids(a.hits)).toEqual(['1'])
    expect(b.fromCache).toBe(true)
  })
})

describe('ranking', () => {
  it('drops the other films of the year a name search brings back', async () => {
    const o = rig.online()
    // OpenSubtitles matches the year as a word, so every 2026 release comes back.
    rig.http.on(
      '/subtitles',
      page(
        hit(1, { release: 'Supergirl.2026.1080P.WEB.H264-POKE', downloads: 18_485 }),
        hit(2, {
          release: 'Bethlehem.Kudumba.Unit.2026.2160p.JHS.WEB-DL.MULTi.DDP5.1.H.265-LRTX',
          downloads: 9_435,
        }),
        hit(3, { release: 'They.Will.Kill.You.2026.1080P.WEB.H264-POKE.engSDH', downloads: 3_784 }),
      ),
    )
    const result = await o.search({
      name: 'Bethlehem Kudumba Unit (2026) Malayalam 1080p WEB-DL.mkv',
      languages: ['en'],
    })
    expect(ids(result.hits)).toEqual(['2'])
  })

  it('lets the name run when a hash nobody has seen brings back other films', async () => {
    const o = rig.online()
    rig.http.on(
      'moviehash=',
      page(hit(1, { release: 'Supergirl.2026.1080P.WEB.H264-POKE', downloads: 18_485 })),
    )
    rig.http.on('query=', page(hit(7, { release: 'Night.Sky.S01E02.720p.WEB' })))
    expect(ids((await o.search(episode)).hits)).toEqual(['7'])
    expect(rig.http.requests).toHaveLength(2)
    // The same again comes from the cache, both queries of it, with the same answer.
    expect(ids((await o.search(episode)).hits)).toEqual(['7'])
    expect(rig.http.requests).toHaveLength(2)
  })

  it('ranks the right episode and year above a more downloaded wrong one', async () => {
    const o = rig.online()
    rig.http.on(
      '/subtitles',
      page(
        hit(1, { release: 'Night.Sky.S01E03.1080p.WEB', downloads: 5_000 }),
        hit(2, { release: 'Night.Sky.S01E02.1080p.WEB', downloads: 40 }),
        hit(3, { release: 'Night.Sky.Live.2019.1080p', downloads: 9_000 }),
      ),
    )
    expect(ids((await o.search(episode)).hits)).toEqual(['2', '3', '1'])
  })

  it('does not take a release group named like the show for the show', async () => {
    const o = rig.online()
    // The list a real search for Loki S01E04 gave, in OpenSubtitles' own order.
    rig.http.on(
      '/subtitles',
      page(
        hit(1, { release: 'Loki.S01E04.720p.WEB.H264-EXPLOIT', downloads: 69_863 }),
        hit(2, { release: 'Entourage.S1E04.DVDRip-LOKi', downloads: 10_305 }),
        hit(3, {
          release: 'Thor & Loki Blood Brothers - 01x04 - Episode 4.Unspecified',
          downloads: 5_283,
        }),
        hit(4, {
          release: 'Loki.S01E04.The.Nexus.Event.1080p.TrueHD.Atmos.7.1.AVC.HYBRID.REMUX-FraMeSToR',
          downloads: 3_278,
        }),
        hit(5, { release: 'loki ep04_engcp', downloads: 2_119 }),
        hit(6, { release: 'Thief s01e04 No Direction Home Dsr-Loki', downloads: 728 }),
      ),
    )
    const found = ids(
      (await o.search({ name: 'Loki.S01E04.1080p.WEB.mkv', languages: ['en'] })).hits,
    )
    expect(found).not.toContain('2')
    expect(found).not.toContain('6')
    expect(new Set(found.slice(0, 2))).toEqual(new Set(['1', '4']))
    expect(found.indexOf('3')).toBeGreaterThan(found.indexOf('4'))
  })

  it("lets OpenSubtitles' own filing decide which show a release is", async () => {
    const o = rig.online()
    rig.http.on(
      '/subtitles',
      page(
        filed(1, 'Loki.S01E04.720p.WEB.H264-EXPLOIT', 'Loki', { downloads: 69_863 }),
        filed(2, '1080p.DSNP.WEB-DL.DDP5.1.H.264-EVO', 'Loki', { downloads: 770_100 }),
        filed(3, 'DSRip.XviD-LOKi', 'Entourage', { downloads: 2_911 }),
        filed(4, 'Season 1 whole (AC3.DVDRip.XviD-LOKi)', 'Entourage', {
          episode: null,
          downloads: 6_124,
        }),
        filed(5, 'Project.Loki.S01E04.1080p.VMX.WEB-DL.AAC2.0.H.264', 'Loki', { downloads: 393 }),
        filed(
          6,
          'Thor & Loki Blood Brothers - 01x04 - Episode 4.Unspecified',
          'Thor & Loki: Blood Brothers',
          {
            downloads: 5_283,
          },
        ),
      ),
    )
    const found = ids(
      (await o.search({ name: 'Loki.S01E04.1080p.WEB.mkv', languages: ['en'] })).hits,
    )
    expect(found).not.toContain('3')
    expect(found).not.toContain('4')
    expect(new Set(found.slice(0, 3))).toEqual(new Set(['1', '2', '5']))
    expect(found.at(-1)).toBe('6')
  })

  it('without the filing, drops release groups and season packs', async () => {
    const o = rig.online()
    rig.http.on(
      '/subtitles',
      page(
        hit(1, { release: 'Loki.S01E04.720p.WEB.H264-EXPLOIT' }),
        hit(2, { release: 'DSRip.XviD-LOKi' }),
        hit(3, { release: 'Season 1 whole (AC3.DVDRip.XviD-LOKi)' }),
        hit(4, { release: 'Project.Loki.S01E04.1080p.VMX.WEB-DL.AAC2.0.H.264', downloads: 9_000 }),
      ),
    )
    const found = ids(
      (await o.search({ name: 'Loki.S01E04.1080p.WEB.mkv', languages: ['en'] })).hits,
    )
    expect(found).toEqual(['1', '4'])
  })

  it('keeps every result for a title in another script', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', page(hit(1, { release: 'Harbour.Notes.2026.1080p.WEB' })))
    const result = await o.search({ name: 'ഹാർബർ നോട്ട്സ് (2026).mkv', languages: ['en'] })
    expect(ids(result.hits)).toEqual(['1'])
  })
})

describe('account', () => {
  it('keeps the token and the quota, never the password', async () => {
    const o = rig.online()
    await signIn(o, 20, 17)
    const login = rig.http.last('/login')
    expect(login.url).toBe('https://api.opensubtitles.com/api/v1/login')
    expect(login.body).toContain('"password":"secret"')
    const info = rig.http.last('/infos/user')
    expect(info.url).toBe('https://vip-api.opensubtitles.com/api/v1/infos/user')
    expect(info.headers?.Authorization).toBe('Bearer tok-1')
    expect(o.status()).toEqual({ kind: 'signedIn', username: 'viewer', remaining: 17, allowed: 20 })
    expect(JSON.stringify(rig.store.get())).not.toContain('secret')
  })

  it('says so on a wrong password and stores nothing', async () => {
    const o = rig.online()
    rig.http.on('/login', json(401, { message: 'Error, invalid username/password', status: 401 }))
    expect(await o.signIn('viewer', 'nope')).toEqual({ kind: 'wrongPassword' })
    expect(o.status()).toEqual({ kind: 'signedOut' })
  })

  it('spaces sign ins a second apart', async () => {
    const o = rig.online()
    rig.http.on('/login', json(401, {}), json(401, {}))
    await o.signIn('a', 'b')
    await o.signIn('a', 'c')
    expect(rig.sleeps.some((ms) => ms >= 800)).toBe(true)
  })

  it('tells OpenSubtitles on sign out and forgets the account', async () => {
    const o = rig.online()
    await signIn(o)
    rig.http.on('/logout', json(200, { message: 'token successfully destroyed', status: 200 }))
    await o.signOut()
    expect(rig.http.requests.at(-1)!.method).toBe('DELETE')
    expect(o.status()).toEqual({ kind: 'signedOut' })
  })
})

describe('download', () => {
  it('uses a download, decodes the code page, and answers a second one from the cache', async () => {
    const o = rig.online()
    await signIn(o, 20, 10)
    rig.http.on(
      '/download',
      json(200, {
        link: 'https://dl.opensubtitles.org/x/4242.srt',
        file_name: 'Night.Sky.S01E02.srt',
        requests: 11,
        remaining: 9,
        reset_time_utc: '2027-01-15T10:00:00.000Z',
      }),
    )
    // Saved by its uploader in the Windows code page: "ñ" is one byte, 0xF1.
    const latin = new TextEncoder().encode('1\n00:00:01,000 --> 00:00:02,000\nMa?ana\n')
    latin[latin.indexOf('?'.charCodeAt(0))] = 0xf1
    rig.http.on('dl.opensubtitles.org', response(200, latin))
    const done = await o.download(osHit)
    expect(done.kind).toBe('done')
    if (done.kind !== 'done') return

    const ask = rig.http.last('/download')
    expect(ask.method).toBe('POST')
    expect(ask.url).toBe('https://vip-api.opensubtitles.com/api/v1/download')
    expect(ask.headers?.Authorization).toBe('Bearer tok-1')
    expect(ask.body).toContain('"file_id":4242')
    // The file itself goes out with no headers, so no preflight.
    expect(rig.http.last('dl.opensubtitles.org').headers).toBeUndefined()
    expect(done.subtitle.extension).toBe('srt')
    expect(done.subtitle.text).toContain('Mañana')
    expect(done.label).toBe('Spanish · OpenSubtitles')
    expect(done.fromCache).toBe(false)
    expect(rig.store.get().remaining).toBe(9)

    const before = rig.http.requests.length
    const again = await o.download(osHit)
    expect(again).toMatchObject({ kind: 'done', fromCache: true })
    expect(rig.http.requests).toHaveLength(before)
  })

  it('expires a downloaded file after six months at most', async () => {
    const o = rig.online()
    await signIn(o)
    rig.http.on(
      '/download',
      json(200, { link: 'https://dl.opensubtitles.org/a', file_name: 'a.srt', remaining: 19 }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, srt))
    await o.download(osHit)
    rig.clock += MAX_TTL_MS + 1
    rig.http.on(
      '/download',
      json(200, { link: 'https://dl.opensubtitles.org/a', file_name: 'a.srt', remaining: 18 }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, srt))
    expect(await o.download(osHit)).toMatchObject({ kind: 'done', fromCache: false })
    expect(rig.http.count('/download')).toBe(2)
  })

  it('refuses a cache time limit longer than six months', () => {
    expect(() => new SubtitleCache(memoryBackend(), Date.now, MAX_TTL_MS + 1)).toThrow()
  })

  it('downloads without an account with the app key alone, keeping the free quota apart', async () => {
    const o = rig.online()
    rig.http.on(
      '/download',
      json(200, {
        link: 'https://dl.opensubtitles.org/x/4242.srt',
        file_name: 'Night.Sky.S01E02.srt',
        requests: 1,
        remaining: 99,
        message: 'Your quota will be renewed in 07 hours',
        reset_time: '07 hours',
        reset_time_utc: '2027-01-15T23:59:59.999Z',
        uk: 'app_ud_1',
      }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, srt))
    const done = await o.download(osHit)
    const ask = rig.http.last('/download')
    expect(ask.url).toBe('https://api.opensubtitles.com/api/v1/download')
    expect(ask.headers?.Authorization).toBeUndefined()
    expect(ask.headers?.['Api-Key']).toBe('test-key')
    expect(done).toMatchObject({ kind: 'done' })
    expect(rig.store.get().anonRemaining).toBe(99)
    expect(rig.store.get().anonResetAt).toBe(Date.parse('2027-01-15T23:59:59.999Z'))
    expect(rig.store.get().remaining).toBe(-1)
    expect(o.status()).toEqual({ kind: 'signedOut' })
  })

  it('says when the free quota renews, offers a sign in, and sends nothing more', async () => {
    const o = rig.online()
    rig.http.on(
      '/download',
      json(429, {
        requests: 101,
        remaining: 0,
        message: 'You have downloaded your allowed 100 subtitles for 24h',
        reset_time_utc: '2027-01-15T23:59:59.999Z',
      }),
    )
    const reset = Date.parse('2027-01-15T23:59:59.999Z')
    expect(await o.download(osHit)).toEqual({
      kind: 'failed',
      notice: { kind: 'freeQuotaUsed', resetAt: reset },
    })
    expect(o.status()).toEqual({ kind: 'freeQuotaUsed', resetAt: reset })

    const before = rig.http.requests.length
    const other = { ...osHit, id: '5555' }
    expect(await o.download(other)).toEqual({
      kind: 'failed',
      notice: { kind: 'freeQuotaUsed', resetAt: reset },
    })
    expect(rig.http.requests).toHaveLength(before)
    expect(o.blockedFor(other, false)).toEqual({ kind: 'freeQuotaUsed', resetAt: reset })
    expect(o.blockedFor(other, true)).toBeNull()
    rig.http.on('/subtitles', page(hit(1)))
    expect((await o.search(episode)).notice).toEqual({ kind: 'freeQuotaUsed', resetAt: reset })
    expect(noticeText(words, { kind: 'freeQuotaUsed', resetAt: null })).toContain('Sign in')

    // Signing in brings the person's own quota, whatever the free one says.
    await signIn(o)
    expect(o.blockedFor(other, false)).toBeNull()
    rig.http.on(
      '/download',
      json(200, { link: 'https://dl.opensubtitles.org/c', file_name: 'c.srt', remaining: 19 }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, srt))
    expect(await o.download(other)).toMatchObject({ kind: 'done' })
    expect(rig.http.last('/download').headers?.Authorization).toBe('Bearer tok-1')

    // Signed out again after the reset: the free downloads are back.
    rig.http.on('/logout', json(200, {}))
    await o.signOut()
    rig.clock = reset + 1
    expect(o.status()).toEqual({ kind: 'signedOut' })
    expect(o.blockedFor({ ...osHit, id: '6666' }, false)).toBeNull()
  })

  it('counts 406 with nothing remaining against the free quota, a day when no time is given', async () => {
    const o = rig.online()
    rig.http.on(
      '/download',
      json(406, {
        message: 'You have downloaded your allowed 100 subtitles for 24h',
        remaining: 0,
      }),
    )
    expect(await o.download(osHit)).toEqual({
      kind: 'failed',
      notice: { kind: 'freeQuotaUsed', resetAt: rig.clock + DAY_MS },
    })
    rig.clock += DAY_MS + 1
    rig.http.on(
      '/download',
      json(200, { link: 'https://dl.opensubtitles.org/b', file_name: 'b.srt', remaining: 0 }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, srt))
    expect(await o.download(osHit)).toMatchObject({ kind: 'done' })
    expect(await o.download({ ...osHit, id: '5555' })).toMatchObject({
      kind: 'failed',
      notice: { kind: 'freeQuotaUsed' },
    })
    expect(rig.http.count('/download')).toBe(2)
  })

  it('backs off on a 429 without the quota and tries once more', async () => {
    const o = rig.online()
    rig.http.on(
      '/download',
      json(429, {}, { 'Retry-After': '2' }),
      json(200, { link: 'https://dl.opensubtitles.org/a', file_name: 'a.srt', remaining: 98 }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, srt))
    expect(await o.download(osHit)).toMatchObject({ kind: 'done' })
    expect(rig.sleeps.filter((ms) => ms >= 1000)).toEqual([2000])
    expect(rig.store.get().anonRemaining).toBe(98)
  })

  it('asks for a sign in when a download without an account gets a 401', async () => {
    const o = rig.online()
    rig.http.on('/download', json(401, { message: 'You must be logged in' }))
    expect(await o.download(osHit)).toEqual({
      kind: 'failed',
      notice: { kind: 'signInToDownload' },
    })
    expect(rig.store.get().expired).toBe(false)
  })

  it('blocks downloads until the reset time when a 429 carries the quota', async () => {
    const o = rig.online()
    await signIn(o)
    rig.http.on(
      '/download',
      json(429, {
        requests: 21,
        remaining: 0,
        message: 'You have downloaded your allowed 20 subtitles for 24h',
        reset_time: '7 hours',
        reset_time_utc: '2027-01-15T10:00:00.000Z',
      }),
    )
    const reset = Date.parse('2027-01-15T10:00:00Z')
    expect(await o.download(osHit)).toEqual({
      kind: 'failed',
      notice: { kind: 'quotaUsed', resetAt: reset },
    })
    expect(o.status()).toEqual({ kind: 'quotaUsed', username: 'viewer', resetAt: reset })
    const before = rig.http.requests.length
    expect(await o.download(osHit)).toEqual({
      kind: 'failed',
      notice: { kind: 'quotaUsed', resetAt: reset },
    })
    expect(rig.http.requests).toHaveLength(before)
    rig.http.on('/subtitles', page(hit(1)))
    expect((await o.search(episode)).notice).toEqual({ kind: 'quotaUsed', resetAt: reset })
  })

  it('takes 406 as the quota too', async () => {
    const o = rig.online()
    await signIn(o)
    rig.http.on(
      '/download',
      json(406, { message: 'You have downloaded your allowed 20 subtitles for 24h', remaining: 0 }),
    )
    expect(await o.download(osHit)).toMatchObject({ kind: 'failed', notice: { kind: 'quotaUsed' } })
  })

  it('blocks the next download after remaining zero until the reset passes', async () => {
    const o = rig.online()
    await signIn(o, 20, 1)
    rig.http.on(
      '/download',
      json(200, {
        link: 'https://dl.opensubtitles.org/b',
        file_name: 'b.srt',
        remaining: 0,
        reset_time_utc: '2027-01-15T10:00:00.000Z',
      }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, srt))
    expect(await o.download(osHit)).toMatchObject({ kind: 'done' })
    rig.clock = Date.parse('2027-01-15T09:00:00Z')
    const other = { ...osHit, id: '5555' }
    expect(await o.download(other)).toMatchObject({ kind: 'failed', notice: { kind: 'quotaUsed' } })
    expect(rig.http.count('/download')).toBe(1)

    rig.clock = Date.parse('2027-01-15T10:00:01Z')
    expect(o.status()).toEqual({ kind: 'signedIn', username: 'viewer', remaining: 20, allowed: 20 })
    rig.http.on(
      '/download',
      json(200, { link: 'https://dl.opensubtitles.org/c', file_name: 'c.srt', remaining: 19 }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, srt))
    expect(await o.download(other)).toMatchObject({ kind: 'done' })
  })

  it('signs the person out on an expired token and carries on without an account', async () => {
    const o = rig.online()
    await signIn(o)
    rig.http.on('/download', json(401, { message: 'invalid token' }))
    expect(await o.download(osHit)).toEqual({ kind: 'failed', notice: { kind: 'signInExpired' } })
    expect(o.status()).toEqual({ kind: 'expired', username: 'viewer' })
    rig.http.on(
      '/download',
      json(200, { link: 'https://dl.opensubtitles.org/a', file_name: 'a.srt', remaining: 99 }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, srt))
    expect(await o.download(osHit)).toMatchObject({ kind: 'done' })
    expect(rig.http.last('/download').headers?.Authorization).toBeUndefined()
    rig.http.on('/subtitles', page(hit(1)))
    expect((await o.search(episode)).notice).toEqual({ kind: 'signInExpired' })
    expect(o.blockedFor({ ...osHit, id: '5555' }, false)).toBeNull()
  })

  it('says unreadable for a file with no subtitle in it', async () => {
    const o = rig.online()
    rig.http.on(
      '/download',
      json(200, { link: 'https://dl.opensubtitles.org/a', file_name: 'a.srt', remaining: 99 }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, '   \n'))
    expect(await o.download(osHit)).toEqual({ kind: 'failed', notice: { kind: 'unreadable' } })
  })
})

describe('a refused key', () => {
  it('turns the feature off, keeps the cache, and comes back with a new key', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', page(hit(1)))
    await o.search(episode)

    rig.http.on('/subtitles', json(403, { message: 'You cannot consume this service' }))
    const refused = await o.search({
      ...episode,
      hash: '0000000000000001',
      name: 'Other.Film.2001.mkv',
    })
    expect(refused.notice).toEqual({ kind: 'unavailable' })
    expect(o.status()).toEqual({ kind: 'unavailable' })
    expect(JSON.stringify(rig.store.get())).not.toContain('test-key')

    const before = rig.http.requests.length
    expect(
      (await o.search({ ...episode, hash: '0000000000000002', name: 'Third.mkv' })).notice,
    ).toEqual({
      kind: 'unavailable',
    })
    expect(await o.download(osHit)).toEqual({ kind: 'failed', notice: { kind: 'unavailable' } })
    expect(await o.signIn('a', 'b')).toEqual({ kind: 'failed', notice: { kind: 'unavailable' } })
    expect(rig.http.requests).toHaveLength(before)

    const updated = rig.online('new-key')
    expect(updated.status()).toEqual({ kind: 'signedOut' })
    rig.http.on('/subtitles', page(hit(3, { release: 'Fourth.1080p.WEB' })))
    expect(
      ids(
        (await updated.search({ ...episode, hash: '0000000000000004', name: 'Fourth.mkv' })).hits,
      ),
    ).toEqual(['3'])
    expect(rig.http.requests.at(-1)!.headers?.['Api-Key']).toBe('new-key')
  })

  it('is tried again a day later', async () => {
    const o = rig.online()
    rig.http.on('/subtitles', json(403, {}))
    await o.search(episode)
    rig.clock += REFUSED_RETRY_MS + 1
    expect(o.status()).toEqual({ kind: 'signedOut' })
  })
})

describe('SubDL', () => {
  it('is searched when OpenSubtitles has nothing, and its zip gives the right episode', async () => {
    const o = rig.online()
    o.setSubdlKey('  subdl-key ')
    rig.http.on('api.opensubtitles.com', page(), page())
    rig.http.on(
      'api.subdl.com',
      json(200, {
        status: true,
        results: [],
        subtitles: [
          {
            release_name: 'Night.Sky.S01',
            name: 'Night.Sky.S01.zip',
            lang: 'spanish',
            language: 'ES',
            url: '/subtitle/123-456.zip',
            hi: false,
          },
        ],
      }),
    )
    const result = await o.search(episode)
    const search = rig.http.last('api.subdl.com').url
    expect(search).toContain('api_key=subdl-key')
    expect(search).toContain('film_name=Night+Sky')
    expect(search).toContain('languages=ES%2CEN')
    expect(search).toContain('type=tv')
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0]).toMatchObject({ provider: 'Subdl', language: 'es' })
    expect(result.notice).toBeNull()

    rig.http.on(
      'dl.subdl.com',
      response(200, await zip(['Night.Sky.S01E01.srt', 'one'], ['Night.Sky.S01E02.srt', srt])),
    )
    const done = await o.download(result.hits[0]!, episode)
    expect(rig.http.requests.at(-1)!.url).toBe('https://dl.subdl.com/subtitle/123-456.zip')
    expect(done).toMatchObject({ kind: 'done', subtitle: { extension: 'srt', text: srt } })
  })

  it('says a refused key is refused and does not try it again', async () => {
    const o = rig.online()
    o.setSubdlKey('bad')
    rig.http.on('api.opensubtitles.com', page(), page())
    rig.http.on('api.subdl.com', json(200, { status: false, error: 'Invalid API key' }))
    expect((await o.search(episode)).notice).toEqual({ kind: 'subdlKeyRefused' })
    expect(rig.store.get().subdlRefused).toBe(true)
  })

  it('stands in when the OpenSubtitles key is refused', async () => {
    const o = rig.online()
    o.setSubdlKey('k')
    rig.http.on('api.opensubtitles.com', json(403, {}))
    rig.http.on(
      'api.subdl.com',
      json(200, {
        status: true,
        subtitles: [{ release_name: 'R', name: 'R.zip', language: 'EN', url: '/subtitle/1.zip' }],
      }),
    )
    const result = await o.search(episode)
    expect(result.hits).toHaveLength(1)
    expect(result.notice).toEqual({ kind: 'unavailable' })
  })

  it('reads a language name when SubDL gives no code', async () => {
    const o = rig.online()
    o.setSubdlKey('k')
    rig.http.on('api.opensubtitles.com', page(), page())
    rig.http.on(
      'api.subdl.com',
      json(200, {
        status: true,
        subtitles: [
          { release_name: 'R', name: 'R.zip', lang: 'french', language: '', url: '/x.zip' },
        ],
      }),
    )
    expect((await o.search(episode)).hits[0]!.language).toBe('fr')
  })
})

describe('cache housekeeping', () => {
  it('empties everything on purge, and the next search asks again', async () => {
    const o = rig.online()
    await signIn(o)
    rig.http.on('/subtitles', page(hit(1)))
    await o.search(episode)
    rig.http.on(
      '/download',
      json(200, { link: 'https://dl.opensubtitles.org/a', file_name: 'a.srt', remaining: 19 }),
    )
    rig.http.on('dl.opensubtitles.org', response(200, srt))
    await o.download(osHit)
    expect(await o.cache.bytes()).toBeGreaterThan(0)
    await o.purge()
    expect(await o.cache.bytes()).toBe(0)
    expect(o.status().kind).toBe('signedIn')
    rig.http.on('/subtitles', page(hit(1)))
    expect((await o.search(episode)).fromCache).toBe(false)
  })

  it('prunes only what has gone stale', async () => {
    await rig.cache.putSearch('old', [])
    rig.clock += SEARCH_TTL_MS + 1
    await rig.cache.putSearch('new', [])
    await rig.cache.prune()
    expect(await rig.cache.search('old')).toBeNull()
    expect(await rig.cache.search('new')).toEqual([])
  })
})
