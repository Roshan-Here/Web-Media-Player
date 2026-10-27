// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useCallback, useEffect, useMemo, useState } from 'react'
import { setMedia, type MediaLike } from '../lib/engine.js'
import { SeekController } from '../lib/seek.js'

/**
 * Seeking for the player's controls, through a SeekController so bursts of requests become one
 * seek. `target` is where playback is going while a seek is under way, for the timeline to show.
 */
export function useSeek(media: MediaLike | null) {
  const [target, setTarget] = useState<number | null>(null)

  const controller = useMemo(
    () =>
      media
        ? new SeekController(
            {
              currentTime: () => media.currentTime,
              duration: () => media.duration,
              seek: (time) => setMedia(media, { currentTime: time }),
            },
            { onChange: setTarget },
          )
        : null,
    [media],
  )

  useEffect(() => {
    if (!media || !controller) return
    const observe = () => controller.observe()
    media.addEventListener('seeked', observe)
    media.addEventListener('timeupdate', observe)
    return () => {
      media.removeEventListener('seeked', observe)
      media.removeEventListener('timeupdate', observe)
      controller.reset()
    }
  }, [media, controller])

  const seekTo = useCallback(
    (time: number, now = false) => controller?.seekTo(time, now),
    [controller],
  )
  const seekBy = useCallback((delta: number) => controller?.seekBy(delta), [controller])
  return { target: media ? target : null, seekTo, seekBy }
}
