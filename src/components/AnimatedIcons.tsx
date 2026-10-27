// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { ReactNode } from 'react'
import { cx } from '../lib/cx.js'

/*
 * The player's icons that change with its state, animated from one state to the next instead of
 * being swapped. They are drawn to match the rest of the icons (Phosphor, regular weight: a
 * 256 unit box and 16 unit lines), because Phosphor's glyphs are single shapes that cannot move
 * apart. With reduced motion asked for, the player's stylesheet makes every change instant.
 */

/** Phosphor's speaker, without the waves, so the waves can come and go on their own. */
const SPEAKER =
  'M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM32,96H72v64H32ZM144,207.64,88,164.09V91.91l56-43.55Z'

/** The waves and the cross are measured from the speaker's mouth. */
const MOUTH = '168px 128px'
const CROSS_LENGTH = 68

export type VolumeLevel = 'off' | 'low' | 'high'

/** Which picture a volume shows: off when muted or silent, one wave below half, two above. */
export function volumeLevel(volume: number, muted: boolean): VolumeLevel {
  if (muted || volume <= 0.001) return 'off'
  return volume < 0.5 ? 'low' : 'high'
}

/**
 * The speaker with as many waves as the volume, and a cross that draws itself in when muted. The
 * waves grow out of the speaker and shrink back into it, the outer one a beat after the inner.
 */
export function VolumeIcon({
  volume,
  muted,
  size = 20,
  className,
}: {
  volume: number
  muted: boolean
  size?: number
  className?: string
}) {
  const level = volumeLevel(volume, muted)
  const wave = (shown: boolean, delay: number) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? 'scale(1)' : 'scale(0.55)',
    transformOrigin: MOUTH,
    transformBox: 'view-box' as const,
    transition: `opacity 160ms var(--mp-ease-standard) ${delay}ms, transform 220ms var(--mp-ease-soft) ${delay}ms`,
  })
  const stroke = (shown: boolean, delay: number) => ({
    strokeDasharray: CROSS_LENGTH,
    strokeDashoffset: shown ? 0 : CROSS_LENGTH,
    opacity: shown ? 1 : 0,
    transition: `stroke-dashoffset 200ms var(--mp-ease-standard) ${delay}ms, opacity 120ms linear ${shown ? delay : delay + 120}ms`,
  })
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      data-level={level}
    >
      <path d={SPEAKER} fill="currentColor" />
      <g fill="none" stroke="currentColor" strokeWidth={16} strokeLinecap="round">
        <path d="M192,106.8A32,32,0,0,1,192,149.2" style={wave(level !== 'off', 0)} />
        <path d="M221.9,80.3A72,72,0,0,1,221.9,175.7" style={wave(level === 'high', 50)} />
        <path d="M192,104L240,152" style={stroke(level === 'off', 40)} />
        <path d="M240,104L192,152" style={stroke(level === 'off', 110)} />
      </g>
    </svg>
  )
}

/**
 * Two icons in one place, one showing: the other shrinks and fades as it turns up, as Play
 * turning into Pause. Both stay in the page, so the size never jumps.
 */
export function SwapIcon({ on, off, showOn }: { on: ReactNode; off: ReactNode; showOn: boolean }) {
  const layer = cx(
    'mp:col-start-1 mp:row-start-1 mp:transition-[opacity,transform] mp:duration-200 mp:ease-standard',
  )
  return (
    <span className="mp:grid mp:place-items-center" aria-hidden="true">
      <span
        className={cx(layer, showOn ? 'mp:scale-100 mp:opacity-100' : 'mp:scale-50 mp:opacity-0')}
      >
        {on}
      </span>
      <span
        className={cx(layer, showOn ? 'mp:scale-50 mp:opacity-0' : 'mp:scale-100 mp:opacity-100')}
      >
        {off}
      </span>
    </span>
  )
}
