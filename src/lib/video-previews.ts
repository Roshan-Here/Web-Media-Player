// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { logDecoder as logPlayer } from 'web-buildin-decoder'
import type { PreviewSource } from './engine.js'
import type { SourceUrl } from './source.js'

/** Width the stills are drawn at: the card is 176 CSS pixels, so this is sharp at 2x. */
const PREVIEW_WIDTH = 320
/** A seek on a slow link can take a while; past this the request is given up. */
const SEEK_TIMEOUT_MS = 12_000

export interface VideoPreviewOptions {
  /**
   * The address the preview video reads: playback's own, or one set up for previews alone. A
   * function is called on the first preview; null from it means no previews.
   */
  src: string | (() => SourceUrl | null)
  crossOrigin?: '' | 'anonymous' | 'use-credentials'
}

/**
 * Timeline previews for the browser decoder: a second, hidden `<video>` on the same file that
 * seeks to the asked time and is drawn to a small canvas. Nothing is loaded until the first
 * request. A video on another origin needs CORS (and `crossOrigin`) for the canvas to be read;
 * without it there are simply no stills.
 */
export function createVideoPreviews(
  options: VideoPreviewOptions,
): PreviewSource & { destroy(): void } {
  let video: HTMLVideoElement | null = null
  let canvas: HTMLCanvasElement | null = null
  let destroyed = false
  let target: SourceUrl | null | undefined

  const ensure = (): HTMLVideoElement | null => {
    if (video) return video
    if (target === undefined) {
      try {
        target = typeof options.src === 'string' ? { url: options.src } : options.src()
      } catch (error) {
        logPlayer('browser: previews unavailable', error, 'warn')
        target = null
      }
    }
    if (!target) return null
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'metadata'
    if (options.crossOrigin !== undefined) v.crossOrigin = options.crossOrigin
    v.setAttribute('aria-hidden', 'true')
    v.tabIndex = -1
    // Kept in the document (Safari does not decode frames for detached elements) but unseen.
    v.style.cssText =
      'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none'
    v.src = target.url
    document.body.append(v)
    video = v
    return v
  }

  return {
    prepare() {
      if (!destroyed) ensure()
    },
    async frame(time) {
      if (destroyed) return null
      const v = ensure()
      if (!v) return null
      try {
        if (v.readyState < HTMLMediaElement.HAVE_METADATA) await once(v, 'loadedmetadata')
        const target = Math.min(Math.max(0, time), Math.max(0, v.duration - 0.1))
        const seeked = once(v, 'seeked')
        // A keyframe seek where the browser has one: cheaper, and what the card shows anyway.
        if (typeof v.fastSeek === 'function') v.fastSeek(target)
        else v.currentTime = target
        await seeked
        if (destroyed || !v.videoWidth) return null
        canvas ??= document.createElement('canvas')
        canvas.width = PREVIEW_WIDTH
        canvas.height = Math.round((PREVIEW_WIDTH * v.videoHeight) / v.videoWidth)
        canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height)
        return await new Promise<Blob | null>((resolve) =>
          canvas!.toBlob(resolve, 'image/jpeg', 0.8),
        )
      } catch (error) {
        logPlayer('browser: preview failed', error, 'warn')
        return null
      }
    },
    destroy() {
      destroyed = true
      if (video) {
        video.removeAttribute('src')
        video.load()
        video.remove()
        video = null
      }
      target?.release?.()
      target = null
    },
  }
}

function once(target: HTMLMediaElement, type: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`No ${type} within ${SEEK_TIMEOUT_MS} ms`))
    }, SEEK_TIMEOUT_MS)
    const onDone = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error(target.error?.message || 'The preview video failed'))
    }
    const cleanup = () => {
      clearTimeout(timer)
      target.removeEventListener(type, onDone)
      target.removeEventListener('error', onError)
    }
    target.addEventListener(type, onDone, { once: true })
    target.addEventListener('error', onError, { once: true })
  })
}
