// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { Translate } from '../lib/labels.js'
import { languageLabel } from './languages.js'
import { providerLabel, type SubtitleHit, type SubtitleNotice } from './models.js'
import type { OnlineStatus } from './service.js'

/**
 * The sentences the online subtitle states read as, the same on every screen: the player's
 * search panel and an app's own settings page. Every word comes from the player's labels
 * (`t`), so an app's translation covers these too.
 */
export interface Words {
  t: Translate
  /** For language names and the times quotas reset; the browser's when absent. */
  locale?: string
}

export function noticeText(words: Words, notice: SubtitleNotice, now = Date.now()): string {
  const { t } = words
  switch (notice.kind) {
    case 'signInToDownload':
      return t('onlineNoticeSignInToDownload')
    case 'quotaUsed':
      return notice.resetAt
        ? t('onlineNoticeQuotaUsedUntil', { time: resetTime(words, notice.resetAt, now) })
        : t('onlineNoticeQuotaUsed')
    case 'freeQuotaUsed':
      return notice.resetAt
        ? t('onlineNoticeFreeQuotaUsedUntil', { time: resetTime(words, notice.resetAt, now) })
        : t('onlineNoticeFreeQuotaUsed')
    case 'signInExpired':
      return t('onlineNoticeSignInExpired')
    case 'unavailable':
      return t('onlineNoticeUnavailable')
    case 'busy':
      return t('onlineNoticeBusy')
    case 'offline':
      return t('onlineNoticeOffline')
    case 'subdlKeyRefused':
      return t('onlineNoticeSubdlKeyRefused')
    case 'unreadable':
      return t('onlineNoticeUnreadable')
  }
}

/** Notices worth a Try again button: the next attempt may well go through. */
export const retryable = (notice: SubtitleNotice | null) =>
  notice?.kind === 'offline' || notice?.kind === 'busy'

/** One line under a result: language, and the marks that tell results apart. */
export function hitDetail(words: Words, hit: SubtitleHit): string {
  const { t } = words
  return [
    languageLabel(hit.language, t('unknownLanguage'), words.locale),
    hit.hashMatch ? t('onlineExactMatch') : null,
    hit.hearingImpaired ? t('onlineHearingImpaired') : null,
    hit.machine ? t('onlineMachineTranslated') : null,
    hit.downloads > 0 ? t('onlineDownloads', { count: hit.downloads }) : null,
    providerLabel(hit.provider),
  ]
    .filter(Boolean)
    .join('  ·  ')
}

/** The name a downloaded subtitle gets in the menu: its language and where it came from. */
export function trackLabel(words: Words, hit: SubtitleHit): string {
  const language = languageLabel(hit.language, words.t('unknownLanguage'), words.locale)
  return `${language} · ${providerLabel(hit.provider)}`
}

/** "N of M downloads left today". */
export function downloadsLeft(words: Words, remaining: number, allowed: number): string {
  return words.t('onlineDownloadsLeft', { remaining, count: allowed })
}

/** A reset time as the clock reads it, or the date and time when it is not today. */
export function resetTime(words: Words, at: number, now = Date.now()): string {
  const date = new Date(at)
  const today = new Date(now).toDateString() === date.toDateString()
  return today
    ? date.toLocaleTimeString(words.locale, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleString(words.locale, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

/** The line under an account row in a settings page. */
export function statusText(words: Words, status: OnlineStatus, now = Date.now()): string {
  const { t } = words
  switch (status.kind) {
    case 'unavailable':
      return noticeText(words, { kind: 'unavailable' })
    case 'signedOut':
      return t('onlineStatusSignedOut')
    case 'expired':
      return t('onlineStatusExpired', { user: status.username })
    case 'signedIn':
      return status.remaining >= 0 && status.allowed > 0
        ? t('onlineStatusSignedInLeft', {
            user: status.username,
            left: downloadsLeft(words, status.remaining, status.allowed),
          })
        : t('onlineStatusSignedIn', { user: status.username })
    case 'quotaUsed':
      return `${t('onlineStatusSignedIn', { user: status.username })} ${noticeText(words, { kind: 'quotaUsed', resetAt: status.resetAt }, now)}`
    case 'freeQuotaUsed':
      return status.resetAt
        ? t('onlineStatusFreeQuotaUsedUntil', { time: resetTime(words, status.resetAt, now) })
        : t('onlineStatusFreeQuotaUsed')
  }
}
