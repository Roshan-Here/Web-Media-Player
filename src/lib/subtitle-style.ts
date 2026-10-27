// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { CSSProperties } from 'react'
import type { LabelKey, Translate } from './labels.js'
import { onStorageReset, readJson, writeJson } from './storage.js'

/*
 * How subtitles look, one setting for every video: the size, a dark box or none, how far up,
 * the text's colour, its edge, its typeface and how dark the box is. Styled (ASS) subtitles are
 * drawn as plain text, so these apply to every subtitle the player shows.
 */

export type SubtitleSize = 'small' | 'medium' | 'large' | 'xlarge'
export type SubtitleColor = 'white' | 'yellow' | 'cyan' | 'green' | 'pink'
export type SubtitleEdge = 'outline' | 'shadow' | 'none'
export type SubtitlePosition = 'bottom' | 'raised' | 'high'
export type SubtitleFont = 'sans' | 'serif' | 'mono'

export interface SubtitleStyle {
  size: SubtitleSize
  color: SubtitleColor
  /** A dark box behind the text, for a bright or busy picture. */
  box: boolean
  /** How dark the box is, 0.25 to 1. */
  boxOpacity: number
  edge: SubtitleEdge
  position: SubtitlePosition
  font: SubtitleFont
  bold: boolean
}

/** Clean text with an outline and no box, as streaming apps draw it; easy to read anywhere. */
export const DEFAULT_STYLE: SubtitleStyle = {
  size: 'medium',
  color: 'white',
  box: false,
  boxOpacity: 0.6,
  edge: 'outline',
  position: 'bottom',
  font: 'sans',
  bold: false,
}

export const SIZES: ReadonlyArray<{ value: SubtitleSize; label: LabelKey; scale: number }> = [
  { value: 'small', label: 'sizeSmall', scale: 0.8 },
  { value: 'medium', label: 'sizeMedium', scale: 1 },
  { value: 'large', label: 'sizeLarge', scale: 1.25 },
  { value: 'xlarge', label: 'sizeXlarge', scale: 1.55 },
]

export const COLORS: ReadonlyArray<{ value: SubtitleColor; label: LabelKey; css: string }> = [
  { value: 'white', label: 'colourWhite', css: '#ffffff' },
  { value: 'yellow', label: 'colourYellow', css: '#ffe14d' },
  { value: 'cyan', label: 'colourCyan', css: '#72e6ff' },
  { value: 'green', label: 'colourGreen', css: '#8ef08e' },
  { value: 'pink', label: 'colourPink', css: '#ffa3d4' },
]

export const EDGES: ReadonlyArray<{ value: SubtitleEdge; label: LabelKey }> = [
  { value: 'outline', label: 'edgeOutline' },
  { value: 'shadow', label: 'edgeShadow' },
  { value: 'none', label: 'edgeNone' },
]

export const POSITIONS: ReadonlyArray<{
  value: SubtitlePosition
  label: LabelKey
  bottom: number
}> = [
  { value: 'bottom', label: 'positionBottom', bottom: 7 },
  { value: 'raised', label: 'positionRaised', bottom: 14 },
  { value: 'high', label: 'positionHigh', bottom: 24 },
]

export const FONTS: ReadonlyArray<{ value: SubtitleFont; label: LabelKey; css: string }> = [
  { value: 'sans', label: 'fontDefault', css: 'var(--mp-font-body)' },
  { value: 'serif', label: 'fontSerif', css: 'Georgia, "Times New Roman", serif' },
  {
    value: 'mono',
    label: 'fontTypewriter',
    css: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
]

export const BOX_OPACITIES: readonly number[] = [0.35, 0.6, 0.8, 1]

const pick = <T extends string>(list: ReadonlyArray<{ value: T }>, value: unknown, fallback: T) =>
  list.some((x) => x.value === value) ? (value as T) : fallback

/** A stored style read back; anything unknown or missing takes the default. */
export function readStyle(value: unknown): SubtitleStyle {
  const v = value != null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const opacity = typeof v.boxOpacity === 'number' ? v.boxOpacity : DEFAULT_STYLE.boxOpacity
  return {
    size: pick(SIZES, v.size, DEFAULT_STYLE.size),
    color: pick(COLORS, v.color, DEFAULT_STYLE.color),
    box: typeof v.box === 'boolean' ? v.box : DEFAULT_STYLE.box,
    boxOpacity: Math.min(1, Math.max(0.25, opacity)),
    edge: pick(EDGES, v.edge, DEFAULT_STYLE.edge),
    position: pick(POSITIONS, v.position, DEFAULT_STYLE.position),
    font: pick(FONTS, v.font, DEFAULT_STYLE.font),
    bold: typeof v.bold === 'boolean' ? v.bold : DEFAULT_STYLE.bold,
  }
}

/** One size up or down, staying within the four: what + and - do in the player. */
export function stepSize(size: SubtitleSize, direction: 1 | -1): SubtitleSize {
  const i = SIZES.findIndex((s) => s.value === size)
  return SIZES[Math.min(SIZES.length - 1, Math.max(0, i + direction))]!.value
}

/** How far up the picture the line sits, in percent of its height. */
export function positionPercent(position: SubtitlePosition): number {
  return POSITIONS.find((p) => p.value === position)?.bottom ?? 7
}

const EDGE_SHADOWS: Record<SubtitleEdge, string> = {
  // A ring of thin dark shadows reads as an outline at any size, in every browser.
  outline: [
    '0.05em 0 0 #000',
    '-0.05em 0 0 #000',
    '0 0.05em 0 #000',
    '0 -0.05em 0 #000',
    '0.035em 0.035em 0 #000',
    '-0.035em 0.035em 0 #000',
    '0.035em -0.035em 0 #000',
    '-0.035em -0.035em 0 #000',
    '0 0.06em 0.2em rgb(0 0 0 / 55%)',
  ].join(', '),
  shadow: '0.04em 0.07em 0.16em rgb(0 0 0 / 95%), 0 0 0.4em rgb(0 0 0 / 45%)',
  none: 'none',
}

/**
 * The caption's own look, as inline styles. [baseFont] is the size Medium draws at, a CSS length
 * that follows the player's width; the chosen size scales it.
 */
export function captionCss(style: SubtitleStyle, baseFont: string): CSSProperties {
  const scale = SIZES.find((s) => s.value === style.size)?.scale ?? 1
  return {
    fontSize: `calc(${baseFont} * ${scale})`,
    color: COLORS.find((c) => c.value === style.color)?.css ?? '#fff',
    fontFamily: FONTS.find((f) => f.value === style.font)?.css,
    fontWeight: style.bold ? 700 : 500,
    // With a box the edge would only blur its inside; the box does that job.
    textShadow: style.box ? 'none' : EDGE_SHADOWS[style.edge],
    backgroundColor: style.box
      ? `rgb(0 0 0 / ${Math.round(style.boxOpacity * 100)}%)`
      : 'transparent',
    padding: style.box ? '0.12em 0.5em' : '0 0.25em',
    borderRadius: style.box ? '0.25em' : undefined,
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  }
}

// ---- kept on this device, and shared live by every player and settings page ----------------

const KEY = 'subtitle-style-v1'
const listeners = new Set<() => void>()
let memory: SubtitleStyle | null = null
onStorageReset(() => {
  memory = null
})

function read(): SubtitleStyle {
  memory ??= readStyle(readJson(KEY))
  return memory
}

/**
 * The subtitle look, one for every player on the page. Your own settings page can show
 * `SubtitleStyleControls` over it, and every player redraws its captions at once.
 */
export const subtitleStyle = {
  get: read,
  set(change: Partial<SubtitleStyle>): SubtitleStyle {
    memory = readStyle({ ...read(), ...change })
    writeJson(KEY, memory)
    for (const listener of listeners) listener()
    return memory
  },
  reset(): SubtitleStyle {
    return this.set(DEFAULT_STYLE)
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

// ---- timing, per video ----------------------------------------------------------------------

/** One press of Earlier or Later, in seconds; and as far as either goes. */
export const DELAY_STEP = 0.1
export const DELAY_MAX = 10

const DELAYS_KEY = 'subtitle-delays-v1'
/** The newest this many videos keep their timing; a bad offset belongs to one release. */
const DELAYS_KEPT = 200

/** Snapped onto the step and held within the limit, so it never reads "+0.25 s". */
export function clampDelay(seconds: number): number {
  const snapped = Math.round(seconds / DELAY_STEP) * DELAY_STEP
  return Math.max(-DELAY_MAX, Math.min(DELAY_MAX, Number(snapped.toFixed(1))))
}

/** "+0.3 s", "-1.2 s", "0 s". */
export function delayLabel(seconds: number, t: Translate): string {
  if (seconds === 0) return t('delayNone')
  return t('delaySeconds', {
    value: `${seconds > 0 ? '+' : '-'}${Math.abs(seconds).toFixed(1)}`,
  })
}

function readDelays(): Array<[string, number]> {
  const stored = readJson(DELAYS_KEY)
  return Array.isArray(stored)
    ? stored.filter(
        (e): e is [string, number] =>
          Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number',
      )
    : []
}

/**
 * How much later (positive) or earlier this video's subtitles show, remembered per video: an
 * offset belongs to one release, and the next episode is as likely to be fine.
 */
export const subtitleDelays = {
  get(key: string): number {
    return clampDelay(readDelays().find(([k]) => k === key)?.[1] ?? 0)
  },
  set(key: string, seconds: number): void {
    const value = clampDelay(seconds)
    const rest = readDelays().filter(([k]) => k !== key)
    const next = value === 0 ? rest : [[key, value] as [string, number], ...rest]
    writeJson(DELAYS_KEY, next.slice(0, DELAYS_KEPT))
  },
}
