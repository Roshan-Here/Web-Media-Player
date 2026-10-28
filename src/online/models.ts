// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/*
 * Online subtitles (after TMPlayer's SubtitleModels.kt and friends): what a search is for, what
 * a provider offers, and why a search or a download gave less than hoped.
 */

/**
 * Where an online subtitle comes from: the two built in, or the name of your own provider
 * (shown as it is, since a provider's name is never translated).
 */
export type SubtitleProvider = 'OpenSubtitles' | 'Subdl' | (string & {})

export const PROVIDER_LABEL: Record<string, string> = {
  OpenSubtitles: 'OpenSubtitles',
  Subdl: 'SubDL',
}

/** The provider's name as people know it. */
export const providerLabel = (provider: SubtitleProvider): string =>
  PROVIDER_LABEL[provider] ?? provider

/** OpenSubtitles before SubDL when everything else ties. */
export const PROVIDER_ORDER: Record<string, number> = { OpenSubtitles: 0, Subdl: 1 }

/** What the player knows about the video, for the search. */
export interface SubtitleSearchInfo {
  fileName: string | null
  caption: string
  title: string
}

/**
 * What a search is for: the name to parse (and the caption beside it), the OpenSubtitles hash
 * when both ends of the file could be read, and the languages wanted, best first.
 */
export interface SubtitleTarget {
  name: string
  caption?: string | null
  hash?: string | null
  languages: string[]
}

/** One subtitle a provider offers. `id` is OpenSubtitles' file id, or SubDL's download path. */
export interface SubtitleHit {
  provider: SubtitleProvider
  id: string
  language: string
  release: string
  fileName: string
  downloads: number
  hashMatch: boolean
  hearingImpaired: boolean
  /** Machine or AI translated, which a search leaves out unless the person asked for them. */
  machine: boolean
  /**
   * What OpenSubtitles itself files the subtitle under (`feature_details`): the show for an
   * episode (its parent title), the film otherwise, with the season, episode and year it gives.
   */
  featureTitle: string
  featureSeason: number | null
  featureEpisode: number | null
  featureYear: number | null
}

export function makeHit(fields: Partial<SubtitleHit> & Pick<SubtitleHit, 'provider' | 'id'>) {
  return {
    language: '',
    release: '',
    fileName: '',
    downloads: 0,
    hashMatch: false,
    hearingImpaired: false,
    machine: false,
    featureTitle: '',
    featureSeason: null,
    featureEpisode: null,
    featureYear: null,
    ...fields,
  } satisfies SubtitleHit
}

/**
 * Why a search or a download did not give everything it might have, in words every screen shows
 * the same way. A search can carry one beside its hits: a list is still worth showing when
 * downloading is what is blocked.
 */
export type SubtitleNotice =
  /** OpenSubtitles turned down a download made without an account. */
  | { kind: 'signInToDownload' }
  /** The signed in person's downloads for the day are used up; resetAt is when more arrive. */
  | { kind: 'quotaUsed'; resetAt: number | null }
  /** The downloads OpenSubtitles allows without an account are used up until resetAt. */
  | { kind: 'freeQuotaUsed'; resetAt: number | null }
  /** The sign in ran out and has to be done again. */
  | { kind: 'signInExpired' }
  /** The app's key was refused: the provider is off until a new key arrives. */
  | { kind: 'unavailable' }
  /** Too many requests a moment ago. */
  | { kind: 'busy' }
  /** No answer from the provider at all. */
  | { kind: 'offline' }
  /** The SubDL key the person typed in was refused. */
  | { kind: 'subdlKeyRefused' }
  /** The file arrived but held no subtitle in a format the player reads. */
  | { kind: 'unreadable' }

/** A search's answer: the hits, best first, and why there may be fewer than hoped. */
export interface SearchResult {
  hits: SubtitleHit[]
  notice: SubtitleNotice | null
  fromCache: boolean
}

/** A subtitle file as text, with the format its extension names. */
export interface SubtitleText {
  extension: SubtitleFormat
  text: string
}

export type SubtitleFormat = 'srt' | 'ass' | 'ssa' | 'vtt'

/** A download's answer: the subtitle text ready for the player, or why not. */
export type DownloadResult =
  | { kind: 'done'; subtitle: SubtitleText; label: string; fromCache: boolean }
  | { kind: 'failed'; notice: SubtitleNotice }
