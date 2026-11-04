// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon.js'
import { useT } from '../lib/labels.js'
import { cx } from '../lib/cx.js'
import { formatDuration } from '../lib/format.js'
import { useDragPanel } from '../hooks/useDragPanel.js'

/*
 * The show's episodes, over the picture, as streaming apps list them from the player: a
 * season at a time, the one playing opened up with its picture and overview, any other a press
 * away from the same, and its picture or Play button starting it. A show of several seasons
 * goes back to the list of them from the season's title.
 */

export interface PlayerEpisode {
  /** The file that plays: of the episode's copies, the one most like the one playing. */
  key: string
  number: number
  /** "Red Tide", or "Episode 3" when nothing better is known. */
  name: string
  overview: string
  /** Its picture, 16:9: the provider's still, else the video's own frame. */
  art: ReactNode
  /** Seconds; 0 when not known. */
  duration: number
  /** How much of it has been watched, 0 to 1. */
  share: number
  watched: boolean
  /** The one playing. */
  current: boolean
  play: () => void
}

export interface PlayerSeason {
  /** The season's number; null for a show whose files give none. */
  number: number | null
  episodes: PlayerEpisode[]
}

export interface PlayerEpisodes {
  showTitle: string
  seasons: PlayerSeason[]
  /** The season shown. */
  season: number | null
  /** Shows another season (its names and pictures are looked up then). */
  onSeason: (season: number | null) => void
}

export function EpisodesPanel({
  episodes,
  onPlay,
  onClose,
}: {
  episodes: PlayerEpisodes
  /** Starts an episode, the way the next one is started. */
  onPlay: (episode: PlayerEpisode) => void
  onClose: () => void
}) {
  const t = useT()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLOListElement | null>(null)
  // Moved by its title bar, as the subtitle panels are.
  const drag = useDragPanel(panelRef, 'episodes-panel-offset')
  const several = episodes.seasons.length > 1
  const [choosing, setChoosing] = useState(false)
  const season =
    episodes.seasons.find((s) => s.number === episodes.season) ?? episodes.seasons[0] ?? null
  const playing = season?.episodes.find((e) => e.current) ?? null
  const [open, setOpen] = useState<string | null>(playing?.key ?? null)

  // Focus in the panel, so its keys are its own; again when it changes between its lists.
  useEffect(() => {
    panelRef.current?.focus()
  }, [choosing])
  // Escape closes it wherever the focus has gone (a list it pressed away, the picture).
  const escape = useRef<() => void>(onClose)
  useEffect(() => {
    escape.current = () => (choosing ? setChoosing(false) : onClose())
  }, [choosing, onClose])
  useEffect(() => {
    const view = panelRef.current?.ownerDocument.defaultView ?? window
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      escape.current()
    }
    view.addEventListener('keydown', onKey)
    return () => view.removeEventListener('keydown', onKey)
  }, [])
  // The one playing in view when the list opens, and the one opened when a season is shown.
  useEffect(() => {
    if (choosing) return
    const row = listRef.current?.querySelector<HTMLElement>('[data-open]')
    row?.scrollIntoView({ block: 'center' })
  }, [choosing, season?.number])

  const seasonTitle = (number: number | null) =>
    number == null ? t('episodes') : t('episodesSeason', { season: number })

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('episodesOf', { show: episodes.showTitle })}
      tabIndex={-1}
      className="mp:absolute mp:top-[calc(var(--mp-overlay-top,0px)+0.75rem)] mp:right-3 mp:bottom-[calc(var(--controls-h,96px)+0.5rem)] mp:z-3 mp:flex mp:w-[min(520px,calc(100%-1.5rem))] mp:flex-col mp:overflow-hidden mp:rounded-xl mp:border mp:border-line-strong mp:bg-surface/96 mp:shadow-[0_18px_40px_-12px_color-mix(in_srgb,var(--mp-color-shadow)_70%,transparent)] mp:backdrop-blur-md mp:outline-none mp:[--controls-h:96px] mp:@max-[520px]:top-2 mp:@max-[520px]:right-2 mp:@max-[520px]:w-[calc(100%-1rem)] mp:@max-[520px]:[--controls-h:84px]"
      data-player-panel=""
      data-episodes=""
      style={drag.style}
    >
      <div
        className={cx(
          'mp:flex mp:touch-none mp:items-center mp:gap-1 mp:py-1.5 mp:pr-1.5 mp:pl-2 mp:select-none',
          drag.dragging ? 'mp:cursor-grabbing' : 'mp:cursor-grab',
        )}
        title={t('movePanel')}
        data-panel-handle=""
        {...drag.handleProps}
      >
        <Icon name="grip" size={16} className="mp:ml-0.5 mp:shrink-0 mp:text-faint" />
        {several && !choosing ? (
          <>
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="mp:flex mp:min-w-0 mp:items-center mp:gap-2 mp:rounded-control mp:px-2 mp:py-1.5 mp:text-left mp:transition-colors mp:hover:bg-raised"
              aria-label={t('episodesAllSeasons')}
            >
              <Icon name="back" size={18} className="mp:shrink-0 mp:text-muted" />
              <h2 className="mp:m-0 mp:truncate mp:text-lg mp:font-semibold">
                {seasonTitle(season?.number ?? null)}
              </h2>
            </button>
            {/* The bar's free space, where it is dragged from. */}
            <span className="mp:min-w-4 mp:flex-1 mp:self-stretch" />
          </>
        ) : (
          <h2 className="mp:m-0 mp:min-w-0 mp:flex-1 mp:truncate mp:px-2 mp:py-1.5 mp:text-lg mp:font-semibold">
            {choosing ? episodes.showTitle : seasonTitle(season?.number ?? null)}
          </h2>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('episodesClose')}
          className="mp:grid mp:size-9 mp:shrink-0 mp:place-items-center mp:rounded-full mp:text-muted mp:transition-colors mp:hover:bg-raised mp:hover:text-ink"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {choosing ? (
        <ul className="mp:m-0 mp:grid mp:min-h-0 mp:list-none mp:content-start mp:gap-0.5 mp:overflow-y-auto mp:overscroll-contain mp:p-0 mp:px-2 mp:pb-2">
          {episodes.seasons.map((s) => (
            <li key={String(s.number)}>
              <button
                type="button"
                onClick={() => {
                  episodes.onSeason(s.number)
                  setChoosing(false)
                  setOpen(s.episodes.find((e) => e.current)?.key ?? null)
                }}
                aria-current={s.number === season?.number ? 'true' : undefined}
                className={cx(
                  'mp:flex mp:w-full mp:items-center mp:gap-3 mp:rounded-control mp:px-3 mp:py-3 mp:text-left mp:transition-colors mp:hover:bg-raised',
                  s.number === season?.number && 'mp:bg-raised/70',
                )}
              >
                <span className="mp:flex-1 mp:font-semibold">{seasonTitle(s.number)}</span>
                <span className="mp:text-sm mp:text-muted mp:tabular-nums">
                  {t('episodesCount', { count: s.episodes.length })}
                </span>
                <Icon name="chevron" size={16} className="mp:text-faint" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ol
          ref={listRef}
          className="mp:m-0 mp:grid mp:min-h-0 mp:list-none mp:content-start mp:overflow-y-auto mp:overscroll-contain mp:p-0 mp:pb-1.5"
        >
          {(season?.episodes ?? []).map((episode) => (
            <EpisodeRow
              key={episode.key}
              episode={episode}
              open={open === episode.key}
              onOpen={() => setOpen(open === episode.key ? null : episode.key)}
              onPlay={() => onPlay(episode)}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

function EpisodeRow({
  episode,
  open,
  onOpen,
  onPlay,
}: {
  episode: PlayerEpisode
  open: boolean
  onOpen: () => void
  onPlay: () => void
}) {
  const t = useT()
  return (
    <li
      className={cx(
        'mp:mx-1.5 mp:rounded-control mp:border mp:transition-colors mp:duration-150',
        open ? 'mp:border-ink/70 mp:bg-bg/55' : 'mp:border-transparent',
      )}
      data-open={open ? '' : undefined}
      data-current={episode.current ? '' : undefined}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        className={cx(
          'mp:flex mp:w-full mp:items-center mp:gap-4 mp:rounded-control mp:px-4 mp:py-3.5 mp:text-left mp:transition-colors',
          !open && 'mp:hover:bg-raised',
        )}
      >
        <span className="mp:w-6 mp:shrink-0 mp:text-base mp:font-semibold mp:text-ink/80 mp:tabular-nums">
          {episode.number}
        </span>
        <span className="mp:min-w-0 mp:flex-1 mp:truncate mp:text-base mp:font-semibold">
          {episode.name}
        </span>
        <span
          className="mp:relative mp:h-[2px] mp:w-24 mp:shrink-0 mp:overflow-hidden mp:rounded-full mp:bg-ink/25 mp:@max-[520px]:w-14"
          aria-hidden="true"
        >
          <span
            className="mp:absolute mp:inset-y-0 mp:left-0 mp:bg-accent"
            style={{ width: `${Math.round((episode.watched ? 1 : episode.share) * 100)}%` }}
          />
        </span>
      </button>
      {open ? (
        <div className="mp:grid mp:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] mp:gap-4 mp:px-4 mp:pb-4 mp:@max-[520px]:grid-cols-1">
          <button
            type="button"
            onClick={episode.current ? undefined : onPlay}
            disabled={episode.current}
            className="mp:group/art mp:relative mp:block mp:overflow-hidden mp:rounded-[8px] mp:text-left mp:disabled:cursor-default"
            aria-label={
              episode.current
                ? t('episodesNowPlaying')
                : t('episodesPlay', { number: episode.number, name: episode.name })
            }
            data-play-episode={episode.current ? undefined : ''}
          >
            {episode.art}
            <span
              className={cx(
                'mp:absolute mp:inset-0 mp:grid mp:place-items-center mp:bg-black/45 mp:transition-colors',
                !episode.current && 'mp:group-hover/art:bg-black/30',
              )}
            >
              {episode.current ? (
                <span className="mp:flex mp:items-center mp:gap-2 mp:text-base mp:font-semibold mp:text-white">
                  <Icon name="audio" size={18} />
                  {t('episodesNowPlaying')}
                </span>
              ) : (
                <span className="mp:grid mp:size-12 mp:place-items-center mp:rounded-full mp:border-2 mp:border-white/90 mp:bg-black/35 mp:text-white mp:transition-transform mp:duration-150 mp:ease-soft mp:group-hover/art:scale-106">
                  <Icon name="play" size={20} />
                </span>
              )}
            </span>
          </button>
          <div className="mp:grid mp:content-start mp:gap-2">
            {episode.overview ? (
              <p className="mp:m-0 mp:line-clamp-5 mp:text-sm mp:leading-relaxed mp:text-ink/90">
                {episode.overview}
              </p>
            ) : null}
            <p className="mp:m-0 mp:text-xs mp:text-muted mp:tabular-nums">
              {[
                episode.duration > 0 ? formatDuration(episode.duration) : null,
                episode.watched ? t('episodesWatched') : null,
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </p>
          </div>
        </div>
      ) : null}
    </li>
  )
}
