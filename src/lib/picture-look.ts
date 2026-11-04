// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import {
  COLORS,
  SIZES,
  positionPercent,
  type SubtitleColor,
  type SubtitleStyle,
} from './subtitle-style.js'
import type { PictureFrame, SubPicture } from 'web-buildin-decoder'

/*
 * The viewer's subtitle look, as far as a picture subtitle can take it. The file draws these
 * itself, so the typeface, the edge and the weight are part of the picture and stay as they are;
 * what can follow the viewer's choice is how big they are, how high they sit, a dark box behind
 * them and, for the usual white text with a dark outline, its colour.
 */

/** A picture where it is drawn on the subtitle canvas, at [scale] times its own size. */
export interface PlacedPicture {
  picture: SubPicture
  x: number
  y: number
  scale: number
}

/** Where the default position, Bottom, puts text: picture subtitles are made to sit about there. */
const BOTTOM = positionPercent('bottom')

export function sizeScale(style: SubtitleStyle): number {
  return SIZES.find((s) => s.value === style.size)?.scale ?? 1
}

/**
 * Where each picture goes with the viewer's size and position. Pictures in the lower half of the
 * canvas (the dialogue) grow from their bottom centre, as text does, and move up by as much as
 * the chosen position moves text; ones in the upper half (signs, a second speaker at the top)
 * grow from their top centre and stay where the file put them. Nothing leaves the canvas.
 */
export function placePictures(frame: PictureFrame, style: SubtitleStyle): PlacedPicture[] {
  const scale = sizeScale(style)
  const lift = ((positionPercent(style.position) - BOTTOM) / 100) * frame.canvasHeight
  const middle = frame.canvasHeight / 2
  const lower = frame.pictures.filter((p) => p.y + p.height / 2 >= middle)
  const upper = frame.pictures.filter((p) => p.y + p.height / 2 < middle)
  return [
    ...placeGroup(upper, scale, 'top', 0, frame),
    ...placeGroup(lower, scale, 'bottom', lift, frame),
  ]
}

function placeGroup(
  group: SubPicture[],
  scale: number,
  anchor: 'top' | 'bottom',
  lift: number,
  frame: PictureFrame,
): PlacedPicture[] {
  if (group.length === 0) return []
  const left = Math.min(...group.map((p) => p.x))
  const right = Math.max(...group.map((p) => p.x + p.width))
  const top = Math.min(...group.map((p) => p.y))
  const bottom = Math.max(...group.map((p) => p.y + p.height))
  const cx = (left + right) / 2
  const ay = anchor === 'bottom' ? bottom : top
  const placed = group.map((picture) => ({
    picture,
    scale,
    x: cx + (picture.x - cx) * scale,
    y: ay + (picture.y - ay) * scale - lift,
  }))
  // Kept inside the canvas: a large size at the edge moves in rather than being cut off.
  const minX = cx + (left - cx) * scale
  const maxX = cx + (right - cx) * scale
  const minY = ay + (top - ay) * scale - lift
  const maxY = ay + (bottom - ay) * scale - lift
  const dx =
    maxX - minX > frame.canvasWidth
      ? frame.canvasWidth / 2 - (minX + maxX) / 2
      : Math.max(0, -minX) - Math.max(0, maxX - frame.canvasWidth)
  const dy =
    maxY - minY > frame.canvasHeight
      ? frame.canvasHeight / 2 - (minY + maxY) / 2
      : Math.max(0, -minY) - Math.max(0, maxY - frame.canvasHeight)
  return dx === 0 && dy === 0 ? placed : placed.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
}

/** Whether the look changes nothing, so the pictures are drawn exactly as the file has them. */
export function asFiled(style: SubtitleStyle): boolean {
  return (
    sizeScale(style) === 1 && style.position === 'bottom' && !style.box && style.color === 'white'
  )
}

/** The dark box behind a placed picture, on the canvas: a little wider than the picture. */
export function boxOf(placed: PlacedPicture, frame: PictureFrame) {
  const pad = Math.max(4, Math.round(frame.canvasHeight * 0.012 * placed.scale))
  return {
    x: placed.x - pad,
    y: placed.y - pad / 2,
    width: placed.picture.width * placed.scale + pad * 2,
    height: placed.picture.height * placed.scale + pad,
    radius: pad,
  }
}

/**
 * Whether a picture is ordinary subtitle text: light letters with a dark edge and next to no
 * colour. Only those are recoloured; a coloured sign, karaoke or a logo keeps its colours.
 */
export function isPlainText(picture: SubPicture): boolean {
  const { rgba } = picture
  let opaque = 0
  let grey = 0
  let light = 0
  // Every fourth pixel is plenty to tell, and keeps a full-width line quick.
  for (let i = 0; i < rgba.length; i += 16) {
    if (rgba[i + 3]! < 128) continue
    opaque++
    const r = rgba[i]!
    const g = rgba[i + 1]!
    const b = rgba[i + 2]!
    if (Math.max(r, g, b) - Math.min(r, g, b) < 48) grey++
    if (0.2126 * r + 0.7152 * g + 0.0722 * b > 170) light++
  }
  return opaque > 0 && grey / opaque >= 0.92 && light / opaque >= 0.05
}

function rgbOf(color: SubtitleColor): [number, number, number] {
  const hex = COLORS.find((c) => c.value === color)?.css ?? '#ffffff'
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const tinted = new WeakMap<SubPicture, Map<SubtitleColor, SubPicture>>()

/**
 * The picture in the viewer's colour: the light letters take it, keeping their shading, and the
 * dark edge stays dark. White, or a picture that is not plain text, comes back as it is. Made
 * once per picture and colour.
 */
export function inColour(picture: SubPicture, color: SubtitleColor): SubPicture {
  if (color === 'white' || !isPlainText(picture)) return picture
  let byColour = tinted.get(picture)
  if (!byColour) tinted.set(picture, (byColour = new Map()))
  const known = byColour.get(color)
  if (known) return known
  const [tr, tg, tb] = rgbOf(color)
  const src = picture.rgba
  const out = new Uint8ClampedArray(src.length)
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i]!
    const g = src[i + 1]!
    const b = src[i + 2]!
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    // From the edge (dark, kept) to the letters (light, recoloured), smoothly in between.
    const w = Math.min(1, Math.max(0, (luma - 96) / 96))
    const k = luma / 255
    out[i] = r + (tr * k - r) * w
    out[i + 1] = g + (tg * k - g) * w
    out[i + 2] = b + (tb * k - b) * w
    out[i + 3] = src[i + 3]!
  }
  const result = { ...picture, rgba: out }
  byColour.set(color, result)
  return result
}
