// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { ChapterMark } from './engine.js'

/** One part of the video as the timeline shows it: from [start] to [end], in seconds. */
export interface TimelineChapter {
  title: string
  start: number
  end: number
}

/** Marks closer together than this are one mark (muxers often repeat one at the same time). */
const SAME_MARK_S = 0.5
/** A first mark later than this leaves a part before it, untitled, from the start. */
const LEAD_IN_S = 1
/** Within this of a chapter's start, "previous chapter" goes to the one before it. */
const RESTART_WINDOW_S = 3

/**
 * The file's chapter marks as parts of the timeline, the way the big players show them: in
 * order, each running to the next one's start and the last to the end, with nothing shorter
 * than half a second and nothing past the end. A first mark after the start gets a part before
 * it. A name the file leaves empty is [untitled] of the part's number, counted from 1.
 *
 * Fewer than two parts is no chapters at all (one part is the whole video), and so is a video
 * whose length is not known yet: there is nothing to divide.
 */
export function timelineChapters(
  marks: readonly ChapterMark[],
  duration: number,
  untitled: (n: number) => string,
): TimelineChapter[] {
  if (!(duration > 0)) return []
  const starts: { title: string; start: number }[] = []
  for (const mark of [...marks]
    .filter((m) => Number.isFinite(m.start) && m.start >= 0 && m.start < duration - SAME_MARK_S)
    .sort((a, b) => a.start - b.start)) {
    const title = (mark.title ?? '').trim()
    const last = starts.at(-1)
    if (last && mark.start - last.start < SAME_MARK_S) {
      // The same mark twice: keep the one with a name.
      if (!last.title && title) last.title = title
      continue
    }
    starts.push({ title, start: mark.start })
  }
  if (starts.length > 0 && starts[0]!.start > LEAD_IN_S) starts.unshift({ title: '', start: 0 })
  else if (starts.length > 0) starts[0]!.start = 0
  if (starts.length < 2) return []
  return starts.map((part, i) => ({
    title: part.title || untitled(i + 1),
    start: part.start,
    end: starts[i + 1]?.start ?? duration,
  }))
}

/** The index of the part playing at [time], or -1 without chapters. */
export function chapterIndexAt(chapters: readonly TimelineChapter[], time: number): number {
  if (chapters.length === 0) return -1
  let lo = 0
  let hi = chapters.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (chapters[mid]!.start <= time) lo = mid
    else hi = mid - 1
  }
  return lo
}

/**
 * Where "next chapter" ([direction] 1) or "previous chapter" (-1) goes from [time]: the next
 * part's start, or this part's start, unless playback is within its first few seconds, then the
 * one before, as a CD player's back button does. Null when there is nowhere to go.
 */
export function chapterJump(
  chapters: readonly TimelineChapter[],
  time: number,
  direction: 1 | -1,
): TimelineChapter | null {
  const index = chapterIndexAt(chapters, time)
  if (index < 0) return null
  if (direction === 1) return chapters[index + 1] ?? null
  const current = chapters[index]!
  if (time - current.start > RESTART_WINDOW_S) return current
  return chapters[index - 1] ?? null
}
