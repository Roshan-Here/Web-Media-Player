// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/**
 * Spaces calls at least `gapMs` apart: 200 ms is OpenSubtitles' five requests a second, 1000 ms
 * its one sign in a second. Callers queue in order rather than being refused.
 */
export class RateLimiter {
  private last: number | null = null
  private chain: Promise<void> = Promise.resolve()

  constructor(
    private readonly gapMs: number,
    private readonly now: () => number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  /** Waits until a request may go, and books the slot. */
  acquire(): Promise<void> {
    const turn = this.chain.then(async () => {
      if (this.last !== null) {
        const wait = this.last + this.gapMs - this.now()
        if (wait > 0) await this.sleep(wait)
      }
      this.last = this.now()
    })
    this.chain = turn.catch(() => undefined)
    return turn
  }
}
