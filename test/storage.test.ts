import { afterEach, describe, expect, it } from 'vitest'
import { readPrefs, writePrefs } from '../src/lib/prefs.js'
import { configureStorage } from '../src/lib/storage.js'
import { subtitleDelays, subtitleStyle } from '../src/lib/subtitle-style.js'

function memoryStore() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('remembered settings', () => {
  afterEach(() => configureStorage({ storage: false, prefix: 'web-media-player:' }))

  it('keeps preferences, style and timing under the prefix', () => {
    const store = memoryStore()
    configureStorage({ storage: store, prefix: 'test:' })
    writePrefs({ volume: 0.4, decoder: 'browser' })
    subtitleStyle.set({ size: 'large' })
    subtitleDelays.set('video-1', 0.5)
    expect([...store.data.keys()].sort()).toEqual([
      'test:prefs-v1',
      'test:subtitle-delays-v1',
      'test:subtitle-style-v1',
    ])
    configureStorage({ storage: store })
    expect(readPrefs().volume).toBe(0.4)
    expect(subtitleStyle.get().size).toBe('large')
    expect(subtitleDelays.get('video-1')).toBe(0.5)
  })

  it('keeps nothing with storage off, and reads bad values as defaults', () => {
    const store = memoryStore()
    store.data.set('web-media-player:prefs-v1', '{"volume":7,"decoder":"vlc"}')
    configureStorage({ storage: store, prefix: 'web-media-player:' })
    expect(readPrefs()).toMatchObject({ volume: 1, decoder: 'builtin' })
    configureStorage({ storage: false })
    writePrefs({ muted: true })
    expect(readPrefs().muted).toBe(true)
  })
})
