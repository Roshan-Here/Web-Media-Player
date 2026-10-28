// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useCallback, useEffect, useRef, useState } from 'react'
import { fileSource, httpSource } from 'web-buildin-decoder'
import { CueTrack, parseSubtitle } from '../lib/cues.js'
import type { MediaLike } from '../lib/engine.js'
import { sourceFileName, type PlayerSource } from '../lib/source.js'
import { hashOfSource } from '../online/hash.js'
import { languagesFor } from '../online/languages.js'
import { cleanCaption, nameForParsing } from '../online/media-name.js'
import { rememberedLanguage, rememberLanguage, seriesKeyForName } from '../online/memory.js'
import type { SubtitleHit, SubtitleTarget, SubtitleText } from '../online/models.js'
import type { OnlineSubtitleService } from '../online/service.js'

/** The `onlineSubtitles` prop: where "Search online" looks, and what it looks for. */
export interface OnlineSubtitlesOptions {
  /** The service that searches: `createOnlineSubtitles(...)`, or your own. */
  service: OnlineSubtitleService
  /**
   * The name searched for ("The.Expanse.S02E03.1080p.mkv", "Arrival (2016)"). The file's name
   * is used when absent (unless it is a made-up one such as "video_2024-05-01.mp4"), then the
   * caption's first line, then the title.
   */
  name?: string
  /** Text posted with the video, read for the show, season and episode a file name lacks. */
  caption?: string | null
  /**
   * The languages to search, best first. When absent: the one last chosen for this show, the
   * browser's two first, then English.
   */
  languages?: readonly string[]
  /** For language names in the results; the browser's language when absent. */
  locale?: string
}

/** A subtitle found online and showing over the video. */
export interface AttachedSubtitle {
  label: string
  language: string
}

export interface OnlineSubtitleControls {
  /** Whether this player offers online subtitles at all. */
  available: boolean
  attached: AttachedSubtitle | null
  /** The attached subtitle's line at the playhead; null when none is showing. */
  caption: string | null
  panelOpen: boolean
  openPanel: () => void
  closePanel: () => void
  /** Stops showing the online subtitle (a file track or Off was chosen). */
  clear: () => void
  /** What the search is for: the video's name, its hash when both ends can be read, languages. */
  target: () => Promise<SubtitleTarget | null>
  /** Shows a downloaded subtitle; false when it holds no cue the player can show. */
  attach: (subtitle: SubtitleText, label: string, hit: SubtitleHit) => boolean
}

/**
 * The OpenSubtitles hash of the video, read without disturbing playback: through a side reader
 * of the viewer's own `open()` bytes (which shares what is already downloaded), or from the
 * file or URL directly. Null when that cannot be done quickly; the search then goes by name.
 */
async function hashOf(source: PlayerSource): Promise<string | null> {
  try {
    if (source.open) {
      const side = (await source.open()).createSideReader?.()
      return side ? await hashOfSource(side) : null
    }
    if (source.file) return await hashOfSource(fileSource(source.file))
    if (source.url) return await hashOfSource(await httpSource(source.url, source.http))
  } catch {
    // A search by name is the answer to every failure here.
  }
  return null
}

/**
 * The online subtitle of one playback: what to search for, the attached subtitle's cues, and
 * the line they put on screen. The line follows the media's clock through `timeupdate` and
 * seeks, and an animation-frame loop while playing, so it changes on the frame a cue starts.
 */
export function useOnlineSubtitle({
  options,
  media,
  source,
  title,
  delay,
}: {
  options: OnlineSubtitlesOptions | null | undefined
  media: MediaLike | null
  source: PlayerSource
  title: string | undefined
  /** Seconds the line shows later (earlier when negative), as the viewer set the timing. */
  delay: number
}): OnlineSubtitleControls {
  const [panelOpen, setPanelOpen] = useState(false)
  const [attached, setAttached] = useState<(AttachedSubtitle & { track: CueTrack }) | null>(null)
  const [caption, setCaption] = useState<string | null>(null)

  const latest = useRef({ options, source, title })
  useEffect(() => {
    latest.current = { options, source, title }
  })

  /** The name to parse and the caption beside it. */
  const nameOf = useCallback(() => {
    const { options: o, source: s, title: shown } = latest.current
    const text = cleanCaption(o?.caption) || null
    const name =
      o?.name?.trim() ||
      nameForParsing({ fileName: sourceFileName(s), caption: o?.caption ?? '', title: shown ?? '' })
    return { name, caption: text }
  }, [])

  const target = useCallback(async (): Promise<SubtitleTarget | null> => {
    const { name, caption: text } = nameOf()
    if (!name.trim()) return null
    const given = latest.current.options?.languages
    const languages = given?.length
      ? [...given]
      : languagesFor(rememberedLanguage(seriesKeyForName(name, text)))
    const hash = await hashOf(latest.current.source)
    return { name, caption: text, hash, languages }
  }, [nameOf])

  const attach = useCallback(
    (subtitle: SubtitleText, label: string, hit: SubtitleHit) => {
      const cues = parseSubtitle(subtitle.text, subtitle.extension)
      if (cues.length === 0) return false
      setAttached({ label, language: hit.language, track: new CueTrack(cues) })
      const { name, caption: text } = nameOf()
      rememberLanguage(seriesKeyForName(name, text), hit.language)
      return true
    },
    [nameOf],
  )

  const clear = useCallback(() => {
    setAttached(null)
    setCaption(null)
  }, [])

  // A new video starts without the last one's subtitle or panel.
  const key = source.key ?? source.url ?? source.file ?? null
  const [shownFor, setShownFor] = useState(key)
  if (shownFor !== key) {
    setShownFor(key)
    setAttached(null)
    setCaption(null)
    setPanelOpen(false)
  }

  // The line at the playhead.
  const track = attached?.track ?? null
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

  const available = Boolean(options?.service)
  return {
    available,
    attached: available && attached ? { label: attached.label, language: attached.language } : null,
    caption: available && attached ? caption : null,
    panelOpen: available && panelOpen,
    openPanel: useCallback(() => setPanelOpen(true), []),
    closePanel: useCallback(() => setPanelOpen(false), []),
    clear,
    target,
    attach,
  }
}
