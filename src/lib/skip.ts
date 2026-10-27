// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { Translate } from './labels.js'

/*
 * The stretches of a video a viewer may want to jump over (recap, intro, credits and the like),
 * and which one the playhead is in, in seconds. The player shows a "Skip intro" button while the
 * playhead is inside one.
 */

/**
 * What a stretch is. A show's intro and an anime's opening differ only in the button's words
 * ("Skip intro", "Skip opening"); they behave the same.
 */
export type SkipKind = 'recap' | 'intro' | 'opening' | 'credits' | 'ending' | 'preview'

export interface SkipSegment {
  kind: SkipKind
  /** Seconds from the start of the file. */
  start: number
  /** Seconds; null runs to the end of the file, which is how credits usually come. */
  end: number | null
}

/**
 * The button leaves a segment's last second out, so a skip that lands a moment short of the end
 * (a seek goes to a keyframe) does not offer the same skip again.
 */
export const END_MARGIN_S = 1

/** Where a skip lands: the segment's end, or the file's for one that runs to it. */
export function skipTarget(segment: SkipSegment, duration: number): number {
  return segment.end ?? duration
}

/** Whether [position] is inside [segment], its last second left out. */
export function inSegment(segment: SkipSegment, position: number, duration: number): boolean {
  const end = skipTarget(segment, duration)
  return position >= segment.start && position < end - END_MARGIN_S
}

/**
 * The segment at [position] whose button should show, or null. One the viewer has already
 * skipped ([skipped], by start) does not come back for this playback.
 */
export function activeSegment(
  segments: readonly SkipSegment[],
  position: number,
  duration: number,
  skipped: ReadonlySet<number> = new Set(),
): SkipSegment | null {
  if (!(duration > 0)) return null
  return segments.find((s) => !skipped.has(s.start) && inSegment(s, position, duration)) ?? null
}

/** Credits or an ending that roll until the file ends (or within five seconds of it). */
export function runsToEnd(segment: SkipSegment, duration: number): boolean {
  if (segment.kind !== 'credits' && segment.kind !== 'ending') return false
  return segment.end === null || (duration > 0 && duration - segment.end < END_MARGIN_S * 5)
}

/**
 * Where the closing credits begin, so the next episode can be offered then rather than only in
 * the last half minute; null when no credits that run to the end are known.
 */
export function creditsStart(segments: readonly SkipSegment[], duration: number): number | null {
  const closing = segments.filter((s) => runsToEnd(s, duration)).map((s) => s.start)
  return closing.length > 0 ? Math.min(...closing) : null
}

const LABELS = {
  recap: 'skipRecap',
  intro: 'skipIntro',
  opening: 'skipOpening',
  credits: 'skipCredits',
  ending: 'skipEnding',
  preview: 'skipPreview',
} as const

/** The words on the button, in the player's language. */
export function skipLabel(kind: SkipKind, t: Translate): string {
  return t(LABELS[kind])
}

/** A segment as stored and read back: anything malformed is dropped rather than trusted. */
export function validSegments(value: unknown): SkipSegment[] {
  if (!Array.isArray(value)) return []
  const kinds: readonly string[] = ['recap', 'intro', 'opening', 'credits', 'ending', 'preview']
  return value.flatMap((v): SkipSegment[] => {
    if (v == null || typeof v !== 'object') return []
    const { kind, start, end } = v as Record<string, unknown>
    if (typeof kind !== 'string' || !kinds.includes(kind)) return []
    if (typeof start !== 'number' || !Number.isFinite(start) || start < 0) return []
    if (end !== null && (typeof end !== 'number' || !Number.isFinite(end) || end <= start))
      return []
    return [{ kind: kind as SkipKind, start, end: end as number | null }]
  })
}

// ---- from the file's own chapters ------------------------------------------------------

/** A chapter mark as the file gives it, in seconds; [end] 0 or missing when it does not say. */
export interface FileChapter {
  title: string
  start: number
  end?: number
}

/*
 * Many releases, anime above all, mark their opening and ending as chapters ("Opening", "OP",
 * "Ending", "Credits"). Those marks come with the file, need no lookup and are exact for this cut,
 * so a file with them gets the button even when you pass no skip times. Only names that say what
 * the stretch is count: "Chapter 2" or "Part A" says nothing to skip.
 */
const NAMES: ReadonlyArray<[RegExp, SkipKind]> = [
  [/^(recap|previously( on.*)?|story so far)$/, 'recap'],
  [/^(intro|introduction|title sequence|titles|opening titles|theme( song)?)$/, 'intro'],
  [/^(op|opening|opening (theme|song|credits)|op\s*\d*|ncop)$/, 'opening'],
  [/^(ed|ending|ending (theme|song)|ed\s*\d*|nced)$/, 'ending'],
  [/^(credits|end credits|closing credits|outro|end titles)$/, 'credits'],
  [/^(preview|next episode( preview)?|next time|next ep(isode)? preview|trailer)$/, 'preview'],
]

/** Shorter than this is a mark, not a stretch; longer is not an intro. */
const MIN_S = 5
const MAX_S = 10 * 60

function kindOf(title: string): SkipKind | null {
  const name = title
    .toLowerCase()
    .replace(/[_.\-–—:|[\]()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  for (const [pattern, kind] of NAMES) if (pattern.test(name)) return kind
  return null
}

/** The stretches the file's own chapter names mark, each ending where its chapter does. */
export function segmentsFromChapters(
  chapters: readonly FileChapter[],
  duration: number,
): SkipSegment[] {
  const sorted = [...chapters]
    .filter((c) => Number.isFinite(c.start) && c.start >= 0)
    .sort((a, b) => a.start - b.start)
  const out: SkipSegment[] = []
  sorted.forEach((chapter, i) => {
    const kind = kindOf(chapter.title ?? '')
    if (!kind) return
    const next = sorted[i + 1]?.start
    const end =
      chapter.end && chapter.end > chapter.start
        ? chapter.end
        : next != null
          ? next
          : duration > 0
            ? duration
            : null
    if (end == null) return
    const length = end - chapter.start
    if (length < MIN_S || length > MAX_S) return
    // A last chapter that runs to the end is credits rolling to the end of the file.
    const toEnd = duration > 0 && Math.abs(duration - end) < 1
    out.push({ kind, start: chapter.start, end: toEnd ? null : end })
  })
  return out
}
