import { describe, expect, it } from 'vitest'
import { sourceFileName, sourceKey, sourceMimeType } from '../src/lib/source.js'

describe('sources', () => {
  it('keys a source by its key, its URL or its file', () => {
    expect(sourceKey({ key: 'k', url: 'https://x.test/a.mkv' })).toBe('k')
    expect(sourceKey({ url: 'https://x.test/a.mkv' })).toBe('https://x.test/a.mkv')
    const file = new File([new Uint8Array(10)], 'film.mkv', {
      type: 'video/x-matroska',
      lastModified: 5,
    })
    expect(sourceKey({ file })).toBe('file:film.mkv:10:5')
  })

  it('reads the file name and type from the file or the URL', () => {
    expect(sourceFileName({ url: 'https://x.test/videos/My%20Film.x265.mkv?sig=1' })).toBe(
      'My Film.x265.mkv',
    )
    const file = new File([], 'clip.webm', { type: 'video/webm' })
    expect(sourceFileName({ file })).toBe('clip.webm')
    expect(sourceMimeType({ file })).toBe('video/webm')
    expect(sourceFileName({ url: 'x', fileName: 'given.mp4' })).toBe('given.mp4')
  })
})
