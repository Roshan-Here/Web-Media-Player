import { describe, expect, it } from 'vitest'
import type { MediaLike } from '../src/lib/engine.js'
import { PlayWhenReady, startPlayback } from '../src/lib/autoplay.js'

const notAllowed = () =>
  Object.assign(new Error('play() needs a user gesture'), { name: 'NotAllowedError' })

function media(rules: { soundAllowed: boolean; mutedAllowed: boolean }, muted = false) {
  const m = {
    muted,
    paused: true,
    async play() {
      if (m.muted ? !rules.mutedAllowed : !rules.soundAllowed) throw notAllowed()
      m.paused = false
    },
  }
  return m as unknown as MediaLike & { muted: boolean; paused: boolean }
}

describe('startPlayback', () => {
  it('plays with sound when the browser allows it', async () => {
    const m = media({ soundAllowed: true, mutedAllowed: true })
    expect(await startPlayback(m)).toBe('playing')
    expect(m.muted).toBe(false)
  })

  it('falls back to muted playback when sound is not allowed yet', async () => {
    const m = media({ soundAllowed: false, mutedAllowed: true })
    expect(await startPlayback(m)).toBe('muted')
    expect(m.muted).toBe(true)
    expect(m.paused).toBe(false)
  })

  it('leaves things as they were when nothing may play', async () => {
    const m = media({ soundAllowed: false, mutedAllowed: false })
    expect(await startPlayback(m)).toBe('blocked')
    expect(m.muted).toBe(false)
  })

  it('reports plain playing for someone who had muted it themselves', async () => {
    const m = media({ soundAllowed: false, mutedAllowed: true }, true)
    expect(await startPlayback(m)).toBe('playing')
  })

  it('reports an interrupted start without muting', async () => {
    const m = {
      muted: false,
      play: async () => {
        throw Object.assign(new Error('The play() request was interrupted'), { name: 'AbortError' })
      },
    } as unknown as MediaLike
    expect(await startPlayback(m)).toBe('interrupted')
    expect(m.muted).toBe(false)
  })
})

/** A media element whose play() fails with AbortError the first `interruptions` times. */
class FakeMedia extends EventTarget {
  muted = false
  paused = true
  readyState = 0
  calls = 0
  constructor(private interruptions: number) {
    super()
  }
  async play() {
    this.calls++
    if (this.interruptions-- > 0)
      throw Object.assign(new Error('interrupted by a seek'), { name: 'AbortError' })
    this.paused = false
  }
  fire(type: string) {
    this.dispatchEvent(new Event(type))
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('PlayWhenReady', () => {
  it('starts at the first frame', async () => {
    const m = new FakeMedia(0)
    const results: string[] = []
    new PlayWhenReady(m as unknown as MediaLike, { onStarted: (r) => results.push(r) })
    expect(m.calls).toBe(0)
    m.fire('loadeddata')
    await settle()
    expect(results).toEqual(['playing'])
    expect(m.paused).toBe(false)
  })

  it('starts at once when the media was ready before anyone listened', async () => {
    const m = new FakeMedia(0)
    m.readyState = 4
    const results: string[] = []
    new PlayWhenReady(m as unknown as MediaLike, { onStarted: (r) => results.push(r) })
    await settle()
    expect(results).toEqual(['playing'])
  })

  it('tries again after a start was interrupted by a seek', async () => {
    const m = new FakeMedia(1)
    const results: string[] = []
    new PlayWhenReady(m as unknown as MediaLike, { onStarted: (r) => results.push(r) })
    m.fire('loadeddata')
    await settle()
    expect(results).toEqual([])
    expect(m.paused).toBe(true)
    m.fire('seeked')
    await settle()
    expect(results).toEqual(['playing'])
    expect(m.calls).toBe(2)
  })

  it('finishes when the media starts playing by itself', async () => {
    const m = new FakeMedia(5)
    const results: string[] = []
    new PlayWhenReady(m as unknown as MediaLike, { onStarted: (r) => results.push(r) })
    m.paused = false
    m.fire('playing')
    await settle()
    expect(results).toEqual(['playing'])
    expect(m.calls).toBe(0)
  })

  it('gives up after a run of failures', async () => {
    const m = new FakeMedia(100)
    const results: string[] = []
    new PlayWhenReady(m as unknown as MediaLike, {
      onStarted: (r) => results.push(r),
      maxAttempts: 3,
    })
    for (let i = 0; i < 5; i++) {
      m.fire('canplay')
      await settle()
    }
    expect(results).toEqual(['blocked'])
    expect(m.calls).toBe(3)
  })

  it('does nothing more once cancelled', async () => {
    const m = new FakeMedia(0)
    const results: string[] = []
    const intent = new PlayWhenReady(m as unknown as MediaLike, {
      onStarted: (r) => results.push(r),
    })
    intent.cancel()
    m.fire('loadeddata')
    await settle()
    expect(results).toEqual([])
    expect(m.calls).toBe(0)
  })
})
