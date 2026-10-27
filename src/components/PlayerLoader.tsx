// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useState, type CSSProperties } from 'react'
import { cx } from '../lib/cx.js'
import { useT, type Translate } from '../lib/labels.js'

/*
 * The short pre-roll shown over the player while a video opens: a calm wait rather than a status
 * report. The title's backdrop, full bleed and drifting very slowly, the poster beside the
 * words, the name and one line under it ("S1 E4 · The Nexus Event", "2019 · 2h 32m"), the
 * overview when there is one, and one thin progress line with a status line under it ("Resuming
 * from 17:42", "Starting"). Without a backdrop, a still from the video or two colours make the
 * ground.
 *
 * Every size comes from the player's width (container units), so a phone, a laptop and full
 * screen on a large display all come out composed. It fades off once playback has started.
 */

/** What the pre-roll shows while the video opens. Only `title` is needed. */
export interface LoaderInfo {
  title: string
  /** "S1 E4  ·  The Nexus Event" or "2019  ·  2h 32m". */
  line?: string
  overview?: string
  /** A wide picture (16:9), full bleed behind everything. */
  backdrop?: string | null
  /** A poster (2:3), beside the words. */
  poster?: string | null
  /** A frame from the video, shown dimmed when there is no backdrop. */
  still?: string | null
  /** Two colours for the ground under everything, as CSS hex colours ("#1d3557"). */
  cover?: readonly [string, string]
}

const DEFAULT_COVER: readonly [string, string] = ['#3a4a6b', '#6b3a5a']

/** How far the opening has come, which the progress line shows. */
export type LoaderPhase = 'file' | 'decoder' | 'frame' | 'started'

const PHASE_SHARE: Record<LoaderPhase, number> = {
  // Each step eases towards its share over a few seconds and stops short of the next, so the
  // line keeps moving while a step takes its time and never claims more than has happened.
  file: 0.38,
  decoder: 0.72,
  frame: 0.92,
  started: 1,
}

/** After this long still opening, a quiet note says so. */
const SLOW_MS = 10_000

export function PlayerLoader({
  info,
  phase,
  status,
  leaving = false,
  onGone,
}: {
  info: LoaderInfo
  phase: LoaderPhase
  /** "Resuming from 17:42" or "Starting". */
  status: string
  /** Fading off: playback has started. */
  leaving?: boolean
  /** Called once it has faded off. */
  onGone?: () => void
}) {
  const t = useT()
  const slow = useSlow(!leaving && phase !== 'started')
  const picture = info.backdrop ?? info.still ?? null
  const cover = info.cover ?? DEFAULT_COVER
  return (
    <div
      className={cx(
        'mp:pointer-events-none mp:absolute mp:inset-0 mp:z-20 mp:overflow-hidden mp:rounded-[inherit] mp:bg-bg mp:transition-opacity mp:duration-500 mp:ease-standard',
        leaving ? 'mp:opacity-0' : 'mp:opacity-100',
      )}
      onTransitionEnd={(event) => {
        if (leaving && event.target === event.currentTarget) onGone?.()
      }}
      data-player-loader=""
      aria-hidden={leaving || undefined}
    >
      {/* The ground: the cover's colours, so the wait never sits on a flat black. */}
      <div
        aria-hidden="true"
        className="mp:absolute mp:inset-0"
        style={{
          background: `radial-gradient(120% 90% at 85% 10%, ${cover[0]}66, transparent 60%), linear-gradient(135deg, ${cover[1]}55, transparent 70%)`,
        }}
      />
      {picture ? <Backdrop key={picture} src={picture} still={!info.backdrop} /> : null}

      {/* Scrims: the words' side, eased over many stops so the fade has no edge, and the foot. */}
      <div
        aria-hidden="true"
        className="mp:absolute mp:inset-0"
        style={{
          background: `linear-gradient(to right, ${scrim(0.94)} 0%, ${scrim(0.9)} 20%, ${scrim(0.78)} 35%, ${scrim(0.58)} 50%, ${scrim(0.36)} 62%, ${scrim(0.17)} 74%, ${scrim(0.05)} 86%, transparent 100%)`,
        }}
      />
      <div
        aria-hidden="true"
        className="mp:absolute mp:inset-0"
        style={{
          background: `linear-gradient(to bottom, ${scrim(0.55)} 0%, transparent 18%, transparent 45%, ${scrim(0.96)} 100%)`,
        }}
      />

      <div
        className="mp:absolute mp:inset-x-0 mp:bottom-0 mp:flex mp:items-end mp:gap-[clamp(14px,2.4cqi,32px)] mp:px-[clamp(16px,4cqi,48px)] mp:pb-[clamp(16px,3.6cqi,44px)]"
        style={{ '--title': 'clamp(19px, 3.9cqi, 64px)' } as CSSProperties}
      >
        {info.poster ? <Poster src={info.poster} /> : null}
        <div className="mp:grid mp:max-w-[min(62cqi,40em)] mp:min-w-0 mp:flex-1 mp:content-end">
          <p className="mp:m-0 mp:line-clamp-2 mp:font-display mp:text-(length:--title) mp:leading-[1.1] mp:font-[650] mp:tracking-[-0.015em] mp:[text-wrap:balance] mp:text-ink">
            {info.title}
          </p>
          {info.line ? (
            <p className="mp:m-0 mp:mt-1 mp:truncate mp:text-[clamp(0.8125rem,1.9cqi,1.625rem)] mp:text-muted">
              {info.line}
            </p>
          ) : null}
          {info.overview ? (
            <p className="mp:m-0 mp:mt-[clamp(8px,1.4cqi,18px)] mp:line-clamp-3 mp:text-[clamp(0.8125rem,1.75cqi,1.375rem)] mp:leading-[1.45] mp:text-muted mp:@max-[560px]:hidden">
              {info.overview}
            </p>
          ) : null}
          <div className="mp:mt-[clamp(12px,2.2cqi,28px)] mp:grid mp:gap-[clamp(6px,0.9cqi,12px)]">
            <div className="mp:h-[clamp(3px,0.35cqi,5px)] mp:overflow-hidden mp:rounded-full mp:bg-ink/16">
              <div
                className={cx(
                  'mp:h-full mp:origin-left mp:scale-x-(--share) mp:rounded-full mp:bg-accent mp:starting:scale-x-[0.03]',
                  phase === 'started'
                    ? 'mp:transition-transform mp:duration-300 mp:ease-standard'
                    : 'mp:transition-transform mp:duration-[4500ms] mp:ease-[cubic-bezier(0.1,0.6,0.2,1)]',
                )}
                style={{ '--share': PHASE_SHARE[phase] } as CSSProperties}
              />
            </div>
            <p
              role="status"
              className="mp:m-0 mp:flex mp:min-w-0 mp:items-baseline mp:gap-3 mp:text-[clamp(0.75rem,1.5cqi,1.125rem)] mp:font-medium mp:text-muted"
            >
              <span className="mp:truncate">{status}</span>
              {slow ? (
                <span className="mp:truncate mp:font-normal mp:text-faint">{t('loaderSlow')}</span>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The backdrop: fades in when it has loaded, then pushes in very slowly (motion allowing). */
function Backdrop({ src, still }: { src: string; still: boolean }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      ref={shownIfReady(setLoaded)}
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cx(
        'mp:absolute mp:inset-0 mp:size-full mp:origin-[65%_40%] mp:object-cover mp:transition-opacity mp:duration-700 mp:ease-standard mp:motion-safe:animate-loader-drift',
        loaded ? (still ? 'mp:opacity-70' : 'mp:opacity-100') : 'mp:opacity-0',
      )}
    />
  )
}

function Poster({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      ref={shownIfReady(setLoaded)}
      src={src}
      alt=""
      aria-hidden="true"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cx(
        'mp:aspect-[2/3] mp:w-[clamp(64px,12.6cqi,210px)] mp:shrink-0 mp:rounded-[clamp(6px,0.8cqi,12px)] mp:object-cover mp:shadow-[0_18px_40px_-12px_color-mix(in_srgb,var(--mp-color-shadow)_70%,transparent)] mp:transition-opacity mp:duration-700 mp:ease-standard mp:@max-[420px]:hidden',
        loaded ? 'mp:opacity-100' : 'mp:opacity-0',
      )}
    />
  )
}

/**
 * A picture the browser already has (the stage's placeholder showed it a moment ago) is shown
 * straight away rather than faded in again.
 */
function shownIfReady(setLoaded: (loaded: boolean) => void) {
  return (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true)
  }
}

/** The page's ground colour at [alpha], for the scrims. */
function scrim(alpha: number): string {
  return `color-mix(in srgb, var(--mp-color-bg) ${Math.round(alpha * 100)}%, transparent)`
}

/** True once [waiting] has lasted [SLOW_MS]. */
function useSlow(waiting: boolean): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!waiting) return
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [waiting])
  return waiting && slow
}

/** The status line for a video opening at [startAt] seconds. */
export function loaderStatus(
  startAt: number,
  clock: (seconds: number) => string,
  t: Translate,
): string {
  return startAt >= 1 ? t('loaderResuming', { time: clock(startAt) }) : t('loaderStarting')
}
