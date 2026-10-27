// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useCallback, useMemo, useState } from 'react'
import type { ChapterMark } from '../lib/engine.js'
import {
  activeSegment,
  runsToEnd,
  segmentsFromChapters,
  skipTarget,
  type SkipSegment,
} from '../lib/skip.js'

/**
 * The "Skip intro" button's state: which timed stretch (recap, intro or opening, credits or ending,
 * preview) the playhead is in, and the jump past it.
 *
 * The times are the ones the app passes ([given]), or, without any, the file's own chapters named
 * "Opening", "Ending" and the like. A stretch skipped once is not offered again in this playback,
 * even when the viewer goes back into it on purpose.
 */
export function useSkip({
  chapters,
  given,
  position,
  duration,
  enabled,
  seekTo,
  hideClosing = false,
}: {
  /** The file's own chapter marks, null until read (see useFileChapters). */
  chapters: readonly ChapterMark[] | null
  given: readonly SkipSegment[] | null | undefined
  position: number
  duration: number
  enabled: boolean
  seekTo: (time: number) => void
  /**
   * Leaves out credits that roll to the end: with a next episode to play, the next-episode card
   * covers them, so they get no button of their own.
   */
  hideClosing?: boolean
}) {
  const segments = useMemo<readonly SkipSegment[]>(() => {
    if (!enabled) return []
    if (given && given.length > 0) return given
    return chapters ? segmentsFromChapters(chapters, duration) : []
  }, [enabled, given, chapters, duration])

  const [skipped, setSkipped] = useState<ReadonlySet<number>>(() => new Set())
  const offered = useMemo(
    () => (hideClosing ? segments.filter((s) => !runsToEnd(s, duration)) : segments),
    [segments, hideClosing, duration],
  )
  const active = activeSegment(offered, position, duration, skipped)

  const skip = useCallback((): boolean => {
    if (!active) return false
    setSkipped((before) => new Set(before).add(active.start))
    seekTo(skipTarget(active, duration))
    return true
  }, [active, duration, seekTo])

  return { active, skip, segments }
}
