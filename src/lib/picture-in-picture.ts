// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/**
 * Picture in picture: a small always-on-top window with the picture and simple controls, so a
 * video keeps playing while the person works in other tabs or apps. (The miniplayer, docked in
 * a corner of the page while browsing, is a different thing: the `mini` layout.)
 *
 * Chrome and Edge (116 and later) offer Document Picture-in-Picture, a real page in a floating
 * window, so the window has our own controls and captions. Elsewhere it falls back to
 * classic video picture in picture, which shows the picture with the system's play and pause.
 */

interface DocumentPictureInPicture {
  requestWindow(options?: {
    width?: number
    height?: number
    disallowReturnToOpener?: boolean
  }): Promise<Window>
  readonly window: Window | null
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture
  }
}

export type PictureInPictureKind = 'window' | 'video' | null

/** What this browser can do: our own window, the system's video window, or nothing. */
export function pictureInPictureSupport(): PictureInPictureKind {
  if (typeof window === 'undefined') return null
  if (window.documentPictureInPicture) return 'window'
  if (document.pictureInPictureEnabled) return 'video'
  return null
}

/**
 * Opens the floating window and makes the page's styles (the player's among them) work in it. It
 * must be called from a click: browsers only open it in answer to one.
 */
export async function openPictureInPictureWindow(size: {
  width: number
  height: number
}): Promise<Window> {
  const api = window.documentPictureInPicture
  if (!api) throw new Error('This browser has no floating player window')
  const pip = await api.requestWindow({ width: size.width, height: size.height })
  const doc = pip.document

  // Relative URLs in the copied styles (fonts) resolve against the page, not about:blank.
  const base = doc.createElement('base')
  base.href = location.origin + '/'
  doc.head.append(base)
  doc.title = document.title

  // The page's stylesheets, the player's among them, so the window looks like the player.
  for (const node of document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
    'link[rel="stylesheet"], style',
  )) {
    if (node instanceof HTMLLinkElement) {
      const link = doc.createElement('link')
      link.rel = 'stylesheet'
      link.href = node.href
      doc.head.append(link)
    } else {
      const style = doc.createElement('style')
      style.textContent = node.textContent
      doc.head.append(style)
    }
  }
  doc.documentElement.style.colorScheme = 'dark'
  doc.body.style.cssText = 'margin:0;height:100dvh;overflow:hidden;background:#000'
  return pip
}

/**
 * Classic picture in picture for browsers without the floating window: the system shows the
 * picture with its own play and pause. The browser decoder has a `<video>` to hand over; the
 * built-in decoder's picture is a canvas, so a hidden `<video>` plays a capture of it, and
 * play and pause are passed back and forth. Returns a function that closes it.
 */
export async function openVideoPictureInPicture(options: {
  video: HTMLVideoElement | null
  captureStream: () => MediaStream | null
  media: { play(): Promise<void>; pause(): void; readonly paused: boolean } & EventTarget
  /** Tells the decoder the picture is on screen while the tab may be hidden. */
  keepPictureAlive: () => () => void
  /** Called once when the window closes, whoever closes it. */
  onClose?: () => void
}): Promise<() => void> {
  if (options.video) {
    const video = options.video
    await video.requestPictureInPicture()
    const release = options.keepPictureAlive()
    const onLeave = () => {
      release()
      options.onClose?.()
    }
    video.addEventListener('leavepictureinpicture', onLeave, { once: true })
    return () => {
      release()
      video.removeEventListener('leavepictureinpicture', onLeave)
      if (document.pictureInPictureElement === video)
        void document.exitPictureInPicture().catch(() => undefined)
    }
  }

  const stream = options.captureStream()
  if (!stream) throw new Error('The picture cannot be captured in this browser')
  const proxy = document.createElement('video')
  proxy.muted = true
  proxy.playsInline = true
  proxy.srcObject = stream
  proxy.setAttribute('aria-hidden', 'true')
  proxy.style.cssText =
    'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;right:0'
  document.body.append(proxy)

  const { media } = options
  const release = options.keepPictureAlive()
  const fromWindow = () => {
    if (proxy.paused && !media.paused) media.pause()
    else if (!proxy.paused && media.paused) void media.play()
  }
  const fromPlayer = () => {
    if (media.paused) proxy.pause()
    else void proxy.play()
  }
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    release()
    proxy.removeEventListener('pause', fromWindow)
    proxy.removeEventListener('play', fromWindow)
    media.removeEventListener('pause', fromPlayer)
    media.removeEventListener('play', fromPlayer)
    for (const track of stream.getTracks()) track.stop()
    if (document.pictureInPictureElement === proxy)
      void document.exitPictureInPicture().catch(() => undefined)
    proxy.remove()
    options.onClose?.()
  }

  try {
    await proxy.play()
    await proxy.requestPictureInPicture()
  } catch (error) {
    close()
    throw error
  }
  proxy.addEventListener('pause', fromWindow)
  proxy.addEventListener('play', fromWindow)
  media.addEventListener('pause', fromPlayer)
  media.addEventListener('play', fromPlayer)
  proxy.addEventListener('leavepictureinpicture', close, { once: true })
  if (media.paused) proxy.pause()
  return close
}
