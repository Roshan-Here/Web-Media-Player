// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { cx } from '../lib/cx.js'
import { useT } from '../lib/labels.js'
import type {
  SearchResult,
  SubtitleHit,
  SubtitleNotice,
  SubtitleTarget,
  SubtitleText,
} from '../online/models.js'
import { cacheId, type OnlineSubtitleService } from '../online/service.js'
import { hitDetail, noticeText, retryable, type Words } from '../online/words.js'
import { Button } from './Button.js'
import { Icon } from './Icon.js'
import { Spinner } from './Spinner.js'

/** Long enough that an ordinary search never sees it; short enough to offer a way out. */
const SLOW_AFTER_MS = 15_000

export interface OnlineSubtitlesPanelProps {
  service: OnlineSubtitleService
  target: () => Promise<SubtitleTarget | null>
  /** Shows the subtitle; false when it held nothing the player can show. */
  onLoaded: (subtitle: SubtitleText, label: string, hit: SubtitleHit) => boolean
  onClose: () => void
  locale?: string
}

const never = () => () => undefined
let version = 0
const bump = (listener: () => void) => () => {
  version += 1
  listener()
}

/**
 * The Subtitles menu's "Search online": a panel over the picture listing what the service has
 * for the video, best first. Choosing one downloads it and shows it in the player's caption
 * line. What blocks a download is said on the first line, and the results it blocks are dimmed.
 */
export function OnlineSubtitlesPanel({
  service,
  target,
  onLoaded,
  onClose,
  locale,
}: OnlineSubtitlesPanelProps) {
  const t = useT()
  const words: Words = { t, locale }
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [wanted, setWanted] = useState<SubtitleTarget | null>(null)
  const [cached, setCached] = useState<Set<string>>(() => new Set())
  const [notice, setNotice] = useState<SubtitleNotice | null>(null)
  const [busy, setBusy] = useState<SubtitleHit | null>(null)
  const [slow, setSlow] = useState(false)
  // Drawn again when the service says what it blocks has changed (a sign in, a used up quota).
  useSyncExternalStore(
    service.subscribe ? (listener) => service.subscribe!(bump(listener)) : never,
    () => version,
    () => version,
  )
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlow(true)
    }, SLOW_AFTER_MS)
    void (async () => {
      try {
        const wantedNow = await target()
        const found: SearchResult = wantedNow
          ? await service.search(wantedNow)
          : { hits: [], notice: null, fromCache: false }
        const kept = await service.cachedIds(found.hits)
        if (cancelled) return
        setWanted(wantedNow)
        setCached(kept)
        setResult(found)
      } catch {
        if (!cancelled) setResult({ hits: [], notice: { kind: 'offline' }, fromCache: false })
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(slowTimer)
    }
  }, [service, target, attempt])

  const retry = () => {
    setResult(null)
    setNotice(null)
    setSlow(false)
    setAttempt((n) => n + 1)
  }

  const choose = async (hit: SubtitleHit) => {
    if (busy) return
    setBusy(hit)
    let done
    try {
      done = await service.download(hit, wanted)
    } catch {
      done = { kind: 'failed', notice: { kind: 'offline' } } as const
    }
    setBusy(null)
    if (done.kind === 'failed') {
      setNotice(done.notice)
      return
    }
    if (onLoaded(done.subtitle, done.label, hit)) onClose()
    else setNotice({ kind: 'unreadable' })
  }

  const reason = notice ?? result?.notice ?? null
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('onlineTitle')}
      tabIndex={-1}
      className="mp:absolute mp:top-[calc(var(--mp-overlay-top,0px)+0.75rem)] mp:right-3 mp:z-3 mp:flex mp:max-h-[calc(100%-7rem)] mp:w-[min(460px,calc(100%-1.5rem))] mp:flex-col mp:rounded-xl mp:border mp:border-line-strong mp:bg-surface/96 mp:shadow-[0_18px_40px_-12px_color-mix(in_srgb,var(--mp-color-shadow)_70%,transparent)] mp:backdrop-blur-md mp:outline-none mp:@max-[520px]:top-2 mp:@max-[520px]:right-2 mp:@max-[520px]:max-h-[calc(100%-6rem)] mp:@max-[520px]:w-[calc(100%-1rem)]"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
      data-online-subtitles=""
    >
      <div className="mp:flex mp:items-center mp:gap-2 mp:py-1.5 mp:pr-1.5 mp:pl-4">
        <h2 className="mp:flex-1 mp:truncate mp:text-base mp:font-semibold">{t('onlineTitle')}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="mp:grid mp:size-9 mp:place-items-center mp:rounded-full mp:text-muted mp:transition-colors mp:hover:bg-raised mp:hover:text-ink"
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="mp:min-h-0 mp:overflow-y-auto mp:px-2 mp:pb-2">
        {result === null ? (
          <div className="mp:grid mp:gap-2 mp:px-2 mp:py-1" role="status">
            <div className="mp:flex mp:items-center mp:gap-2.5 mp:text-sm mp:text-muted">
              <Spinner size={18} />
              {t('onlineSearching')}
            </div>
            {slow ? (
              <div className="mp:flex mp:flex-wrap mp:items-center mp:gap-2 mp:text-sm mp:text-muted">
                {t('onlineSlow')}
                <Button size="small" variant="ghost" icon="refresh" onClick={retry}>
                  {t('tryAgain')}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {reason ? (
              <p
                className="mp:m-0 mp:mb-2 mp:rounded-control mp:bg-raised mp:px-3 mp:py-2.5 mp:text-sm"
                role="status"
              >
                {noticeText(words, reason)}
              </p>
            ) : result.hits.length === 0 ? (
              <p className="mp:m-0 mp:px-2 mp:py-1 mp:text-sm mp:text-muted" role="status">
                {t('onlineNoneFound')}
              </p>
            ) : null}
            {retryable(reason) ? (
              <Button
                size="small"
                variant="ghost"
                icon="refresh"
                className="mp:mb-1"
                onClick={retry}
              >
                {t('tryAgain')}
              </Button>
            ) : null}
            <ul className="mp:m-0 mp:grid mp:list-none mp:gap-0.5 mp:p-0">
              {result.hits.map((hit) => {
                const id = cacheId(hit)
                const blocked = service.blockedFor(hit, cached.has(id))
                return (
                  <li key={id}>
                    <button
                      type="button"
                      disabled={blocked !== null || busy !== null}
                      onClick={() => void choose(hit)}
                      title={blocked ? noticeText(words, blocked) : undefined}
                      className={cx(
                        'mp:grid mp:w-full mp:gap-0.5 mp:rounded-control mp:px-2.5 mp:py-1.5 mp:text-left mp:transition-colors mp:hover:bg-raised mp:focus-visible:bg-raised mp:focus-visible:outline-none mp:disabled:cursor-not-allowed mp:disabled:hover:bg-transparent',
                        blocked && 'mp:opacity-40',
                      )}
                    >
                      <span className="mp:truncate mp:text-sm mp:text-ink">
                        {hit.release.trim() || hit.fileName}
                      </span>
                      <span className="mp:line-clamp-2 mp:text-xs mp:text-faint">
                        {busy === hit ? t('onlineDownloading') : hitDetail(words, hit)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
