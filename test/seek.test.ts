import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SeekController } from '../src/lib/seek.js'

function fakeMedia(duration = 100) {
  const media = {
    time: 10,
    seeks: [] as number[],
    currentTime: () => media.time,
    duration: () => duration,
    seek: (t: number) => {
      media.seeks.push(t)
    },
  }
  return media
}

describe('SeekController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('merges a burst of relative steps into one seek, counted from the pending target', () => {
    const media = fakeMedia()
    const seek = new SeekController(media)
    for (let i = 0; i < 5; i++) seek.seekBy(10)
    expect(seek.position()).toBe(60)
    expect(media.seeks).toEqual([])
    vi.advanceTimersByTime(200)
    expect(media.seeks).toEqual([60])
  })

  it('sends only the last of several absolute requests', () => {
    const media = fakeMedia()
    const seek = new SeekController(media)
    seek.seekTo(80)
    seek.seekTo(20)
    seek.seekTo(45)
    vi.advanceTimersByTime(200)
    expect(media.seeks).toEqual([45])
  })

  it('applies at once when asked, without waiting', () => {
    const media = fakeMedia()
    const seek = new SeekController(media)
    seek.seekTo(33, true)
    expect(media.seeks).toEqual([33])
  })

  it('keeps reporting the target until the playhead gets there', () => {
    const media = fakeMedia()
    const onChange = vi.fn()
    const seek = new SeekController(media, { onChange })
    seek.seekTo(70, true)
    seek.observe()
    expect(seek.position()).toBe(70)
    media.time = 70.4
    seek.observe()
    expect(seek.pending).toBeNull()
    expect(seek.position()).toBe(70.4)
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('does not count arriving at an older target while a newer one settles', () => {
    const media = fakeMedia()
    const seek = new SeekController(media)
    seek.seekTo(30, true)
    seek.seekTo(90)
    media.time = 30
    seek.observe()
    expect(seek.pending).toBe(90)
    vi.advanceTimersByTime(200)
    expect(media.seeks).toEqual([30, 90])
  })

  it('stays inside the video', () => {
    const media = fakeMedia(100)
    const seek = new SeekController(media)
    seek.seekBy(-50)
    expect(seek.position()).toBe(0)
    seek.seekTo(500)
    expect(seek.position()).toBe(99.75)
  })

  it('gives up on a target the decoder never reaches', () => {
    const media = fakeMedia()
    const seek = new SeekController(media, { giveUpMs: 1000 })
    seek.seekTo(50, true)
    vi.advanceTimersByTime(1100)
    expect(seek.pending).toBeNull()
  })
})
