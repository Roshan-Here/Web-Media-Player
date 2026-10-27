// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { MediaLike } from './engine.js'

/**
 * How a start went: with sound, muted because the browser would not allow sound before the
 * person interacted with the page, refused outright, or interrupted (the decoder seeked,
 * reloaded or switched decoders under the play request) and worth trying again.
 */
export type StartResult = 'playing' | 'muted' | 'blocked' | 'interrupted'

/**
 * Starts playback the way browsers allow it. Opening a video from a list counts as a click,
 * so sound is usually allowed; a reload or a link opened in a new tab is not, and then
 * Chrome and Safari only let muted video play. Rather than show a paused picture, play muted
 * and let the player offer to turn the sound on.
 */
export async function startPlayback(media: MediaLike): Promise<StartResult> {
  try {
    await media.play()
    return 'playing'
  } catch (error) {
    if (!isNotAllowed(error)) return 'interrupted'
  }
  const wasMuted = media.muted
  media.muted = true
  try {
    await media.play()
    return wasMuted ? 'playing' : 'muted'
  } catch (error) {
    media.muted = wasMuted
    return isNotAllowed(error) ? 'blocked' : 'interrupted'
  }
}

/** Events after which the media may be able to play when it could not a moment ago. */
const READY_EVENTS = ['loadeddata', 'canplay', 'canplaythrough', 'seeked', 'playing'] as const

export interface PlayWhenReadyOptions {
  /** Told once how the start went, and never again. */
  onStarted: (result: 'playing' | 'muted' | 'blocked') => void
  /** Attempts before giving up on a media element that keeps refusing for other reasons. */
  maxAttempts?: number
}

/**
 * Plays the media as soon as it can, and keeps trying until it does: what ExoPlayer calls
 * `playWhenReady`.
 *
 * A single `play()` at the first frame is not enough. The built-in decoder seeks to the resume
 * position, or rebuilds itself to decode in software, right after its first frame; either one
 * rejects a `play()` under way with an AbortError, and a player that only tried once then
 * sat paused on the first frame. Here an interrupted start is tried again at the next sign
 * that the media is ready (a frame loaded, a seek finished), and the intent ends only once
 * playback has started, the browser has refused it outright, or [cancel] is called (the
 * person paused, or the engine went away).
 */
export class PlayWhenReady {
  private readonly media: MediaLike
  private readonly onStarted: PlayWhenReadyOptions['onStarted']
  private readonly maxAttempts: number
  private attempts = 0
  private trying = false
  private done = false

  constructor(media: MediaLike, options: PlayWhenReadyOptions) {
    this.media = media
    this.onStarted = options.onStarted
    this.maxAttempts = options.maxAttempts ?? 8
    for (const type of READY_EVENTS) media.addEventListener(type, this.onReady)
    // The media may have been ready before anyone listened.
    if (haveFrame(media)) void this.attempt()
  }

  /** Whether it is still waiting to start playback. */
  get pending(): boolean {
    return !this.done
  }

  /** Stops trying: the person took over, or the media is going away. */
  cancel(): void {
    if (this.done) return
    this.done = true
    for (const type of READY_EVENTS) this.media.removeEventListener(type, this.onReady)
  }

  private readonly onReady = (event: Event) => {
    if (this.done) return
    // Playing on its own (the decoder resumed itself after a rebuild): nothing left to do.
    if (event.type === 'playing' && !this.media.paused) {
      this.finish('playing')
      return
    }
    void this.attempt()
  }

  private async attempt(): Promise<void> {
    if (this.done || this.trying || !this.media.paused) {
      if (!this.done && !this.trying && !this.media.paused) this.finish('playing')
      return
    }
    this.trying = true
    this.attempts++
    const result = await startPlayback(this.media)
    this.trying = false
    if (this.done) return
    if (result === 'interrupted') {
      // Wait for the next ready event; give up only after a run of failures.
      if (this.attempts >= this.maxAttempts) this.finish('blocked')
      return
    }
    this.finish(result)
  }

  private finish(result: 'playing' | 'muted' | 'blocked'): void {
    this.cancel()
    this.onStarted(result)
  }
}

/** Whether the media has a frame to show, by the standard readyState where it has one. */
function haveFrame(media: MediaLike): boolean {
  const state = (media as MediaLike & { readyState?: number }).readyState
  return typeof state === 'number' && state >= 2
}

function isNotAllowed(error: unknown): boolean {
  return error instanceof Error && error.name === 'NotAllowedError'
}
