// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { ReactNode } from 'react'
import type { UpNext } from '../hooks/useUpNext.js'
import { cx } from '../lib/cx.js'
import { useT } from '../lib/labels.js'
import { Button } from './Button.js'
import { Icon } from './Icon.js'

/**
 * The next episode, offered in the corner the skip pill uses: its name, a ring counting down to
 * it, Hide and Play now. It stays when the controls fade, and rises above the bar while they show.
 */
export function UpNextCard({
  next,
  seconds,
  share,
  lifted,
  onHide,
  onPlay,
}: {
  next: UpNext
  seconds: number
  share: number
  lifted: boolean
  onHide: () => void
  onPlay: () => void
}) {
  const t = useT()
  return (
    <div
      role="region"
      aria-label={t('upNextRegion')}
      data-up-next=""
      className={cx(
        'mp:absolute mp:right-5 mp:bottom-5 mp:z-3 mp:grid mp:w-[min(340px,calc(100%-2.5rem))] mp:gap-3 mp:rounded-xl mp:border mp:border-ink/20 mp:bg-black/72 mp:p-4 mp:text-ink mp:shadow-[0_18px_44px_-10px_color-mix(in_srgb,var(--mp-color-shadow)_75%,transparent)] mp:backdrop-blur-md mp:motion-safe:animate-rise mp:@max-[520px]:right-3 mp:@max-[520px]:gap-2 mp:@max-[520px]:p-3',
        'mp:transition-[translate] mp:duration-250 mp:ease-standard',
        lifted
          ? 'mp:-translate-y-[5.25rem] mp:@max-[520px]:-translate-y-[4.5rem]'
          : 'mp:translate-y-0',
      )}
    >
      <div className="mp:flex mp:items-center mp:gap-3">
        <Countdown seconds={seconds} share={share} />
        <div className="mp:grid mp:min-w-0 mp:flex-1 mp:gap-0.5">
          <span className="mp:text-xs mp:font-semibold mp:tracking-[0.12em] mp:text-muted mp:uppercase">
            {t('upNextHeading')}
          </span>
          <span className="mp:truncate mp:font-semibold" title={next.label}>
            {next.label}
          </span>
          <span className="mp:truncate mp:text-xs mp:text-muted">{next.title}</span>
        </div>
      </div>
      <div className="mp:flex mp:justify-end mp:gap-2">
        <Button size="small" variant="ghost" onClick={onHide}>
          {t('upNextHide')}
        </Button>
        <Button size="small" variant="primary" icon="play" onClick={onPlay}>
          {t('upNextPlayNow')}
        </Button>
      </div>
    </div>
  )
}

/** The seconds left inside a ring that fills as they run out. */
function Countdown({ seconds, share }: { seconds: number; share: number }) {
  const t = useT()
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <span
      className="mp:relative mp:grid mp:size-12 mp:shrink-0 mp:place-items-center"
      role="timer"
      aria-label={t('upNextPlayingIn', { count: seconds })}
    >
      <svg
        viewBox="0 0 44 44"
        className="mp:absolute mp:inset-0 mp:size-full mp:-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="3"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--mp-color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          className="mp:transition-[stroke-dashoffset] mp:duration-1000 mp:ease-linear"
        />
      </svg>
      <span className="mp:text-sm mp:font-semibold mp:tabular-nums">{seconds}</span>
    </span>
  )
}

/** At the end of a video the card was not seen for: the next one in a few seconds, over the picture. */
export function NextCountdown({
  next,
  seconds,
  onPlay,
  onCancel,
}: {
  next: UpNext
  seconds: number
  onPlay: () => void
  onCancel: () => void
}) {
  const t = useT()
  // The number stands out in the sentence, wherever the language puts it.
  const [before, after = ''] = t('upNextIn', { seconds: '{seconds}' }).split('{seconds}')
  return (
    <EndCard>
      <p className="mp:m-0 mp:text-xs mp:font-semibold mp:tracking-[0.12em] mp:text-muted mp:uppercase">
        {before}
        <span className="mp:text-ink mp:tabular-nums">{seconds}</span>
        {after}
      </p>
      <p className="mp:m-0 mp:font-display mp:text-xl mp:font-[650] mp:@max-[520px]:text-base">
        {next.label}
      </p>
      <p className="mp:m-0 mp:text-sm mp:text-muted">{next.title}</p>
      <div className="mp:mt-2 mp:flex mp:flex-wrap mp:justify-center mp:gap-2">
        <Button variant="primary" icon="play" onClick={onPlay}>
          {t('upNextPlayNow')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('upNextCancel')}
        </Button>
      </div>
    </EndCard>
  )
}

/** After a few episodes in a row with nobody pressing anything. */
export function StillWatching({
  next,
  onPlay,
  onStop,
}: {
  next: UpNext
  onPlay: () => void
  onStop: () => void
}) {
  const t = useT()
  return (
    <EndCard>
      <Icon name="series" size={28} className="mp:text-accent" />
      <p className="mp:m-0 mp:font-display mp:text-xl mp:font-[650] mp:@max-[520px]:text-base">
        {t('stillWatching')}
      </p>
      <p className="mp:m-0 mp:max-w-[36ch] mp:text-sm mp:text-muted">
        {t('stillWatchingBody', { episode: next.label })}
      </p>
      <div className="mp:mt-2 mp:flex mp:flex-wrap mp:justify-center mp:gap-2">
        <Button variant="primary" icon="play" onClick={onPlay}>
          {t('playNext')}
        </Button>
        <Button variant="ghost" onClick={onStop}>
          {t('notNow')}
        </Button>
      </div>
    </EndCard>
  )
}

function EndCard({ children }: { children: ReactNode }) {
  const t = useT()
  return (
    <div
      className="mp:absolute mp:inset-0 mp:z-3 mp:grid mp:place-items-center mp:rounded-[inherit] mp:bg-black/70 mp:p-5 mp:backdrop-blur-sm mp:motion-safe:animate-fade-in"
      role="dialog"
      aria-label={t('upNextRegion')}
      data-up-next-end=""
    >
      <div className="mp:grid mp:justify-items-center mp:gap-1.5 mp:text-center">{children}</div>
    </div>
  )
}
