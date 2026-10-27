// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/**
 * Turns bursts of seek requests into few seeks. Pressing an arrow key ten times, or clicking
 * along the timeline, asks for many positions in a moment; the decoder should only go to the
 * last one. Relative steps count from where the previous request was going, not from the
 * playhead, which lags behind while a seek is under way.
 */
export interface SeekTarget {
  /** Current playhead, as the media element reports it. */
  currentTime(): number
  duration(): number
  /** Moves the playhead. */
  seek(time: number): void
}

export interface SeekControllerOptions {
  /** Requests closer together than this are merged into one seek. */
  settleMs?: number
  /** A pending target is forgotten after this long, even if the decoder never got there. */
  giveUpMs?: number
  /** Called whenever the target shown to the person changes. */
  onChange?: (target: number | null) => void
  timers?: { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void }
}

/** Within this many seconds of the target, the playhead counts as arrived. */
const ARRIVED = 1.5

export class SeekController {
  private target: number | null = null
  private applied: number | null = null
  private settleTimer: unknown = null
  private giveUpTimer: unknown = null
  private readonly settleMs: number
  private readonly giveUpMs: number
  private readonly onChange: (target: number | null) => void
  private readonly timers: NonNullable<SeekControllerOptions['timers']>

  constructor(
    private readonly media: SeekTarget,
    options: SeekControllerOptions = {},
  ) {
    this.settleMs = options.settleMs ?? 160
    this.giveUpMs = options.giveUpMs ?? 10_000
    this.onChange = options.onChange ?? (() => undefined)
    this.timers = options.timers ?? {
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    }
  }

  /** Where playback is going: the pending target, else the playhead. */
  position(): number {
    return this.target ?? this.media.currentTime()
  }

  get pending(): number | null {
    return this.target
  }

  /** Go to `time`. `now` skips the merging delay (a released drag, a resume). */
  seekTo(time: number, now = false): void {
    const duration = this.media.duration()
    const end = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - 0.25) : Infinity
    this.target = Math.max(0, Math.min(end, time))
    this.onChange(this.target)
    if (this.settleTimer !== null) this.timers.clear(this.settleTimer)
    this.settleTimer = null
    if (now) this.apply()
    else this.settleTimer = this.timers.set(() => this.apply(), this.settleMs)
  }

  /** Move by `delta` seconds from where playback is going. */
  seekBy(delta: number): void {
    this.seekTo(this.position() + delta)
  }

  /** Tell the controller the playhead moved (from `seeked` or `timeupdate`). */
  observe(): void {
    if (this.target === null || this.applied === null) return
    if (Math.abs(this.media.currentTime() - this.applied) <= ARRIVED) {
      // Arrived at the last applied target. A newer request may still be settling.
      if (this.applied === this.target) this.clear()
    }
  }

  /** Forget everything pending, for example when the source changes. */
  reset(): void {
    if (this.settleTimer !== null) this.timers.clear(this.settleTimer)
    this.settleTimer = null
    this.clear()
  }

  private apply(): void {
    this.settleTimer = null
    if (this.target === null) return
    this.applied = this.target
    this.media.seek(this.target)
    if (this.giveUpTimer !== null) this.timers.clear(this.giveUpTimer)
    this.giveUpTimer = this.timers.set(() => this.clear(), this.giveUpMs)
  }

  private clear(): void {
    if (this.giveUpTimer !== null) this.timers.clear(this.giveUpTimer)
    this.giveUpTimer = null
    this.applied = null
    if (this.target !== null) {
      this.target = null
      this.onChange(null)
    }
  }
}
