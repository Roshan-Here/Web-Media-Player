// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { parseMediaName } from './media-name.js'
import type { SubtitleFormat, SubtitleText } from './models.js'
import { isZip, zipEntries } from './zip.js'

/*
 * A downloaded subtitle turned into text in a format the player reads (TMPlayer's
 * SubtitleText.kt). Online files arrive in whatever code page their uploader saved them in, and
 * SubDL's arrive zipped, sometimes with a whole season inside.
 */

/** The text formats the player reads as they stand. */
export const FORMATS: ReadonlySet<string> = new Set<SubtitleFormat>(['srt', 'ass', 'ssa', 'vtt'])

/** The largest subtitle worth keeping: a feature film's are tens of kilobytes. */
export const MAX_SUBTITLE_BYTES = 4 * 1024 * 1024

const utf8 = new TextDecoder('utf-8', { fatal: true })
const latin1 = new TextDecoder('latin1')

/**
 * Where windows-1252 differs from Latin-1: 0x80 to 0x9F hold curly quotes, dashes and the euro
 * sign rather than control codes. Browsers decode `windows-1252` this way already, but Node (and
 * so the tests) reads it as plain Latin-1, so the table is applied by hand everywhere.
 */
const CP1252_HIGH =
  '\u20AC\u0081\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u008D\u017D\u008F' +
  '\u0090\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u009D\u017E\u0178'

function windows1252(bytes: Uint8Array): string {
  return latin1
    .decode(bytes)
    .replace(/[\u0080-\u009f]/g, (c) => CP1252_HIGH[c.charCodeAt(0) - 0x80] ?? c)
}

/** UTF-8 when the bytes are valid UTF-8, and the Western Windows code page when they are not. */
export function decodeSubtitle(bytes: Uint8Array): string {
  let text: string
  try {
    text = utf8.decode(bytes)
  } catch {
    text = windows1252(bytes)
  }
  return text.replace(/^\uFEFF+/, '')
}

function extensionPart(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase()
}

/** The extension of `fileName` in lower case, or srt when it names no format the player reads. */
export function extensionOf(fileName: string): SubtitleFormat {
  const ext = extensionPart(fileName)
  return FORMATS.has(ext) ? (ext as SubtitleFormat) : 'srt'
}

/**
 * The subtitle inside a zip: the one whose name has the wanted season and episode when those
 * are known, else the first. Null when there is no subtitle in a format the player reads.
 */
export async function fromArchive(
  bytes: Uint8Array,
  season: number | null = null,
  episode: number | null = null,
): Promise<SubtitleText | null> {
  const found = zipEntries(bytes, MAX_SUBTITLE_BYTES).filter((e) =>
    FORMATS.has(extensionPart(e.name)),
  )
  if (found.length === 0) return null
  const pick =
    (episode !== null
      ? found.find((e) => {
          const parsed = parseMediaName(e.name)
          return (
            parsed.episode === episode &&
            (season === null || parsed.season === null || parsed.season === season)
          )
        })
      : undefined) ?? found[0]!
  return { extension: extensionOf(pick.name), text: decodeSubtitle(await pick.read()) }
}

/** A downloaded body, zipped or not, as subtitle text; null when it holds none. */
export async function subtitleFromBytes(
  bytes: Uint8Array,
  fileName: string,
  season: number | null = null,
  episode: number | null = null,
): Promise<SubtitleText | null> {
  if (bytes.length > MAX_SUBTITLE_BYTES) return null
  if (isZip(bytes)) {
    try {
      return await fromArchive(bytes, season, episode)
    } catch {
      return null
    }
  }
  const text = decodeSubtitle(bytes)
  return text.trim() ? { extension: extensionOf(fileName), text } : null
}
