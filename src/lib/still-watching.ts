// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/*
 * "Still watching?": after a few episodes have started by themselves in a row with nobody
 * there, the next one waits to be asked for. Any input at all, a key, a click, a touch, a
 * scroll, counts as somebody being there and starts the count again, so someone who fell asleep
 * does not wake to a finished season.
 */

export interface StillWatching {
  /** An episode started by itself: call from `upNext.play(auto)` when `auto` is true. */
  autoplayed(): void
  /** Whether the next one should ask first: pass as `upNext.shouldAsk`. */
  shouldAsk(): boolean
  reset(): void
}

/** A counter of episodes autoplayed in a row; [limit] of them in a row and the next one asks. */
export function createStillWatching(limit = 3): StillWatching {
  let inARow = 0
  let listening = false
  const listen = () => {
    if (listening || typeof window === 'undefined') return
    listening = true
    const reset = () => {
      inARow = 0
    }
    for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const)
      window.addEventListener(type, reset, { capture: true, passive: true })
  }
  return {
    autoplayed() {
      listen()
      inARow++
    },
    shouldAsk() {
      listen()
      return inARow >= limit
    },
    reset() {
      inARow = 0
    },
  }
}
