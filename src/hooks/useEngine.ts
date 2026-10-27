// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  createBuiltinDecoder,
  logDecoder as logPlayer,
  preloadDecoder,
  type ByteSource,
} from 'web-buildin-decoder'
import { PlayWhenReady } from '../lib/autoplay.js'
import { createBrowserEngine, EngineUnavailableError } from '../lib/browser-engine.js'
import {
  sameLanguage,
  setMedia,
  type EngineFailure,
  type EngineKind,
  type MediaEngine,
  type TrackList,
} from '../lib/engine.js'
import type { Translate } from '../lib/labels.js'
import { readPrefs, writePrefs } from '../lib/prefs.js'
import { openBytes, sourceKey, type PlayerSource } from '../lib/source.js'

import type { LoaderPhase } from '../components/PlayerLoader.js'

export type EngineStatus =
  { kind: 'loading' } | { kind: 'ready' } | { kind: 'failed'; failure: EngineFailure }

export interface EngineOptions {
  surfaceRef: RefObject<HTMLDivElement | null>
  source: PlayerSource
  /** Seconds to open at, the first time. */
  startAt: number
  browserCanPlay: boolean
  /** The decoder to start with; the remembered one (or built-in) when absent. */
  initialDecoder?: EngineKind
  /** Start playing as soon as there is a frame. */
  autoPlay: boolean
  /** Turn on the subtitles in the language chosen last time. */
  rememberTracks: boolean
  /** Where movi.wasm is served from, when the bundler does not emit it. */
  wasmUrl?: string
  t: Translate
  onProgress?: (position: number, duration: number) => void
}

const emptyTracks: TrackList = { options: [], selected: null }

/**
 * Runs one decoder at a time for the player: starts it at the right position, starts playback
 * (muted if the browser refuses sound), keeps track lists and captions, and falls back to the
 * other decoder when one cannot start. Switching decoder or retrying starts a fresh engine from
 * where playback was. A new source starts over.
 */
export function useEngine({
  surfaceRef,
  source,
  startAt,
  browserCanPlay,
  initialDecoder,
  autoPlay,
  rememberTracks,
  wasmUrl,
  t,
  onProgress,
}: EngineOptions) {
  const key = sourceKey(source)
  const [chosen, setDecoderState] = useState<EngineKind>(
    () => initialDecoder ?? readPrefs().decoder,
  )
  /** The browser decoder only for what it can play; anything else opens in the built-in one. */
  const decoder: EngineKind = chosen === 'browser' && !browserCanPlay ? 'builtin' : chosen
  const [attempt, setAttempt] = useState(0)
  const [engine, setEngine] = useState<MediaEngine | null>(null)
  const [status, setStatus] = useState<EngineStatus>({ kind: 'loading' })
  const [phase, setPhase] = useState<LoaderPhase>('file')
  const [caption, setCaption] = useState<string | null>(null)
  const [audio, setAudio] = useState<TrackList>(emptyTracks)
  const [subtitles, setSubtitles] = useState<TrackList>(emptyTracks)
  const [notice, setNotice] = useState<string | null>(null)
  /** Playing muted because the browser refused sound; the player offers to turn it on. */
  const [soundBlocked, setSoundBlocked] = useState(false)

  // Values the engine effect reads without restarting when they change.
  const latest = useRef({
    source,
    startAt,
    onProgress,
    browserCanPlay,
    autoPlay,
    rememberTracks,
    wasmUrl,
    t,
  })
  useEffect(() => {
    latest.current = {
      source,
      startAt,
      onProgress,
      browserCanPlay,
      autoPlay,
      rememberTracks,
      wasmUrl,
      t,
    }
  })
  /** Where playback is, so a decoder switch or a retry carries on from there. */
  const position = useRef<{ key: string; at: number } | null>(null)
  /** The opened bytes of this source, kept across decoder switches and retries. */
  const opened = useRef<{ key: string; bytes: Promise<ByteSource> } | null>(null)

  const report = useCallback((target: MediaEngine | null) => {
    const m = target?.media
    if (!m) return
    const d = m.duration
    if (Number.isFinite(d) && d > 0 && m.currentTime > 0)
      latest.current.onProgress?.(m.currentTime, d)
  }, [])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    let cancelled = false
    let created: MediaEngine | null = null
    let objectUrl: string | null = null
    const unsubscribe: Array<() => void> = []
    setStatus({ kind: 'loading' })
    setPhase('file')
    setEngine(null)
    setCaption(null)
    setAudio(emptyTracks)
    setSubtitles(emptyTracks)
    setSoundBlocked(false)

    void (async () => {
      const { source: src, browserCanPlay: nativeOk, t: tr } = latest.current
      const from = position.current?.key === key ? position.current.at : latest.current.startAt
      try {
        let next: MediaEngine
        if (decoder === 'builtin') {
          // The decoder loads while the file opens, not after it.
          void preloadDecoder({ wasmUrl: latest.current.wasmUrl })
          if (opened.current?.key !== key) opened.current = { key, bytes: openBytes(src) }
          const pending = opened.current
          const bytes = await pending.bytes.catch((error: unknown) => {
            // A failed open is tried again next time.
            if (opened.current === pending) opened.current = null
            throw error
          })
          if (cancelled) return
          setPhase('decoder')
          next = await createBuiltinDecoder({
            host: surface,
            source: bytes,
            key,
            isPermanent: src.isPermanent,
            startAt: from,
            wasmUrl: latest.current.wasmUrl,
            messages: {
              didNotPlay: tr('errorDidNotPlay'),
              decoderStopped: tr('errorDecoderStopped'),
              readFailed: (reason) => tr('errorReadFailed', { reason }),
              audioTrack: (n) => tr('trackN', { n }),
              subtitleTrack: (n) => tr('subtitleTrackN', { n }),
              codecUnsupported: (codec) => tr('codecUnsupported', { codec }),
              timedText: tr('codecTimedText'),
              mono: tr('channelsMono'),
              stereo: tr('channelsStereo'),
              channels: (count) => tr('channelsCount', { count }),
            },
          })
        } else {
          let url = src.url
          if (!url && src.file) url = objectUrl = URL.createObjectURL(src.file)
          if (!url) throw new EngineUnavailableError('The browser decoder needs a url or a file')
          setPhase('decoder')
          next = createBrowserEngine({
            host: surface,
            src: url,
            key,
            startAt: from,
            crossOrigin: src.http?.credentials === 'include' ? 'use-credentials' : undefined,
            t: tr,
          })
        }
        if (cancelled) {
          next.destroy()
          return
        }
        created = next
        const prefs = readPrefs()
        next.media.volume = prefs.volume
        next.media.muted = prefs.muted

        // Play as soon as there is a frame, already at the resume position, and keep at it
        // until playback has started: the decoder's own seek or a switch to software decoding
        // can interrupt the first attempt.
        if (latest.current.autoPlay) {
          const start = new PlayWhenReady(next.media, {
            onStarted: (result) => {
              if (cancelled) return
              setPhase('started')
              logPlayer(`${decoder}: autoplay ${result}`, { at: next.media.currentTime })
              setSoundBlocked(result === 'muted')
            },
          })
          unsubscribe.push(() => start.cancel())
        } else {
          const onPlaying = () => setPhase('started')
          next.media.addEventListener('playing', onPlaying, { once: true })
          unsubscribe.push(() => next.media.removeEventListener('playing', onPlaying))
        }

        let languagesApplied = false
        const refreshTracks = () => {
          const audioList = next.audioTracks()
          const subtitleList = next.subtitleTracks()
          if (
            !languagesApplied &&
            (audioList.options.length > 0 || subtitleList.options.length > 0)
          ) {
            languagesApplied = true
            if (latest.current.rememberTracks) applyLanguagePrefs(next, audioList, subtitleList)
          }
          setAudio(next.audioTracks())
          setSubtitles(next.subtitleTracks())
        }
        unsubscribe.push(next.onTracks(refreshTracks))
        unsubscribe.push(next.onCaption(setCaption))
        unsubscribe.push(next.onFailure((failure) => setStatus({ kind: 'failed', failure })))
        setEngine(next)
        setStatus({ kind: 'ready' })
        setPhase((was) => (was === 'started' ? was : 'frame'))
        refreshTracks()
      } catch (error) {
        if (cancelled) return
        logPlayer(`${decoder}: could not start`, error, 'error')
        if (decoder === 'builtin' && nativeOk && !(error instanceof EngineUnavailableError)) {
          setNotice(tr('noticeBuiltinFailed'))
          setDecoderState('browser')
          return
        }
        if (decoder === 'browser' && error instanceof EngineUnavailableError) {
          setNotice(tr('noticeBrowserUnavailable'))
          setDecoderState('builtin')
          return
        }
        setStatus({
          kind: 'failed',
          failure: {
            title: tr('errorDidNotOpen'),
            message: error instanceof Error ? error.message : tr('errorOpenGeneric'),
          },
        })
      }
    })()

    return () => {
      cancelled = true
      if (created) {
        const at = created.media.currentTime
        if (at > 0) position.current = { key, at }
        report(created)
      }
      for (const off of unsubscribe) off()
      created?.destroy()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [decoder, attempt, key, surfaceRef, report])

  // Save progress every few seconds while playing, and when playback pauses or ends.
  useEffect(() => {
    const media = engine?.media
    if (!media) return
    let last = 0
    const onTime = () => {
      const now = Date.now()
      if (now - last >= 5000) {
        last = now
        report(engine)
      }
    }
    const onStop = () => report(engine)
    const onHide = () => {
      if (document.visibilityState === 'hidden') report(engine)
    }
    const onVolume = () => {
      writePrefs({ volume: media.volume, muted: media.muted })
      if (!media.muted) setSoundBlocked(false)
    }
    media.addEventListener('timeupdate', onTime)
    media.addEventListener('pause', onStop)
    media.addEventListener('ended', onStop)
    media.addEventListener('volumechange', onVolume)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onStop)
    return () => {
      media.removeEventListener('timeupdate', onTime)
      media.removeEventListener('pause', onStop)
      media.removeEventListener('ended', onStop)
      media.removeEventListener('volumechange', onVolume)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onStop)
    }
  }, [engine, report])

  const selectSubtitle = useCallback(
    (id: string | null, language?: string | null) => {
      if (engine) {
        engine.selectSubtitle(id)
        setSubtitles(engine.subtitleTracks())
      }
      const chosen = id ? engine?.subtitleTracks().options.find((o) => o.id === id) : null
      writePrefs({
        subtitleLanguage: language !== undefined ? language : (chosen?.language ?? null),
      })
    },
    [engine],
  )

  const selectAudio = useCallback(
    (id: string) => {
      if (!engine) return
      engine.selectAudio(id)
      const chosen = engine.audioTracks().options.find((o) => o.id === id)
      if (chosen?.language) writePrefs({ audioLanguage: chosen.language })
      setAudio(engine.audioTracks())
    },
    [engine],
  )

  const setDecoder = useCallback((next: EngineKind) => {
    writePrefs({ decoder: next })
    setNotice(null)
    setDecoderState(next)
  }, [])

  const unmute = useCallback(() => {
    if (!engine) return
    setMedia(engine.media, { muted: false, volume: engine.media.volume === 0 ? 1 : undefined })
    setSoundBlocked(false)
  }, [engine])

  return {
    key,
    decoder,
    setDecoder,
    retry: () => setAttempt((n) => n + 1),
    engine,
    status,
    phase,
    caption,
    audio,
    subtitles,
    selectAudio,
    selectSubtitle,
    notice,
    setNotice,
    soundBlocked,
    unmute,
  }
}

/** Picks the audio and subtitle languages chosen last time, where this file has them. */
function applyLanguagePrefs(engine: MediaEngine, audio: TrackList, subtitles: TrackList) {
  const prefs = readPrefs()
  const audioMatch = prefs.audioLanguage
    ? audio.options.find((o) => sameLanguage(o.language, prefs.audioLanguage))
    : undefined
  if (audioMatch && audioMatch.id !== audio.selected) engine.selectAudio(audioMatch.id)
  const subtitleMatch = prefs.subtitleLanguage
    ? subtitles.options.find(
        (o) => o.selectable && sameLanguage(o.language, prefs.subtitleLanguage),
      )
    : undefined
  if (subtitleMatch) engine.selectSubtitle(subtitleMatch.id)
}
