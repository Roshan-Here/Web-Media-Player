// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useMemo, useState } from 'react'
import { useT } from '../lib/labels.js'
import { timelineChapters, type TimelineChapter } from '../lib/chapters.js'
import type { ChapterMark, MediaEngine } from '../lib/engine.js'

/**
 * The file's own chapter marks, read when its tracks are known (and again after a decoder
 * restart); null until then. The browser's decoder reads none.
 */
export function useFileChapters(engine: MediaEngine | null): readonly ChapterMark[] | null {
  const [read, setRead] = useState<{ engine: MediaEngine; chapters: ChapterMark[] } | null>(null)
  useEffect(() => {
    if (!engine) return
    return engine.onTracks(() => setRead({ engine, chapters: engine.chapters() }))
  }, [engine])
  return read && read.engine === engine ? read.chapters : null
}

/** The file's chapters as parts of the timeline (see timelineChapters); empty without any. */
export function useTimelineChapters(
  marks: readonly ChapterMark[] | null,
  duration: number,
): readonly TimelineChapter[] {
  const t = useT()
  return useMemo(
    () => timelineChapters(marks ?? [], duration, (n) => t('chapterN', { n })),
    [marks, duration, t],
  )
}
