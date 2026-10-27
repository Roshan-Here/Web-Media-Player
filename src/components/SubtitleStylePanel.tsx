// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useRef } from 'react'
import { useSubtitleStyle } from '../hooks/useSubtitleStyle.js'
import { useT } from '../lib/labels.js'
import {
  DELAY_MAX,
  DELAY_STEP,
  DEFAULT_STYLE,
  delayLabel,
  subtitleStyle,
} from '../lib/subtitle-style.js'
import { Icon } from './Icon.js'
import { SubtitleStyleControls } from './SubtitleStyleControls.js'

/**
 * The Subtitles menu's "Look and timing": a panel over the picture, where the subtitles behind it
 * change as each choice is made. The look is kept for every video; the timing for this one.
 */
export function SubtitleStylePanel({
  delay,
  onDelay,
  onClose,
}: {
  delay: number
  onDelay: (seconds: number) => void
  onClose: () => void
}) {
  const t = useT()
  const style = useSubtitleStyle()
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    panelRef.current?.focus()
  }, [])
  const isDefault = JSON.stringify(style) === JSON.stringify(DEFAULT_STYLE)

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('lookTitle')}
      tabIndex={-1}
      className="mp:absolute mp:top-3 mp:right-3 mp:z-3 mp:flex mp:max-h-[calc(100%-7rem)] mp:w-[min(400px,calc(100%-1.5rem))] mp:flex-col mp:rounded-xl mp:border mp:border-line-strong mp:bg-surface/96 mp:shadow-[0_18px_40px_-12px_color-mix(in_srgb,var(--mp-color-shadow)_70%,transparent)] mp:backdrop-blur-md mp:outline-none mp:@max-[520px]:top-2 mp:@max-[520px]:right-2 mp:@max-[520px]:max-h-[calc(100%-6rem)] mp:@max-[520px]:w-[calc(100%-1rem)]"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
      data-subtitle-style=""
    >
      <div className="mp:flex mp:items-center mp:gap-2 mp:py-1.5 mp:pr-1.5 mp:pl-4">
        <h2 className="mp:flex-1 mp:truncate mp:text-base mp:font-semibold">{t('lookTitle')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="mp:grid mp:size-9 mp:place-items-center mp:rounded-full mp:text-muted mp:transition-colors mp:hover:bg-raised mp:hover:text-ink"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="mp:grid mp:gap-5 mp:overflow-y-auto mp:px-4 mp:pt-1 mp:pb-4">
        <div className="mp:grid mp:gap-1.5">
          <span className="mp:text-xs mp:font-semibold mp:tracking-[0.08em] mp:text-muted mp:uppercase">
            {t('timing')}
          </span>
          <div className="mp:flex mp:flex-wrap mp:items-center mp:gap-2">
            <div className="mp:inline-flex mp:items-center mp:rounded-full mp:border mp:border-line-strong mp:bg-bg/40 mp:p-0.5">
              <button
                type="button"
                onClick={() => onDelay(delay - DELAY_STEP)}
                disabled={delay <= -DELAY_MAX}
                className="mp:inline-flex mp:min-h-8 mp:items-center mp:rounded-full mp:px-3 mp:text-sm mp:text-muted mp:hover:text-ink mp:disabled:opacity-40"
                title={t('earlierKey')}
              >
                {t('earlier')}
              </button>
              <span
                className="mp:min-w-16 mp:text-center mp:text-sm mp:font-semibold mp:tabular-nums"
                aria-live="polite"
                aria-label={t('timingLabel', { delay: delayLabel(delay, t) })}
              >
                {delayLabel(delay, t)}
              </span>
              <button
                type="button"
                onClick={() => onDelay(delay + DELAY_STEP)}
                disabled={delay >= DELAY_MAX}
                className="mp:inline-flex mp:min-h-8 mp:items-center mp:rounded-full mp:px-3 mp:text-sm mp:text-muted mp:hover:text-ink mp:disabled:opacity-40"
                title={t('laterKey')}
              >
                {t('later')}
              </button>
            </div>
            {delay !== 0 ? (
              <button
                type="button"
                onClick={() => onDelay(0)}
                className="mp:rounded-full mp:px-3 mp:py-1.5 mp:text-sm mp:text-muted mp:hover:bg-raised mp:hover:text-ink"
              >
                {t('reset')}
              </button>
            ) : null}
          </div>
          <p className="mp:m-0 mp:text-xs mp:text-faint">{t('timingHint')}</p>
        </div>

        <SubtitleStyleControls
          value={style}
          onChange={(change) => subtitleStyle.set(change)}
          compact
        />

        {isDefault ? null : (
          <button
            type="button"
            onClick={() => subtitleStyle.reset()}
            className="mp:w-fit mp:rounded-full mp:px-3 mp:py-1.5 mp:text-sm mp:text-muted mp:hover:bg-raised mp:hover:text-ink"
          >
            {t('defaultLook')}
          </button>
        )}
      </div>
    </div>
  )
}
