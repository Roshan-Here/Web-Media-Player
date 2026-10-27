// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useState } from 'react'
import type { MediaLike } from '../lib/engine.js'

export interface MediaState {
  paused: boolean
  ended: boolean
  waiting: boolean
  currentTime: number
  duration: number
  /** End of the buffered range around the playhead, in seconds. */
  bufferedEnd: number
  volume: number
  muted: boolean
  playbackRate: number
}

const initial: MediaState = {
  paused: true,
  ended: false,
  waiting: true,
  currentTime: 0,
  duration: 0,
  bufferedEnd: 0,
  volume: 1,
  muted: false,
  playbackRate: 1,
}

const EVENTS = [
  'play',
  'pause',
  'playing',
  'waiting',
  'seeking',
  'seeked',
  'timeupdate',
  'durationchange',
  'loadedmetadata',
  'canplay',
  'progress',
  'volumechange',
  'ratechange',
  'ended',
] as const

function read(media: MediaLike, waiting: boolean): MediaState {
  const t = media.currentTime
  let bufferedEnd = t
  try {
    const ranges = media.buffered
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= t + 0.5 && ranges.end(i) >= t)
        bufferedEnd = Math.max(bufferedEnd, ranges.end(i))
    }
  } catch {
    // Some engines throw while loading; the playhead is a fine fallback.
  }
  const duration = media.duration
  return {
    paused: media.paused,
    ended: media.ended,
    waiting,
    currentTime: Number.isFinite(t) ? t : 0,
    duration: Number.isFinite(duration) ? duration : 0,
    bufferedEnd,
    volume: media.volume,
    muted: media.muted,
    playbackRate: media.playbackRate,
  }
}

/**
 * How often the playhead moving shows on screen. Browsers send `timeupdate` about four times a
 * second, but the built-in decoder sends it with every frame; following each one would draw the
 * whole player 24 to 60 times a second for a clock that changes once a second, and starve
 * React's other work (a route change into the miniplayer could wait seconds).
 */
const TIME_STEP_MS = 250

/** The media element's playback state, updated from its events. */
export function useMediaState(media: MediaLike | null): MediaState {
  const [state, setState] = useState<MediaState>(initial)

  useEffect(() => {
    if (!media) return
    let waiting = true
    let last = 0
    const update = (event?: Event) => {
      const now = performance.now()
      if (event?.type === 'timeupdate' && now - last < TIME_STEP_MS) return
      last = now
      if (event?.type === 'waiting' || event?.type === 'seeking') waiting = true
      if (
        event?.type === 'playing' ||
        event?.type === 'canplay' ||
        event?.type === 'seeked' ||
        event?.type === 'pause'
      ) {
        waiting = false
      }
      setState(read(media, waiting))
    }
    for (const type of EVENTS) media.addEventListener(type, update)
    update()
    return () => {
      for (const type of EVENTS) media.removeEventListener(type, update)
    }
  }, [media])

  return media ? state : initial
}
