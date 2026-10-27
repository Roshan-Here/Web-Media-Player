// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useCallback, useEffect, useRef, useState } from 'react'
import { logDecoder as logPlayer } from 'web-buildin-decoder'
import { CueTrack, detectFormat, parseSubtitle, type SubtitleFormat } from '../lib/cues.js'
import type { MediaLike } from '../lib/engine.js'

/** A subtitle file to offer beside the video's own tracks. */
export interface SubtitleFile {
  /** What the Subtitles menu calls it: "English", "Español (SDH)". */
  label: string
  /** Its language code ("en", "spa"), for remembering the viewer's choice. */
  language?: string
  /** Where to fetch it (SRT, WebVTT, ASS or SSA). */
  src?: string
  /** Or its text, already loaded. */
  text?: string
  /** Read from `src` or the text when absent. */
  format?: SubtitleFormat
  /** Turned on when the video opens (unless the viewer chose otherwise last time). */
  default?: boolean
}

/** The id an external subtitle has in the Subtitles menu. */
export const externalId = (index: number) => `file:${index}`

/**
 * Subtitle files given to the player: loaded when chosen, and the line they put on screen.
 * The line follows the media's clock through `timeupdate` and seeks, and through an
 * animation-frame loop while playing, so it changes on the frame a cue starts.
 */
export function useExternalSubtitles({
  files,
  media,
  delay,
  onError,
}: {
  files: readonly SubtitleFile[] | undefined
  media: MediaLike | null
  /** Seconds the line shows later (earlier when negative). */
  delay: number
  onError: (file: SubtitleFile, error: unknown) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [track, setTrack] = useState<CueTrack | null>(null)
  const [caption, setCaption] = useState<string | null>(null)
  const cache = useRef(new Map<SubtitleFile, CueTrack>())
  /** The choice now, for loads that finish after another choice was made. */
  const current = useRef<number | null>(null)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  const select = useCallback(
    (index: number | null) => {
      current.current = index
      setSelected(index)
      setTrack(null)
      setCaption(null)
      const file = index === null ? null : files?.[index]
      if (!file) return
      const cached = cache.current.get(file)
      if (cached) {
        setTrack(cached)
        return
      }
      void (async () => {
        try {
          const text = file.text ?? (await fetchText(file.src))
          const cues = parseSubtitle(text, file.format ?? detectFormat(text, file.src))
          if (cues.length === 0) throw new Error('No subtitle lines in the file')
          const loaded = new CueTrack(cues)
          cache.current.set(file, loaded)
          if (current.current === index) setTrack(loaded)
          logPlayer('subtitle file loaded', { label: file.label, cues: cues.length })
        } catch (error) {
          logPlayer('subtitle file failed', { label: file.label, error }, 'warn')
          if (current.current === index) {
            current.current = null
            setSelected(null)
          }
          onErrorRef.current(file, error)
        }
      })()
    },
    [files],
  )

  // The line at the playhead.
  useEffect(() => {
    if (!media || !track) return
    let frame = 0
    const update = () => {
      const text = track.textAt(media.currentTime - delay)
      setCaption((shown) => (shown === text ? shown : text))
    }
    const tick = () => {
      update()
      frame = media.paused ? 0 : requestAnimationFrame(tick)
    }
    const start = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const stop = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      update()
    }
    const events: Array<[string, () => void]> = [
      ['timeupdate', update],
      ['seeking', update],
      ['seeked', update],
      ['play', start],
      ['playing', start],
      ['pause', stop],
      ['ended', stop],
    ]
    for (const [name, handler] of events) media.addEventListener(name, handler)
    update()
    if (!media.paused) start()
    return () => {
      for (const [name, handler] of events) media.removeEventListener(name, handler)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [media, track, delay])

  return {
    selected,
    select,
    caption: selected !== null ? caption : null,
  }
}

async function fetchText(src: string | undefined): Promise<string> {
  if (!src) throw new Error('The subtitle file has neither src nor text')
  const response = await fetch(src)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  // Most subtitle files are UTF-8; older SRTs are often Windows-1252, read when UTF-8 fails.
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
