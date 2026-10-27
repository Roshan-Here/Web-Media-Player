// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaLike } from '../lib/engine.js'

/** What the player is told about the episode after this one. */
export interface UpNext {
  /** "S1 E5 · The Visit": what the card names. */
  label: string
  /** The show's title, over the label. */
  title: string
  /** Starts the next episode; [auto] when the player moved on by itself rather than on a press. */
  play: (auto: boolean) => void
  /** Starts fetching the next file, so it plays at once when its turn comes. */
  prepare?: () => void
  /**
   * Whether to ask "Still watching?" instead of moving on by itself: after a few episodes in a
   * row with nobody touching anything (see createStillWatching).
   */
  shouldAsk: () => boolean
}

/** The card comes up in the last half minute. */
export const NEXT_UP_LEAD_S = 30
/** Credits timed to begin well before that are counted down this long, then the next one plays. */
export const CREDITS_COUNTDOWN_S = 15
/** At the end of a video the card was not seen for, the next one waits this long. */
export const END_COUNTDOWN_S = 8

export type UpNextPhase =
  { kind: 'watching' } | { kind: 'countdown'; seconds: number } | { kind: 'ask' } | { kind: 'done' }

/**
 * The next episode, as streaming apps offer it: a card in the corner in the last half minute (or
 * from where the closing credits begin, when the skip times know), counting down to the next
 * episode, which it plays when this one ends; Hide puts it away for this playback. A video that
 * ends without the card having been seen counts eight seconds down over the picture first. After a
 * few episodes in a row with no input, it asks "Still watching?" instead of moving on.
 */
export function useUpNext({
  upNext,
  enabled,
  media,
  position,
  duration,
  credits,
}: {
  upNext: UpNext | null | undefined
  /** Off when turned off, in the miniplayer, or before the video is ready. */
  enabled: boolean
  media: MediaLike | null
  position: number
  duration: number
  /** Where the closing credits begin, when known. */
  credits: number | null
}) {
  const [dismissed, setDismissed] = useState(false)
  const [phase, setPhase] = useState<UpNextPhase>({ kind: 'watching' })
  const on = enabled && upNext != null && !dismissed

  const left = duration - position
  const lead = Math.max(NEXT_UP_LEAD_S, credits != null && duration > 0 ? duration - credits : 0)
  const earlyCredits = credits != null && duration - credits > NEXT_UP_LEAD_S
  const nextIn = earlyCredits ? credits + CREDITS_COUNTDOWN_S - position : left
  const cardVisible = on && phase.kind === 'watching' && duration > 0 && left > 0.25 && left <= lead

  // Whether the card has been up in this playback: then the end plays the next one at once.
  const shown = useRef(false)
  useEffect(() => {
    if (!cardVisible) return
    shown.current = true
    upNext?.prepare?.()
  }, [cardVisible, upNext])

  const latest = useRef({ upNext, on })
  useEffect(() => {
    latest.current = { upNext, on }
  })

  /** Moves on by itself, or asks first after a few in a row. */
  const advance = useCallback(() => {
    const { upNext: next, on: allowed } = latest.current
    if (!next || !allowed) return
    if (next.shouldAsk()) {
      media?.pause()
      setPhase({ kind: 'ask' })
    } else {
      next.play(true)
    }
  }, [media])

  // Credits that start early: counted down from where they begin, then on to the next episode.
  const creditsDone = cardVisible && earlyCredits && nextIn <= 0
  useEffect(() => {
    if (creditsDone) advance()
  }, [creditsDone, advance])

  // The end of the video.
  useEffect(() => {
    if (!media) return
    const onEnded = () => {
      const { upNext: next, on: allowed } = latest.current
      if (!next || !allowed) return
      if (next.shouldAsk()) setPhase({ kind: 'ask' })
      else if (shown.current) next.play(true)
      else {
        next.prepare?.()
        setPhase({ kind: 'countdown', seconds: END_COUNTDOWN_S })
      }
    }
    media.addEventListener('ended', onEnded)
    return () => media.removeEventListener('ended', onEnded)
  }, [media])

  // The countdown over the picture, a second at a time, and the next episode at zero.
  const counting = phase.kind === 'countdown' && phase.seconds > 0
  useEffect(() => {
    if (!counting) return
    const timer = setInterval(() => {
      setPhase((p) =>
        p.kind === 'countdown' && p.seconds > 0 ? { kind: 'countdown', seconds: p.seconds - 1 } : p,
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [counting])
  const countedDown = phase.kind === 'countdown' && phase.seconds <= 0
  useEffect(() => {
    if (countedDown) latest.current.upNext?.play(true)
  }, [countedDown])

  // Going back into the video (a seek away from the end) puts the end's questions away.
  useEffect(() => {
    if (!media) return
    const onSeeked = () => {
      if (duration > 0 && duration - media.currentTime > 1) {
        setPhase((p) => (p.kind === 'watching' ? p : { kind: 'watching' }))
      }
    }
    media.addEventListener('seeked', onSeeked)
    return () => media.removeEventListener('seeked', onSeeked)
  }, [media, duration])

  return {
    /** The card in the corner, with the seconds until the next episode. */
    card: cardVisible
      ? { seconds: Math.max(0, Math.ceil(nextIn)), share: nextShare(nextIn, lead, earlyCredits) }
      : null,
    phase,
    hide: () => setDismissed(true),
    playNow: () => {
      setPhase({ kind: 'done' })
      upNext?.play(false)
    },
    stop: () => setPhase({ kind: 'done' }),
  }
}

/** How much of the countdown has gone, 0 to 1, for the ring around the seconds. */
function nextShare(nextIn: number, lead: number, earlyCredits: boolean): number {
  const total = earlyCredits ? CREDITS_COUNTDOWN_S : lead
  if (total <= 0) return 1
  return Math.min(1, Math.max(0, 1 - nextIn / total))
}
