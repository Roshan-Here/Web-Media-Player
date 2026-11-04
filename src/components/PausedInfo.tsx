// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useT } from '../lib/labels.js'
import { cx } from '../lib/cx.js'

/*
 * What is on screen after the video has been left paused a while, as streaming apps show it:
 * the scene dimmed, and over it what is being watched (the show or film, the season and
 * episode with its name, the overview) and that it is paused. Any move brings the controls
 * back in its place.
 */

/** How long the video rests paused, untouched, before this shows. */
export const PAUSED_INFO_AFTER_MS = 20_000

export function PausedInfo({
  shown,
  title,
  line,
  overview,
}: {
  shown: boolean
  title: string
  /** "S1 E4  ·  The Nexus Event", or "2019  ·  2h 32m"; empty for none. */
  line: string
  overview: string
}) {
  const t = useT()
  return (
    <div
      className={cx(
        'mp:pointer-events-none mp:absolute mp:inset-0 mp:z-1 mp:rounded-[inherit] mp:transition-opacity mp:ease-soft',
        shown ? 'mp:opacity-100 mp:duration-700' : 'mp:opacity-0 mp:duration-200',
      )}
      aria-hidden={!shown}
      data-paused-info={shown ? '' : undefined}
    >
      {/* A light dim over the whole scene, darker behind the words. */}
      <div className="mp:absolute mp:inset-0 mp:rounded-[inherit] mp:bg-linear-to-r mp:from-black/78 mp:via-black/50 mp:to-black/30" />
      <div
        className={cx(
          'mp:absolute mp:top-1/2 mp:left-[6%] mp:grid mp:max-w-[min(48rem,62%)] mp:-translate-y-1/2 mp:gap-[clamp(6px,1.1cqi,16px)] mp:transition-transform mp:duration-700 mp:ease-soft',
          shown ? 'mp:translate-x-0' : 'mp:-translate-x-2',
          'mp:@max-[520px]:max-w-[86%]',
        )}
      >
        <p className="mp:m-0 mp:text-[clamp(12px,1.45cqi,20px)] mp:text-ink/72">
          {t('pausedWatching')}
        </p>
        <h2 className="mp:m-0 mp:font-display mp:text-[clamp(26px,5.2cqi,76px)] mp:leading-[1.04] mp:font-[750] mp:tracking-[-0.02em] mp:text-balance">
          {title}
        </h2>
        {line ? (
          <p className="mp:m-0 mp:text-[clamp(14px,2cqi,28px)] mp:leading-snug mp:font-semibold mp:whitespace-pre">
            {line}
          </p>
        ) : null}
        {overview ? (
          <p className="mp:m-0 mp:line-clamp-4 mp:max-w-[56ch] mp:text-[clamp(12px,1.55cqi,21px)] mp:leading-[1.45] mp:text-ink/75 mp:@max-[520px]:line-clamp-2">
            {overview}
          </p>
        ) : null}
      </div>
      <p className="mp:absolute mp:right-[6%] mp:bottom-[9%] mp:m-0 mp:text-[clamp(13px,1.6cqi,22px)] mp:font-medium mp:text-ink/88">
        {t('paused')}
      </p>
    </div>
  )
}
