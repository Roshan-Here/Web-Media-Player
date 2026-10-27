// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useMemo, useState } from 'react'
import type { PreviewSource } from '../lib/engine.js'
import { PreviewQueue } from '../lib/preview-queue.js'

export interface SeekPreview {
  /** Whether this video has previews at all. */
  available: boolean
  /** The still for the time asked for last, or the closest one made so far. */
  url: string | null
  /** The pointer reached the timeline: get the preview decoder going. */
  prepare(): void
  /** The time the pointer is over, or null when it left. */
  want(time: number | null): void
}

/**
 * Stills of the scene for the timeline, about one per 300th of the video, asked for one at a
 * time (see PreviewQueue). A new engine, or a duration learnt late, starts from nothing.
 */
export function useSeekPreview(previews: PreviewSource | null, duration: number): SeekPreview {
  const step = duration > 0 ? Math.min(10, Math.max(1, duration / 300)) : 0
  const [shown, setShown] = useState<{ queue: PreviewQueue; url: string } | null>(null)

  const queue = useMemo(() => {
    if (!previews || step <= 0) return null
    // Stills are tagged with their queue, so one from a replaced queue is never shown.
    const created: PreviewQueue = new PreviewQueue(previews, {
      step,
      onImage: (url) => setShown({ queue: created, url }),
    })
    return created
  }, [previews, step])

  useEffect(() => () => queue?.dispose(), [queue])

  const url = shown && shown.queue === queue ? shown.url : null
  return useMemo(
    () => ({
      available: queue !== null,
      url,
      prepare: () => queue?.prepare(),
      want: (time: number | null) => queue?.want(time),
    }),
    [queue, url],
  )
}
