// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PictureFrame, SubPicture } from 'web-buildin-decoder'
import { asFiled, boxOf, inColour, placePictures, type PlacedPicture } from '../lib/picture-look.js'
import { DEFAULT_STYLE, type SubtitleStyle } from '../lib/subtitle-style.js'

/**
 * Picture subtitles (PGS, VobSub, DVB) over the video, as VLC shows them: the pictures where the
 * file puts them on its own canvas (the size of the video it was made for), that canvas scaled
 * onto the picture as it is shown, letterboxing and all. The viewer's look applies as far as a
 * picture allows (picture-look.ts): its size, how high it sits, a dark box and the colour of plain text.
 * With the default look the pictures are drawn exactly as the file has them.
 */
export function PictureSubtitles({
  frame,
  videoWidth,
  videoHeight,
  controlsShown = false,
  look = DEFAULT_STYLE,
}: {
  frame: PictureFrame
  /** The video's size, for where its picture sits in the player; 0 when not known yet. */
  videoWidth: number
  videoHeight: number
  /**
   * The player's controls are over the bottom of the picture: subtitles that low move up above
   * them while they show, as the text ones do, rather than hide under them.
   */
  controlsShown?: boolean
  /** The viewer's subtitle look. */
  look?: SubtitleStyle
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = boxRef.current
    if (!element) return
    const measure = () => setBox({ width: element.clientWidth, height: element.clientHeight })
    measure()
    // The picture-in-picture window is a document of its own: watch it with its own observer.
    const Observer =
      (element.ownerDocument.defaultView as (Window & typeof globalThis) | null)?.ResizeObserver ??
      (typeof ResizeObserver === 'undefined' ? null : ResizeObserver)
    if (!Observer) return
    const observer = new Observer(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Where the pictures go with this look; null for the default look, drawn as filed.
  const placed = useMemo(() => (asFiled(look) ? null : placePictures(frame, look)), [frame, look])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    if (canvas.width !== frame.canvasWidth) canvas.width = frame.canvasWidth
    if (canvas.height !== frame.canvasHeight) canvas.height = frame.canvasHeight
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (!placed) {
      for (const picture of frame.pictures) {
        if (picture.width <= 0 || picture.height <= 0) continue
        context.putImageData(
          new ImageData(new Uint8ClampedArray(picture.rgba), picture.width, picture.height),
          picture.x,
          picture.y,
        )
      }
      return
    }
    const shown = placed.filter((p) => p.picture.width > 0 && p.picture.height > 0)
    if (look.box) {
      context.fillStyle = `rgba(0, 0, 0, ${look.boxOpacity})`
      for (const p of shown) {
        const b = boxOf(p, frame)
        context.beginPath()
        if (typeof context.roundRect === 'function')
          context.roundRect(b.x, b.y, b.width, b.height, b.radius)
        else context.rect(b.x, b.y, b.width, b.height)
        context.fill()
      }
    }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    for (const p of shown) {
      context.drawImage(
        sourceOf(inColour(p.picture, look.color), canvas.ownerDocument),
        p.x,
        p.y,
        p.picture.width * p.scale,
        p.picture.height * p.scale,
      )
    }
  }, [frame, placed, look.box, look.boxOpacity, look.color])

  const rect = pictureRect(box, videoWidth || frame.canvasWidth, videoHeight || frame.canvasHeight)
  const lift = controlsShown ? liftAbove(placed ? shownFrame(frame, placed) : frame, rect, box) : 0
  return (
    <div ref={boxRef} className="mp:pointer-events-none mp:absolute mp:inset-0" aria-hidden="true">
      {frame.canvasWidth > 0 && frame.canvasHeight > 0 ? (
        <canvas
          ref={canvasRef}
          data-player-picture-subtitle=""
          className="mp:absolute mp:transition-transform mp:duration-200 mp:ease-soft"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            transform: lift > 0 ? `translateY(${-lift}px)` : undefined,
          }}
        />
      ) : null}
    </div>
  )
}

const sources = new WeakMap<SubPicture, HTMLCanvasElement>()

/** A picture as something drawImage can scale: made once per picture (and colour). */
function sourceOf(picture: SubPicture, document: Document): HTMLCanvasElement {
  const known = sources.get(picture)
  if (known) return known
  const canvas = document.createElement('canvas')
  canvas.width = picture.width
  canvas.height = picture.height
  canvas
    .getContext('2d')
    ?.putImageData(
      new ImageData(new Uint8ClampedArray(picture.rgba), picture.width, picture.height),
      0,
      0,
    )
  sources.set(picture, canvas)
  return canvas
}

/** The frame as the look places it, for how far it has to move up to clear the controls. */
function shownFrame(frame: PictureFrame, placed: PlacedPicture[]): PictureFrame {
  return {
    ...frame,
    pictures: placed.map((p) => ({
      ...p.picture,
      x: p.x,
      y: p.y,
      width: p.picture.width * p.scale,
      height: p.picture.height * p.scale,
    })),
  }
}

/** Where a video of [width] × [height] shows inside [box], fitted whole and centred. */
export function pictureRect(
  box: { width: number; height: number },
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  if (box.width <= 0 || box.height <= 0 || width <= 0 || height <= 0)
    return { x: 0, y: 0, width: box.width, height: box.height }
  const scale = Math.min(box.width / width, box.height / height)
  const w = width * scale
  const h = height * scale
  return { x: (box.width - w) / 2, y: (box.height - h) / 2, width: w, height: h }
}

/** The controls' height over the picture: as the text subtitles allow for (Player). */
const CONTROLS_HEIGHT = 96
const CONTROLS_HEIGHT_NARROW = 84
const NARROW = 520

/**
 * How far the pictures have to move up to clear the controls (and 2% more, as the text ones
 * do): 0 when they are above them already.
 */
export function liftAbove(
  frame: PictureFrame,
  rect: { y: number; height: number },
  box: { width: number; height: number },
): number {
  if (frame.canvasHeight <= 0 || frame.pictures.length === 0) return 0
  const scale = rect.height / frame.canvasHeight
  const lowest = rect.y + Math.max(...frame.pictures.map((p) => p.y + p.height)) * scale
  const controls = box.width <= NARROW ? CONTROLS_HEIGHT_NARROW : CONTROLS_HEIGHT
  const limit = box.height - controls - box.height * 0.02
  return Math.max(0, Math.round(lowest - limit))
}
