// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useRef, useState } from 'react'

/** A wait for data shows the spinner only once it has lasted this long. */
export const SPINNER_AFTER_MS = 700
/** Once shown, the spinner stays at least this long, so it never blinks. */
export const SPINNER_AT_LEAST_MS = 600

/**
 * [on], steadied: true only once [on] has held for [showAfterMs], and then kept for at least
 * [atLeastMs]. A skip into what is already downloaded (the decoder finds the keyframe and
 * decodes up to the new time in about half a second) shows nothing, and a longer wait one
 * steady spinner rather than a flicker.
 */
export function useSteady(
  on: boolean,
  showAfterMs = SPINNER_AFTER_MS,
  atLeastMs = SPINNER_AT_LEAST_MS,
): boolean {
  const [shown, setShown] = useState(false)
  const since = useRef(0)
  useEffect(() => {
    if (on && !shown) {
      const timer = setTimeout(() => {
        since.current = Date.now()
        setShown(true)
      }, showAfterMs)
      return () => clearTimeout(timer)
    }
    if (!on && shown) {
      const left = Math.max(0, since.current + atLeastMs - Date.now())
      const timer = setTimeout(() => setShown(false), left)
      return () => clearTimeout(timer)
    }
  }, [on, shown, showAfterMs, atLeastMs])
  return shown
}
