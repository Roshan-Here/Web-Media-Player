// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { readJson, writeJson } from '../lib/storage.js'

/*
 * A panel over the picture that can be moved out of the way by its title bar, so the subtitles
 * it changes stay in view while it is open. It moves inside the player only, and where it was
 * put is kept (for every video, with the viewer's settings) until it is put back with a double click on the bar.
 */

export interface Offset {
  x: number
  y: number
}

const ZERO: Offset = { x: 0, y: 0 }

/** [offset] moved as little as it takes for [panel] to stay inside [bounds]. */
export function clampOffset(
  offset: Offset,
  panel: { left: number; top: number; width: number; height: number },
  bounds: { left: number; top: number; width: number; height: number },
  margin = 8,
): Offset {
  // Where the panel would be with no offset.
  const baseLeft = panel.left
  const baseTop = panel.top
  const minX = bounds.left + margin - baseLeft
  const maxX = bounds.left + bounds.width - margin - panel.width - baseLeft
  const minY = bounds.top + margin - baseTop
  const maxY = bounds.top + bounds.height - margin - panel.height - baseTop
  const clamp = (v: number, lo: number, hi: number) =>
    hi < lo ? lo : Math.min(hi, Math.max(lo, v))
  return { x: Math.round(clamp(offset.x, minX, maxX)), y: Math.round(clamp(offset.y, minY, maxY)) }
}

function readStored(key: string): Offset {
  const value = readJson(key) as Partial<Offset> | undefined
  if (value && Number.isFinite(value.x) && Number.isFinite(value.y))
    return { x: value.x!, y: value.y! }
  return ZERO
}

function store(key: string, offset: Offset): void {
  // Kept with the viewer's other settings (configureStorage), or for this time only.
  writeJson(key, offset.x === 0 && offset.y === 0 ? null : offset)
}

/**
 * Drag for [panelRef] by the element given `handleProps`, inside its offset parent (the
 * player). Returns the transform to draw it with and the bar's handlers.
 */
export function useDragPanel(panelRef: RefObject<HTMLElement | null>, storageKey: string) {
  const [offset, setOffset] = useState<Offset>(() => readStored(storageKey))
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ id: number; startX: number; startY: number; from: Offset } | null>(null)

  // The offset the panel is drawn with now, to take it back out of what the page measures.
  const applied = useRef(offset)
  useLayoutEffect(() => {
    applied.current = offset
  }, [offset])

  /** The panel's box without the offset, and the player's, in the viewport. */
  const boxes = useCallback(() => {
    const panel = panelRef.current
    const parent = panel?.offsetParent as HTMLElement | null
    if (!panel || !parent) return null
    const rect = panel.getBoundingClientRect()
    const { x, y } = applied.current
    return {
      panel: { left: rect.left - x, top: rect.top - y, width: rect.width, height: rect.height },
      bounds: parent.getBoundingClientRect(),
    }
  }, [panelRef])

  // Kept inside the player when it changes size (full screen, a turned phone).
  useLayoutEffect(() => {
    const panel = panelRef.current
    const parent = panel?.offsetParent as HTMLElement | null
    if (!panel || !parent) return
    const fit = () => {
      const b = boxes()
      if (!b) return
      setOffset((now) => {
        const fitted = clampOffset(now, b.panel, b.bounds)
        return fitted.x === now.x && fitted.y === now.y ? now : fitted
      })
    }
    fit()
    const Observer =
      (panel.ownerDocument.defaultView as (Window & typeof globalThis) | null)?.ResizeObserver ??
      (typeof ResizeObserver === 'undefined' ? null : ResizeObserver)
    if (!Observer) return
    const observer = new Observer(fit)
    observer.observe(parent)
    // And when the panel itself grows, as fields come and go.
    observer.observe(panel)
    return () => observer.disconnect()
  }, [panelRef, boxes])

  useEffect(() => {
    if (!dragging) store(storageKey, offset)
  }, [dragging, offset, storageKey])

  const handleProps = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      // The bar's own buttons (close) still click.
      if ((event.target as HTMLElement).closest('button, a, input, [role="radio"]')) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        from: offset,
      }
      setDragging(true)
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const now = drag.current
      if (!now || now.id !== event.pointerId) return
      const b = boxes()
      if (!b) return
      const wanted = {
        x: now.from.x + event.clientX - now.startX,
        y: now.from.y + event.clientY - now.startY,
      }
      setOffset(clampOffset(wanted, b.panel, b.bounds))
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      if (drag.current?.id !== event.pointerId) return
      drag.current = null
      setDragging(false)
    },
    onPointerCancel: () => {
      drag.current = null
      setDragging(false)
    },
    onDoubleClick: (event: React.MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest('button')) return
      setOffset(ZERO)
    },
  }

  return {
    style:
      offset.x !== 0 || offset.y !== 0
        ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
        : undefined,
    dragging,
    moved: offset.x !== 0 || offset.y !== 0,
    handleProps,
  }
}
