// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { logDecoder as logPlayer } from 'web-buildin-decoder'
import {
  Signal,
  languageName,
  type EngineFailure,
  type MediaEngine,
  type TrackList,
} from './engine.js'
import type { Translate } from './labels.js'
import { createVideoPreviews, type VideoPreviewOptions } from './video-previews.js'

export interface BrowserEngineOptions {
  host: HTMLElement
  /** What the `<video>` plays: a URL, or a blob URL made for a file. */
  src: string
  key: string
  /** Seconds to open at. */
  startAt?: number
  /** What timeline previews read: `src` when absent, none when false. */
  previewSrc?: VideoPreviewOptions['src'] | false
  /** Send cookies with a cross-origin `src`. */
  crossOrigin?: '' | 'anonymous' | 'use-credentials'
  t: Translate
}

/** Thrown when the browser decoder has nothing it can play (the source has no URL or file). */
export class EngineUnavailableError extends Error {}

interface AudioTrackLike {
  id: string
  label: string
  language: string
  enabled: boolean
}

/**
 * The browser's own `<video>`: lightest on battery, plays only what the browser decodes. Audio
 * tracks are listed where the browser exposes them (Safari); subtitles inside the file are not
 * available to it.
 */
export function createBrowserEngine(options: BrowserEngineOptions): MediaEngine {
  const { t } = options
  const video = document.createElement('video')
  video.playsInline = true
  // The player starts playback itself once the first frame is ready.
  video.preload = 'metadata'
  if (options.crossOrigin !== undefined) video.crossOrigin = options.crossOrigin
  video.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;background:#000'

  const tracksChanged = new Signal<[]>()
  const failed = new Signal<[EngineFailure]>()
  const audio = (
    video as HTMLVideoElement & { audioTracks?: ArrayLike<AudioTrackLike> & EventTarget }
  ).audioTracks

  const onError = () => {
    const error = video.error
    logPlayer('browser: failed', { code: error?.code, message: error?.message }, 'error')
    failed.emit(
      error?.code === MediaError.MEDIA_ERR_NETWORK
        ? { title: t('errorStoppedLoading'), message: t('errorConnectionDropped') }
        : { title: t('errorBrowserCannotPlay'), message: t('errorSwitchBuiltin') },
    )
  }
  const onMetadata = () => {
    if (options.startAt && options.startAt > 0 && options.startAt < video.duration)
      video.currentTime = options.startAt
    logPlayer('browser: opened', {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    })
    tracksChanged.emit()
  }
  const onTrackList = () => tracksChanged.emit()
  video.addEventListener('error', onError)
  video.addEventListener('loadedmetadata', onMetadata)
  audio?.addEventListener('change', onTrackList)

  options.host.appendChild(video)
  video.src = options.src
  logPlayer('browser: loading', { key: options.key })

  const previews =
    options.previewSrc === false
      ? null
      : createVideoPreviews({
          src: options.previewSrc ?? options.src,
          crossOrigin: options.crossOrigin,
        })

  return {
    kind: 'browser',
    media: video,
    audioTracks(): TrackList {
      const list = audio ? Array.from(audio) : []
      return {
        options: list.map((track, i) => ({
          id: track.id,
          label: track.label || languageName(track.language) || t('trackN', { n: i + 1 }),
          language: track.language || null,
          detail: null,
          selectable: true,
        })),
        selected: list.find((track) => track.enabled)?.id ?? null,
      }
    },
    subtitleTracks: () => ({ options: [], selected: null }),
    // The browser's own decoder reads no chapters, and shows no subtitles of the file's own.
    chapters: () => [],
    setSubtitleDelay: () => undefined,
    selectAudio(id) {
      for (const track of audio ? Array.from(audio) : []) track.enabled = track.id === id
      tracksChanged.emit()
    },
    selectSubtitle() {},
    onTracks: (listener) => tracksChanged.add(listener),
    onCaption: () => () => undefined,
    onFailure: (listener) => failed.add(listener),
    captureStream: () => {
      const capture = (video as HTMLVideoElement & { captureStream?: () => MediaStream })
        .captureStream
      try {
        return capture ? capture.call(video) : null
      } catch (error) {
        logPlayer('browser: picture capture failed', error, 'warn')
        return null
      }
    },
    video,
    showPictureIn(container) {
      // The element itself moves into the window: the browser keeps decoding it there whatever
      // happens to this tab, with nothing captured or copied. A media element moved between
      // documents in one step keeps playing.
      const home = video.parentElement
      container.append(video)
      let restored = false
      return () => {
        if (restored) return
        restored = true
        if (home?.isConnected) home.append(video)
        else video.remove()
      }
    },
    // The browser keeps decoding a <video> it shows in its own picture in picture.
    keepPictureAlive: () => () => undefined,
    previews,
    destroy() {
      previews?.destroy()
      video.removeEventListener('error', onError)
      video.removeEventListener('loadedmetadata', onMetadata)
      audio?.removeEventListener('change', onTrackList)
      video.pause()
      video.removeAttribute('src')
      video.load()
      video.remove()
      tracksChanged.clear()
      failed.clear()
    },
  }
}
