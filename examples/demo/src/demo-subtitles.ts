import {
  createOnlineSubtitles,
  makeHit,
  type OnlineSubtitleService,
  type SubtitleHit,
} from '@roshan-here/web-media-player'

/**
 * The demo's subtitle service. With an OpenSubtitles key in `VITE_OPENSUBTITLES_KEY` it is the
 * real one; without, a stand-in that "finds" the demo film's own subtitle files, which also
 * shows how to plug in a source of your own: four methods, `OnlineSubtitleService`.
 */
const FILES: Record<string, { url: string; extension: 'srt' | 'vtt' }> = {
  'demo-en': { url: '/media/en.srt', extension: 'srt' },
  'demo-es': { url: '/media/es.srt', extension: 'srt' },
}

const HITS: SubtitleHit[] = [
  makeHit({
    provider: 'Demo',
    id: 'demo-en',
    language: 'en',
    release: 'Northern.Lights.2026.1080p.WEB',
    downloads: 1200,
    hashMatch: true,
  }),
  makeHit({
    provider: 'Demo',
    id: 'demo-es',
    language: 'es',
    release: 'Northern.Lights.2026.Spanish',
    downloads: 310,
  }),
]

const standIn: OnlineSubtitleService = {
  async search(target) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    const hits = target.name.toLowerCase().includes('northern') ? HITS : []
    return { hits, notice: null, fromCache: false }
  },
  async download(hit) {
    const file = FILES[hit.id]
    if (!file) return { kind: 'failed', notice: { kind: 'unavailable' } }
    const text = await (await fetch(file.url)).text()
    return {
      kind: 'done',
      subtitle: { extension: file.extension, text },
      label: `${hit.language.toUpperCase()} · Demo`,
      fromCache: false,
    }
  },
  cachedIds: async () => new Set(),
  blockedFor: () => null,
}

const key = import.meta.env.VITE_OPENSUBTITLES_KEY as string | undefined

export const subtitleService: OnlineSubtitleService = key
  ? createOnlineSubtitles({ apiKey: key, appName: 'Web-Media-Player demo', appVersion: '0.2.0' })
  : standIn
