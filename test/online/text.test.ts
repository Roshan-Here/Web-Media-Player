import { describe, expect, it } from 'vitest'
import { iso1, languagesFor } from '../../src/online/languages.js'
import { decodeSubtitle, extensionOf, subtitleFromBytes } from '../../src/online/text.js'
import { zip } from './test-helpers.js'

const bytes = (s: string) => new TextEncoder().encode(s)

describe('decoding', () => {
  it('reads UTF-8, and the Windows code page when the bytes are not UTF-8', () => {
    expect(decodeSubtitle(bytes('\uFEFFMañana'))).toBe('Mañana')
    // "Mañana" and a curly quote saved in windows-1252.
    const western = new Uint8Array([0x4d, 0x61, 0xf1, 0x61, 0x6e, 0x61, 0x92])
    expect(decodeSubtitle(western)).toBe('Mañana’')
  })

  it('takes the format from the file name, SubRip when it names none', () => {
    expect(extensionOf('a.ASS')).toBe('ass')
    expect(extensionOf('a.vtt')).toBe('vtt')
    expect(extensionOf('a.sub')).toBe('srt')
    expect(extensionOf('noextension')).toBe('srt')
  })

  it('refuses an empty file and a zip with no subtitle in it', async () => {
    expect(await subtitleFromBytes(bytes('  \n'), 'a.srt')).toBeNull()
    expect(await subtitleFromBytes(await zip(['readme.txt', 'hi']), 'a.zip')).toBeNull()
    expect(await subtitleFromBytes(bytes('PK not really a zip'), 'a.zip')).toBeNull()
  })

  it("picks the episode's file from a season zip, else the first", async () => {
    const season = await zip(
      ['Show/', ''],
      ['Show/Show.S01E01.srt', 'one'],
      ['Show/Show.S01E02.ass', 'two'],
    )
    expect(await subtitleFromBytes(season, 'x.zip', 1, 2)).toEqual({
      extension: 'ass',
      text: 'two',
    })
    expect(await subtitleFromBytes(season, 'x.zip', 1, 7)).toEqual({
      extension: 'srt',
      text: 'one',
    })
    expect(await subtitleFromBytes(season, 'x.zip')).toEqual({ extension: 'srt', text: 'one' })
  })
})

describe('languages', () => {
  it('come as two letter codes, Brazilian Portuguese kept apart', () => {
    expect(iso1('eng')).toBe('en')
    expect(iso1('ger')).toBe('de')
    expect(iso1('pt-BR')).toBe('pt-br')
    expect(iso1('pt_BR')).toBe('pt-br')
    expect(iso1('ml')).toBe('ml')
    expect(iso1('und')).toBeNull()
    expect(iso1('')).toBeNull()
  })

  it("are the show's last choice, then the browser's, then English", () => {
    expect(languagesFor('mal', [])).toEqual(['ml', 'en'])
    expect(languagesFor(null, ['es-MX', 'es', 'fr'])).toEqual(['es', 'en'])
    expect(languagesFor('fr', ['de-DE', 'en-US'])).toEqual(['fr', 'de', 'en'])
  })
})
