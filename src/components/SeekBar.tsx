// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { SeekPreview } from '../hooks/useSeekPreview.js'
import { chapterIndexAt, type TimelineChapter } from '../lib/chapters.js'
import { cx } from '../lib/cx.js'
import { formatDuration } from '../lib/format.js'
import { useT } from '../lib/labels.js'

export interface SeekBarProps {
  /** Where playback is, or is going (a pending seek target). */
  position: number
  duration: number
  bufferedEnd: number
  /** One call per gesture: a click, or a drag when it is released. */
  onSeek: (time: number) => void
  /** Keyboard steps, in seconds; the player merges a burst of them into one seek. */
  onStep: (delta: number) => void
  /** Told when a drag starts and ends, so the controls stay up meanwhile. */
  onScrubbing?: (scrubbing: boolean) => void
  size?: 'regular' | 'compact'
  /** Stills of the scene under the pointer, shown above it while hovering or dragging. */
  preview?: SeekPreview
  /**
   * The video's parts (see timelineChapters): the bar is drawn in segments, one per part, the
   * one under the pointer grows, and its name shows over the time.
   */
  chapters?: readonly TimelineChapter[]
}

/** The gap between two parts of the bar, in CSS pixels. */
const CHAPTER_GAP = 3

const NO_CHAPTERS: readonly TimelineChapter[] = []

/** Width of the preview card in CSS pixels; it stays inside the bar at both ends. */
const CARD_WIDTH = 176
const CARD_WIDTH_SMALL = 128

const KEY_STEPS: Record<string, number> = {
  ArrowLeft: -5,
  ArrowDown: -5,
  ArrowRight: 5,
  ArrowUp: 5,
  PageDown: -30,
  PageUp: 30,
}

/**
 * The timeline: what has played, what is loaded, and a draggable handle. It is an ARIA slider
 * of its own rather than a native range input, whose input events fire with stale values
 * around a drag and sent extra seeks that undid the one the person asked for.
 *
 * A video with chapters gets a bar in parts, as on video sites: each part sits at its true
 * place in time (so the pointer still maps straight onto the timeline), with a small gap before
 * the next, and fills as it plays.
 */
export function SeekBar({
  position,
  duration,
  bufferedEnd,
  onSeek,
  onStep,
  onScrubbing,
  size = 'regular',
  preview,
  chapters = NO_CHAPTERS,
}: SeekBarProps) {
  const t = useT()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  const ready = duration > 0

  const shown = drag ?? position
  const playedPct = ready ? Math.min(100, (shown / duration) * 100) : 0
  const bufferedTo = Math.max(bufferedEnd, shown)
  const bufferedPct = ready ? Math.min(100, (bufferedTo / duration) * 100) : 0
  const parts = ready ? chapters : NO_CHAPTERS

  const timeAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || !ready) return null
    const share = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    if (rect.width !== trackWidth) setTrackWidth(rect.width)
    return { x: share * rect.width, time: share * duration }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus()
    const at = timeAt(event.clientX)
    if (!at) return
    setDrag(at.time)
    onScrubbing?.(true)
    preview?.prepare()
    preview?.want(at.time)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const at = timeAt(event.clientX)
    if (at && event.pointerType === 'mouse') setHover(at)
    if (drag !== null && at) setDrag(at.time)
    if (at && (drag !== null || event.pointerType === 'mouse')) preview?.want(at.time)
  }

  const finish = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (drag === null) return
    const at = timeAt(event.clientX)
    const time = at ? at.time : drag
    setDrag(null)
    onScrubbing?.(false)
    if (event.pointerType !== 'mouse') preview?.want(null)
    if (commit) onSeek(time)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!ready) return
    // Shift and an arrow is the player's: the next or previous chapter.
    if (event.shiftKey && parts.length > 0 && /^Arrow(Left|Right)$/.test(event.key)) return
    const step = KEY_STEPS[event.key]
    if (step !== undefined) onStep(step)
    else if (event.key === 'Home') onSeek(0)
    else if (event.key === 'End') onSeek(duration)
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  const compact = size === 'compact'
  const tipTime = drag ?? hover?.time ?? null
  const tipX = drag !== null ? (playedPct / 100) * trackWidth : (hover?.x ?? 0)
  const withPreview = !compact && preview?.available === true
  const cardWidth = trackWidth > 0 && trackWidth < 480 ? CARD_WIDTH_SMALL : CARD_WIDTH
  // Kept whole inside the bar; the time label under it follows the same position.
  const cardX =
    trackWidth > cardWidth
      ? Math.min(trackWidth - cardWidth / 2, Math.max(cardWidth / 2, tipX))
      : tipX
  // The part playing, and the one under the pointer (or the handle, while dragging).
  const playingPart = parts[chapterIndexAt(parts, shown)] ?? null
  const tipPart = tipTime !== null ? (parts[chapterIndexAt(parts, tipTime)] ?? null) : null
  const label = playingPart
    ? t('seekValueChapter', {
        position: formatDuration(shown),
        duration: formatDuration(duration),
        chapter: playingPart.title,
      })
    : t('seekValue', {
        position: formatDuration(shown),
        duration: formatDuration(duration),
      })
  // The time under the pointer, under the name of its part.
  const tipLabel = (maxWidth?: number) =>
    tipTime !== null ? (
      <span
        className="mp:grid mp:max-w-[min(18rem,80cqi)] mp:justify-items-center mp:rounded-md mp:bg-bg/92 mp:px-2 mp:py-[3px] mp:text-xs mp:whitespace-nowrap mp:tabular-nums"
        style={maxWidth ? { maxWidth } : undefined}
      >
        {tipPart ? (
          <span className="mp:max-w-full mp:truncate mp:font-semibold" data-seek-chapter="">
            {tipPart.title}
          </span>
        ) : null}
        <span className={tipPart ? 'mp:text-muted' : undefined}>{formatDuration(tipTime)}</span>
      </span>
    ) : null

  return (
    <div
      role="slider"
      tabIndex={ready ? 0 : -1}
      aria-label={t('seek')}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={label}
      aria-disabled={!ready || undefined}
      className={cx(
        'mp:group/seek mp:relative mp:flex mp:touch-none mp:items-center mp:outline-none mp:select-none',
        compact ? 'mp:h-4' : 'mp:h-6',
        ready ? 'mp:cursor-pointer' : 'mp:cursor-default',
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, true)}
      onPointerCancel={(e) => finish(e, false)}
      onPointerEnter={() => preview?.prepare()}
      onPointerLeave={() => {
        setHover(null)
        if (drag === null) preview?.want(null)
      }}
      onKeyDown={onKeyDown}
    >
      {parts.length > 0 ? (
        <div
          ref={trackRef}
          className={cx(
            'mp:absolute mp:inset-x-0 mp:rounded-full mp:transition-[height] mp:duration-150 mp:ease-soft',
            'mp:group-focus-visible/seek:outline-2 mp:group-focus-visible/seek:outline-offset-3 mp:group-focus-visible/seek:outline-accent',
            drag !== null ? 'mp:h-1.5' : 'mp:h-1 mp:group-hover/seek:h-1.5',
          )}
          data-seek-chapters={parts.length}
        >
          {parts.map((part) => {
            const length = part.end - part.start
            const last = part.end >= duration
            const fill = (to: number) =>
              `${Math.min(100, Math.max(0, ((to - part.start) / length) * 100))}%`
            const lifted = tipPart === part
            return (
              <div
                key={part.start}
                className={cx(
                  'mp:absolute mp:inset-y-0 mp:overflow-hidden mp:rounded-full mp:bg-ink/22',
                  'mp:origin-center mp:transition-transform mp:duration-150 mp:ease-soft',
                  lifted && 'mp:scale-y-[1.7]',
                )}
                style={{
                  left: `${(part.start / duration) * 100}%`,
                  width: last
                    ? `${(length / duration) * 100}%`
                    : `max(1px, calc(${(length / duration) * 100}% - ${CHAPTER_GAP}px))`,
                }}
                data-seek-part=""
              >
                <div
                  className="mp:absolute mp:inset-y-0 mp:left-0 mp:bg-ink/38"
                  style={{ width: fill(bufferedTo) }}
                />
                <div
                  className="mp:absolute mp:inset-y-0 mp:left-0 mp:bg-accent"
                  style={{ width: fill(shown) }}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div
          ref={trackRef}
          className={cx(
            'mp:absolute mp:inset-x-0 mp:overflow-hidden mp:rounded-full mp:bg-ink/22 mp:transition-[height] mp:duration-150 mp:ease-soft',
            'mp:group-focus-visible/seek:outline-2 mp:group-focus-visible/seek:outline-offset-3 mp:group-focus-visible/seek:outline-accent',
            drag !== null ? 'mp:h-1.5' : 'mp:h-1 mp:group-hover/seek:h-1.5',
          )}
        >
          <div
            className="mp:absolute mp:inset-y-0 mp:left-0 mp:bg-ink/38"
            style={{ width: `${bufferedPct}%` }}
          />
          <div
            className="mp:absolute mp:inset-y-0 mp:left-0 mp:bg-accent"
            style={{ width: `${playedPct}%` }}
          />
        </div>
      )}
      <div
        className={cx(
          'mp:pointer-events-none mp:absolute mp:top-1/2 mp:-ml-[7px] mp:size-3.5 mp:-translate-y-1/2 mp:rounded-full mp:bg-accent mp:transition-transform mp:duration-150 mp:ease-soft',
          drag !== null
            ? 'mp:scale-100'
            : 'mp:scale-0 mp:group-hover/seek:scale-100 mp:group-focus-visible/seek:scale-100',
        )}
        style={{ left: `${playedPct}%` }}
      />
      {tipTime !== null && ready && withPreview ? (
        <div
          className="mp:pointer-events-none mp:absolute mp:bottom-7 mp:z-1 mp:grid mp:-translate-x-1/2 mp:justify-items-center mp:gap-1.5"
          style={{ left: cardX }}
          aria-hidden="true"
          data-seek-preview=""
        >
          <div
            className="mp:aspect-video mp:overflow-hidden mp:rounded-md mp:border-2 mp:border-ink/85 mp:bg-black mp:shadow-[0_8px_28px_color-mix(in_srgb,var(--mp-color-shadow)_55%,transparent)]"
            style={{ width: cardWidth }}
          >
            {preview.url ? (
              <img
                src={preview.url}
                alt=""
                className="mp:size-full mp:object-contain"
                draggable={false}
              />
            ) : (
              <span className="mp:block mp:size-full mp:animate-shimmer mp:bg-[linear-gradient(100deg,var(--mp-color-surface)_40%,var(--mp-color-raised)_50%,var(--mp-color-surface)_60%)] mp:bg-size-[300%_100%]" />
            )}
          </div>
          {tipLabel(cardWidth)}
        </div>
      ) : tipTime !== null && ready ? (
        <div
          className="mp:pointer-events-none mp:absolute mp:bottom-6"
          style={{
            left: tipX,
            // Centred on the pointer, but kept whole inside the bar at both ends (a percentage
            // here is of the label's own width).
            translate:
              trackWidth > 0
                ? `clamp(${-tipX}px, -50%, calc(${trackWidth - tipX}px - 100%))`
                : '-50%',
          }}
          aria-hidden="true"
        >
          {tipLabel()}
        </div>
      ) : null}
    </div>
  )
}
