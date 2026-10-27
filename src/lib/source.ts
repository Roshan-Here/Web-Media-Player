// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import {
  fileSource,
  httpSource,
  playability,
  type ByteSource,
  type HttpSourceOptions,
} from 'web-buildin-decoder'

/**
 * What the player plays. Give it one of:
 *
 * - `url`: any address the browser can fetch with Range requests (most static hosts, S3, R2,
 *   CDNs), for both decoders;
 * - `file`: a `File` or `Blob`, such as one picked with `<input type="file">`;
 * - `open`: your own bytes (a cloud API, a peer, an encrypted store) as a `ByteSource`, for the
 *   built-in decoder. Add `url` or `file` too if the browser decoder should also be offered.
 */
export interface PlayerSource {
  /** A stable id for the video: its URL is used when absent. Remembered settings use it. */
  key?: string
  url?: string
  file?: Blob
  /** Opens the bytes for the built-in decoder; called each time it starts. */
  open?: () => Promise<ByteSource>
  /** "video/x-matroska", "video/mp4"; read from the file or the URL when absent. */
  mimeType?: string
  /** The file's name, for format hints ("film.x265.mkv"); read from the file or URL when absent. */
  fileName?: string
  /** Request headers and other options for `url`, used by the built-in decoder. */
  http?: Omit<HttpSourceOptions, 'fetch'>
  /** Read failures that will never succeed; playback stops at once on these. */
  isPermanent?: (error: unknown) => boolean
}

/** The video's stable id. */
export function sourceKey(source: PlayerSource): string {
  if (source.key) return source.key
  if (source.url) return source.url
  const file = source.file as (Blob & { name?: string; lastModified?: number }) | undefined
  if (file) return `file:${file.name ?? 'video'}:${file.size}:${file.lastModified ?? 0}`
  return 'video'
}

export function sourceFileName(source: PlayerSource): string | null {
  if (source.fileName) return source.fileName
  const file = source.file as (Blob & { name?: string }) | undefined
  if (file?.name) return file.name
  if (source.url) {
    try {
      const path = new URL(source.url, globalThis.location?.href ?? 'http://localhost/').pathname
      return decodeURIComponent(path.split('/').pop() ?? '') || null
    } catch {
      return null
    }
  }
  return null
}

export function sourceMimeType(source: PlayerSource): string {
  return source.mimeType ?? source.file?.type ?? ''
}

/** Whether the browser's own `<video>` should be able to play this, judged before loading. */
export function browserCanPlaySource(source: PlayerSource): boolean {
  if (!source.url && !source.file) return false
  if (typeof document === 'undefined') return false
  const probe = document.createElement('video')
  return (
    playability({ mimeType: sourceMimeType(source), fileName: sourceFileName(source) }, (type) =>
      probe.canPlayType(type),
    ) !== 'no'
  )
}

/** The bytes for the built-in decoder. */
export async function openBytes(source: PlayerSource): Promise<ByteSource> {
  if (source.open) return source.open()
  if (source.file) return fileSource(source.file)
  if (source.url) return httpSource(source.url, source.http)
  throw new Error('The player was given no url, file or open() to play')
}
