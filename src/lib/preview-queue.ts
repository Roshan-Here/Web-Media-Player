// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { PreviewSource } from './engine.js'

export interface PreviewQueueOptions {
  /** Seconds of timeline that share one still. */
  step: number
  /** Stills kept for going back over the same stretch. */
  cacheSize?: number
  /** Called with a still to show: the one asked for, or the closest made so far. */
  onImage: (url: string) => void
  createUrl?: (blob: Blob) => string
  revokeUrl?: (url: string) => void
}

/**
 * Asks an engine for timeline stills without flooding it. Making one costs a read and a
 * decode, so only one is made at a time and, when it is done, the next is for wherever the
 * pointer is by then: a fast sweep across the bar makes a handful of frames, not one per
 * pixel. Stills are kept per slot of timeline, so going back over a stretch is instant, and a
 * slot that could not be made is not asked for again.
 */
export class PreviewQueue {
  private readonly source: PreviewSource
  private readonly step: number
  private readonly cacheSize: number
  private readonly onImage: (url: string) => void
  private readonly createUrl: (blob: Blob) => string
  private readonly revokeUrl: (url: string) => void

  private readonly cache = new Map<number, string>()
  private readonly failed = new Set<number>()
  private wanted: number | null = null
  private busy = false
  private disposed = false

  constructor(source: PreviewSource, options: PreviewQueueOptions) {
    this.source = source
    this.step = Math.max(0.1, options.step)
    this.cacheSize = Math.max(1, options.cacheSize ?? 160)
    this.onImage = options.onImage
    this.createUrl = options.createUrl ?? ((blob) => URL.createObjectURL(blob))
    this.revokeUrl = options.revokeUrl ?? ((url) => URL.revokeObjectURL(url))
  }

  prepare(): void {
    if (!this.disposed) this.source.prepare()
  }

  /** The time under the pointer, or null when it left the timeline. */
  want(time: number | null): void {
    this.wanted = time
    if (time !== null) void this.pump()
  }

  dispose(): void {
    this.disposed = true
    this.wanted = null
    for (const url of this.cache.values()) this.revokeUrl(url)
    this.cache.clear()
  }

  private slot(time: number): number {
    return Math.max(0, Math.floor(time / this.step))
  }

  private async pump(): Promise<void> {
    while (!this.disposed && !this.busy && this.wanted !== null) {
      const target = this.slot(this.wanted)
      const hit = this.cache.get(target)
      if (hit) {
        this.onImage(hit)
        return
      }
      if (this.failed.has(target)) return

      this.busy = true
      let blob: Blob | null
      try {
        blob = await this.source.frame(target * this.step + this.step / 2)
      } catch {
        blob = null
      } finally {
        this.busy = false
      }
      if (this.disposed) return

      if (blob && blob.size > 0) {
        const url = this.createUrl(blob)
        this.cache.set(target, url)
        while (this.cache.size > this.cacheSize) {
          const [oldest, old] = this.cache.entries().next().value!
          this.cache.delete(oldest)
          this.revokeUrl(old)
        }
        // Shown even when the pointer has moved on: a nearby frame beats an empty card.
        if (this.wanted !== null) this.onImage(url)
      } else this.failed.add(target)

      // Loop on only when the pointer is somewhere else by now.
      if (this.wanted === null || this.slot(this.wanted) === target) return
    }
  }
}
