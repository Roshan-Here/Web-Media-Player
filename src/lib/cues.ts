// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { Cue } from 'web-buildin-decoder'

/** The subtitle file formats the player reads. */
export type SubtitleFormat = 'srt' | 'vtt' | 'ass' | 'ssa'

/*
 * Subtitle files read into timed lines of plain text, for the player's own caption line. Styling
 * is dropped rather than drawn, the same as for subtitles inside a video file: SubRip and WebVTT
 * tags, and ASS override blocks and positioning. Line breaks are kept.
 */

export type { Cue } from 'web-buildin-decoder'

/** The format a subtitle file is in, from its name or its first lines. */
export function detectFormat(text: string, name?: string | null): SubtitleFormat {
  const ext = name?.split(/[?#]/)[0]?.split('.').pop()?.toLowerCase()
  if (ext === 'srt' || ext === 'vtt' || ext === 'ass' || ext === 'ssa') return ext
  const head = text.slice(0, 2000)
  if (/^\uFEFF?WEBVTT/.test(head)) return 'vtt'
  if (/^\s*\[Script Info\]/im.test(head) || /^\s*\[Events\]/im.test(head)) return 'ass'
  return 'srt'
}

/** Reads a subtitle file of the given format; unreadable cues are skipped, never thrown. */
export function parseSubtitle(text: string, format: SubtitleFormat = detectFormat(text)): Cue[] {
  const cues = format === 'ass' || format === 'ssa' ? parseAss(text) : parseTimed(text)
  return cues.filter((c) => c.text && c.end > c.start).sort((a, b) => a.start - b.start)
}

// ---- SubRip and WebVTT ----------------------------------------------------------------------

const TIME = String.raw`(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[,.](\d{1,3}))?`
const TIMING = new RegExp(String.raw`^\s*${TIME}\s*-->\s*${TIME}`)

function seconds(h: string | undefined, m: string, s: string, frac: string | undefined): number {
  const fraction = frac ? Number(frac.padEnd(3, '0')) / 1000 : 0
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + fraction
}

/**
 * SubRip and WebVTT read the same way: a timing line, then the text up to a blank line. Files
 * that leave out the blank lines (it happens) still read, since a timing line always starts a
 * new cue; a cue number left at the end of the text before it is taken off again.
 */
function parseTimed(text: string): Cue[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const cues: Cue[] = []
  const state: { cue: { start: number; end: number; lines: string[] } | null } = { cue: null }
  const finish = () => {
    const cue = state.cue
    if (cue) cues.push({ start: cue.start, end: cue.end, text: clean(cue.lines) })
    state.cue = null
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const timing = TIMING.exec(line)
    if (timing) {
      const open = state.cue
      const last = open?.lines.at(-1)
      if (open && last !== undefined && /^\d+$/.test(last.trim()) && lines[i - 1] === last)
        open.lines.pop()
      finish()
      const [, h1, m1, s1, f1, h2, m2, s2, f2] = timing
      state.cue = {
        start: seconds(h1, m1!, s1!, f1),
        end: seconds(h2, m2!, s2!, f2),
        lines: [],
      }
      continue
    }
    if (!line.trim()) {
      finish()
      continue
    }
    // Text outside a cue (WebVTT's header, its NOTE, STYLE and REGION blocks, cue numbers and
    // identifiers) is not shown.
    state.cue?.lines.push(line)
  }
  finish()
  return cues
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&lrm;': '',
  '&rlm;': '',
  '&quot;': '"',
  '&apos;': "'",
}

function clean(lines: string[]): string {
  return lines
    .map((line) =>
      line
        .replace(/<\/?[a-z][^>]*>/gi, '')
        .replace(/<\d[\d:.]*>/g, '')
        .replace(/\{\\[^}]*\}/g, '')
        .replace(/&(amp|lt|gt|nbsp|lrm|rlm|quot|apos);/g, (m) => ENTITIES[m] ?? m)
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n')
}

// ---- ASS and SSA ----------------------------------------------------------------------------

const ASS_TIME = /^(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/

function assSeconds(value: string): number | null {
  const m = ASS_TIME.exec(value.trim())
  if (!m) return null
  // Centiseconds in ASS, but "1.5" and "1.500" are read as what they say too.
  return seconds(m[1], m[2]!, m[3]!, m[4])
}

/** The fields of a Dialogue line, as ASS and SSA name them when the file gives no Format. */
const DEFAULT_FORMAT = [
  'layer',
  'start',
  'end',
  'style',
  'name',
  'marginl',
  'marginr',
  'marginv',
  'effect',
  'text',
]

function parseAss(text: string): Cue[] {
  const cues: Cue[] = []
  let inEvents = false
  let format = DEFAULT_FORMAT
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (/^\[.*\]$/.test(line)) {
      inEvents = line.toLowerCase() === '[events]'
      continue
    }
    if (!inEvents) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const kind = line.slice(0, colon).trim().toLowerCase()
    const rest = line.slice(colon + 1)
    if (kind === 'format') {
      format = rest.split(',').map((f) => f.trim().toLowerCase())
      continue
    }
    if (kind !== 'dialogue') continue
    // The text is the last field and may hold commas of its own.
    const parts = rest.split(',')
    const fields = [...parts.slice(0, format.length - 1), parts.slice(format.length - 1).join(',')]
    const field = (name: string) => fields[format.indexOf(name)]
    const start = assSeconds(field('start') ?? '')
    const end = assSeconds(field('end') ?? '')
    const body = field('text')
    if (start === null || end === null || body === undefined) continue
    cues.push({ start, end, text: assText(body) })
  }
  return cues
}

/** An ASS line as plain text: override blocks and drawings dropped, \N kept as a line break. */
export function assText(body: string): string {
  let out = ''
  let drawing = false
  for (const piece of body.split(/(\{[^}]*\})/)) {
    if (piece.startsWith('{') && piece.endsWith('}')) {
      const mode = /\\p(\d+)/.exec(piece)
      if (mode) drawing = Number(mode[1]) > 0
      continue
    }
    if (!drawing) out += piece
  }
  return out
    .replace(/\\[Nn]/g, '\n')
    .replace(/\\h/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

// ---- lookup ---------------------------------------------------------------------------------

/** Cues in start order, for finding what is on screen at a time quickly. */
export class CueTrack {
  readonly cues: readonly Cue[]
  private readonly longest: number

  constructor(cues: readonly Cue[]) {
    this.cues = [...cues].sort((a, b) => a.start - b.start)
    this.longest = this.cues.reduce((m, c) => Math.max(m, c.end - c.start), 0)
  }

  /** Every line showing at `time` (seconds), in start order, or null when none is. */
  textAt(time: number): string | null {
    const cues = this.cues
    // The last cue that has started by now.
    let lo = 0
    let hi = cues.length - 1
    let last = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (cues[mid]!.start <= time) {
        last = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    const showing: string[] = []
    for (let i = last; i >= 0 && cues[i]!.start >= time - this.longest; i--) {
      const cue = cues[i]!
      if (cue.end > time && !showing.includes(cue.text)) showing.unshift(cue.text)
    }
    return showing.length > 0 ? showing.join('\n') : null
  }
}
