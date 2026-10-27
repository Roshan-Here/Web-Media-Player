// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useMediaState } from '../hooks/useMediaState.js'
import { useSubtitleStyle } from '../hooks/useSubtitleStyle.js'
import { cx } from '../lib/cx.js'
import type { MediaEngine } from '../lib/engine.js'
import { formatDuration } from '../lib/format.js'
import { useT } from '../lib/labels.js'
import { captionCss } from '../lib/subtitle-style.js'
import { SwapIcon } from './AnimatedIcons.js'
import { Icon } from './Icon.js'
import { SeekBar } from './SeekBar.js'

export interface PipWindowProps {
  pipWindow: Window
  engine: MediaEngine
  title: string
  caption: string | null
  /** Where playback is going while a seek is under way. */
  seekTarget: number | null
  onSeek: (time: number, now?: boolean) => void
  onSeekBy: (delta: number) => void
  /** The player's own style (its accent colour), carried into the window. */
  style?: CSSProperties
}

const button = cx(
  'mp:grid mp:size-9 mp:place-items-center mp:rounded-control mp:text-ink mp:transition-[background-color,transform] mp:hover:bg-ink/12 mp:active:scale-[0.96]',
)

/**
 * What the floating picture-in-picture window shows: the moving picture (handed over by the
 * engine, which keeps it going while the tab is hidden), the captions and compact controls.
 * Sound keeps coming from the page.
 */
export function PipWindow({
  pipWindow,
  engine,
  title,
  caption,
  seekTarget,
  onSeek,
  onSeekBy,
  style,
}: PipWindowProps) {
  const t = useT()
  const pictureRef = useRef<HTMLDivElement | null>(null)
  const state = useMediaState(engine.media)
  const subStyle = useSubtitleStyle()
  const media = engine.media

  useEffect(() => {
    const container = pictureRef.current
    if (!container) return
    const restore = engine.showPictureIn(container)
    // The window's document goes away when it closes. The picture has to be back in the tab
    // by then (a <video> left in a dead document stops), so this cannot wait for React to
    // re-render: it runs on the window's own pagehide.
    pipWindow.addEventListener('pagehide', restore, { once: true })
    return () => {
      pipWindow.removeEventListener('pagehide', restore)
      restore()
    }
  }, [engine, pipWindow])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'k') {
        if (media.paused) void media.play()
        else media.pause()
      } else if (event.key === 'ArrowLeft' || event.key === 'j') onSeekBy(-10)
      else if (event.key === 'ArrowRight' || event.key === 'l') onSeekBy(10)
      else return
      event.preventDefault()
    }
    pipWindow.addEventListener('keydown', onKey)
    return () => pipWindow.removeEventListener('keydown', onKey)
  }, [pipWindow, media, onSeekBy])

  const togglePlay = () => {
    if (media.paused) void media.play()
    else media.pause()
  }

  return createPortal(
    <div
      className="mp-root mp:group mp:relative mp:h-dvh mp:w-full mp:bg-black mp:select-none"
      aria-label={t('pipWindow', { title })}
      style={style}
    >
      <div ref={pictureRef} className="mp:absolute mp:inset-0" onClick={togglePlay} />
      {caption ? (
        <div className="mp:pointer-events-none mp:absolute mp:bottom-16 mp:left-1/2 mp:w-max mp:max-w-[90%] mp:-translate-x-1/2 mp:text-center mp:leading-snug mp:whitespace-pre-line">
          <span style={captionCss(subStyle, 'clamp(13px, 4.2vw, 22px)')}>{caption}</span>
        </div>
      ) : null}
      <div className="mp:absolute mp:inset-x-0 mp:bottom-0 mp:bg-gradient-to-t mp:from-black/80 mp:to-transparent mp:px-3 mp:pt-8 mp:pb-2 mp:opacity-0 mp:transition-opacity mp:duration-200 mp:group-hover:opacity-100 mp:focus-within:opacity-100">
        <SeekBar
          size="compact"
          position={seekTarget ?? state.currentTime}
          duration={state.duration}
          bufferedEnd={state.bufferedEnd}
          onSeek={(t) => onSeek(t, true)}
          onStep={onSeekBy}
        />
        <div className="mp:flex mp:items-center mp:gap-1">
          <button
            type="button"
            className={button}
            onClick={togglePlay}
            aria-label={state.paused ? t('play') : t('pause')}
          >
            <SwapIcon
              showOn={state.paused}
              on={<Icon name="play" size={18} />}
              off={<Icon name="pause" size={18} />}
            />
          </button>
          <button
            type="button"
            className={button}
            onClick={() => onSeekBy(-10)}
            aria-label={t('back10')}
          >
            <Icon name="back10" size={18} />
          </button>
          <button
            type="button"
            className={button}
            onClick={() => onSeekBy(10)}
            aria-label={t('forward10')}
          >
            <Icon name="forward10" size={18} />
          </button>
          <span className="mp:ml-1 mp:text-xs mp:whitespace-nowrap mp:text-ink mp:tabular-nums">
            {formatDuration(seekTarget ?? state.currentTime)}{' '}
            <span className="mp:text-muted">/ {formatDuration(state.duration)}</span>
          </span>
          <span className="mp:flex-1" />
          <button
            type="button"
            className={button}
            onClick={() => pipWindow.close()}
            aria-label={t('backToTab')}
            title={t('backToTab')}
          >
            <Icon name="popIn" size={18} />
          </button>
        </div>
      </div>
    </div>,
    pipWindow.document.body,
  )
}
