import { describe, expect, it, vi } from 'vitest'
import type { PreviewSource } from '../src/lib/engine.js'
import { PreviewQueue } from '../src/lib/preview-queue.js'

/** A preview source whose frames finish when the test says so. */
function controlledSource() {
  const pending: Array<{ time: number; resolve: (blob: Blob | null) => void }> = []
  const source: PreviewSource = {
    prepare: vi.fn(),
    frame: vi.fn(
      (time: number) =>
        new Promise<Blob | null>((resolve) => {
          pending.push({ time, resolve })
        }),
    ),
  }
  const finish = async (blob: Blob | null = new Blob(['x'])) => {
    pending.shift()!.resolve(blob)
    await new Promise((r) => setTimeout(r, 0))
  }
  return { source, pending, finish }
}

function queueFor(source: PreviewSource, step = 10) {
  let n = 0
  const shown: string[] = []
  const revoked: string[] = []
  const queue = new PreviewQueue(source, {
    step,
    cacheSize: 3,
    onImage: (url) => shown.push(url),
    createUrl: () => `blob:${++n}`,
    revokeUrl: (url) => revoked.push(url),
  })
  return { queue, shown, revoked }
}

describe('PreviewQueue', () => {
  it('makes one still at a time and then the latest one asked for', async () => {
    const { source, pending, finish } = controlledSource()
    const { queue, shown } = queueFor(source)
    queue.want(5)
    queue.want(15)
    queue.want(25)
    queue.want(95)
    expect(source.frame).toHaveBeenCalledTimes(1)
    expect(pending[0]!.time).toBe(5)
    await finish()
    // The ones swept past (15, 25) are skipped.
    expect(source.frame).toHaveBeenCalledTimes(2)
    expect(pending[0]!.time).toBe(95)
    await finish()
    expect(shown).toEqual(['blob:1', 'blob:2'])
  })

  it('answers a slot it already has straight away', async () => {
    const { source, finish } = controlledSource()
    const { queue, shown } = queueFor(source)
    queue.want(12)
    await finish()
    queue.want(18)
    expect(source.frame).toHaveBeenCalledTimes(1)
    expect(shown).toEqual(['blob:1', 'blob:1'])
  })

  it('leaves a slot that could not be made alone for a while, then tries it again', async () => {
    const { source, finish } = controlledSource()
    let now = 0
    const shown: string[] = []
    const queue = new PreviewQueue(source, {
      step: 10,
      onImage: (url) => shown.push(url),
      createUrl: () => 'blob:1',
      revokeUrl: () => undefined,
      retryAfterMs: 5000,
      now: () => now,
    })
    queue.want(3)
    await finish(null)
    queue.want(4)
    expect(source.frame).toHaveBeenCalledTimes(1)
    expect(shown).toEqual([])
    now = 6000
    queue.want(5)
    expect(source.frame).toHaveBeenCalledTimes(2)
    await finish()
    expect(shown).toEqual(['blob:1'])
  })

  it('stops when the pointer leaves', async () => {
    const { source, finish } = controlledSource()
    const { queue, shown } = queueFor(source)
    queue.want(3)
    queue.want(null)
    await finish()
    expect(shown).toEqual([])
    expect(source.frame).toHaveBeenCalledTimes(1)
  })

  it('keeps a bounded cache and lets go of what it drops', async () => {
    const { source, finish } = controlledSource()
    const { queue, revoked } = queueFor(source)
    for (const t of [1, 11, 21, 31]) {
      queue.want(t)
      await finish()
    }
    expect(revoked).toEqual(['blob:1'])
    queue.dispose()
    expect(revoked.sort()).toEqual(['blob:1', 'blob:2', 'blob:3', 'blob:4'])
  })

  it('ignores a still that arrives after it was disposed', async () => {
    const { source, finish } = controlledSource()
    const { queue, shown } = queueFor(source)
    queue.want(3)
    queue.dispose()
    await finish()
    expect(shown).toEqual([])
  })
})
