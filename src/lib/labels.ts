// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { createContext, useContext } from 'react'

/**
 * Every piece of text the player shows or reads out to screen readers, in English. Pass your own
 * (all or some) through the `labels` prop to translate the player. `{name}` marks a value that is
 * filled in, and stays as it is in a translation. A label can also be a function of those
 * values, for languages whose words change with a number: `(v) => plural(v.count, ...)`.
 */
export const defaultLabels = {
  region: 'Video player: {title}',
  regionMini: 'Miniplayer: {title}',
  opening: 'Opening the video',
  loading: 'Loading',
  play: 'Play',
  pause: 'Pause',
  playKey: 'Play (k)',
  pauseKey: 'Pause (k)',
  back10: 'Back 10 seconds',
  back10Key: 'Back 10 seconds (j)',
  forward10: 'Forward 10 seconds',
  forward10Key: 'Forward 10 seconds (l)',
  mute: 'Mute',
  unmute: 'Unmute',
  muteKey: 'Mute (m)',
  muted: 'Muted',
  volume: 'Volume',
  volumePercent: '{percent}%',
  subtitles: 'Subtitles',
  subtitlesNoneInVideo: 'Subtitles (none in this video)',
  subtitlesKey: 'Subtitles (c)',
  audioTrack: 'Audio track',
  playbackSettings: 'Playback settings',
  speedAndDecoder: 'Speed and decoder',
  speed: 'Speed',
  speedValue: '{speed}x',
  speedNormal: 'Normal speed',
  speedTimes: '{speed} times speed',
  decoder: 'Decoder',
  decoderBuiltin: 'Built-in',
  decoderBuiltinDetail: 'Every common format, with audio and subtitle tracks',
  decoderBrowser: 'Browser',
  decoderBrowserDetail: 'Lighter on battery; MP4 and WebM only',
  decoderBrowserCannot: 'Cannot play this file',
  miniplayer: 'Miniplayer',
  miniplayerKey: 'Miniplayer (i)',
  pip: 'Picture in picture',
  pipClose: 'Close picture in picture',
  pipKeyI: 'Picture in picture (i)',
  pipKeyP: 'Picture in picture (p)',
  pipPlaying: 'Playing in picture in picture',
  pipWindow: 'Picture in picture: {title}',
  pipFailed: 'Picture in picture did not open. The browser may have blocked it.',
  backToTab: 'Back to the tab',
  fullscreen: 'Full screen',
  fullscreenExit: 'Exit full screen',
  fullscreenKey: 'Full screen (f)',
  turnOnSound: 'Turn on sound',
  tryAgain: 'Try again',
  useBuiltin: 'Use the built-in decoder',
  useBrowser: 'Use the browser decoder',
  copyDetails: 'Copy details',
  copied: 'Copied',
  expand: 'Expand',
  expandKey: 'Expand (i)',
  close: 'Close',
  closeMiniplayer: 'Close the miniplayer',
  seek: 'Seek',
  seekValue: '{position} of {duration}',
  seekValueChapter: '{position} of {duration}, {chapter}',
  chapters: 'Chapters',
  chapterN: 'Chapter {n}',
  trackN: 'Track {n}',
  subtitleTrackN: 'Subtitles {n}',
  chapterButton: 'Chapter: {title}. Show all chapters',
  skipKey: '{label} (S)',
  hudSubtitleSize: 'Subtitles: {size}',
  hudSubtitleTiming: 'Subtitle timing {delay}',
  off: 'Off',
  subtitlesBrowserCannot: 'The browser decoder cannot show subtitles from inside the file.',
  subtitlesNone: 'This video has no subtitles.',
  subtitlesBuiltinDetail: 'Shows the subtitles inside the file',
  subtitleFileDetail: 'Subtitle file',
  look: 'Look and timing',
  lookDetail: 'Size, colour, background, position',
  lookDetailDelay: 'Size, colour, background, position, {delay}',
  noticeBuiltinFailed: 'The built-in decoder did not load, so this is the browser decoder.',
  noticeBrowserUnavailable:
    'The browser decoder needs a URL or a file to play, so this is the built-in decoder.',
  noticeSubtitleFailed: 'That subtitle file could not be read.',
  errorDidNotOpen: 'This video did not open',
  errorDidNotPlay: 'This video did not play',
  errorDecoderStopped: 'The decoder stopped.',
  errorReadFailed: 'Reading the file failed: {reason}',
  codecUnsupported: '{codec}, not supported yet',
  codecTimedText: 'Timed text',
  channelsMono: 'mono',
  channelsStereo: 'stereo',
  channelsCount: '{count} ch',
  errorOpenGeneric: 'Something went wrong while opening it.',
  errorStoppedLoading: 'The video stopped loading',
  errorConnectionDropped: 'The connection dropped while loading the video.',
  errorBrowserCannotPlay: 'The browser cannot play this file',
  errorSwitchBuiltin: 'Switch to the built-in decoder, which plays every common format.',
  loaderResuming: 'Resuming from {time}',
  loaderStarting: 'Starting',
  loaderSlow: 'Taking longer than usual',
  upNextRegion: 'Next episode',
  upNextHeading: 'Next episode',
  upNextHide: 'Hide',
  upNextPlayNow: 'Play now',
  upNextPlayingIn: 'Playing in {count} seconds',
  upNextIn: 'Next episode in {seconds}',
  upNextCancel: 'Cancel',
  stillWatching: 'Still watching?',
  stillWatchingBody: 'A few episodes have played in a row. The next one is {episode}.',
  playNext: 'Play next episode',
  notNow: 'Not now',
  skipRecap: 'Skip recap',
  skipIntro: 'Skip intro',
  skipOpening: 'Skip opening',
  skipCredits: 'Skip credits',
  skipEnding: 'Skip ending',
  skipPreview: 'Skip preview',
  styleSize: 'Size',
  styleColour: 'Colour',
  styleBackground: 'Background',
  styleBackgroundNone: 'None',
  styleBackgroundBox: 'Dark box',
  styleHowDark: 'How dark',
  stylePercent: '{percent}%',
  styleEdge: 'Edge',
  stylePosition: 'Position',
  styleTypeface: 'Typeface',
  styleWeight: 'Weight',
  styleWeightRegular: 'Regular',
  styleWeightBold: 'Bold',
  stylePreview: 'Preview',
  stylePreviewText: 'Subtitles will look like this,\nover any picture.',
  sizeSmall: 'Small',
  sizeMedium: 'Medium',
  sizeLarge: 'Large',
  sizeXlarge: 'Extra large',
  colourWhite: 'White',
  colourYellow: 'Yellow',
  colourCyan: 'Cyan',
  colourGreen: 'Green',
  colourPink: 'Pink',
  edgeOutline: 'Outline',
  edgeShadow: 'Shadow',
  edgeNone: 'None',
  positionBottom: 'Bottom',
  positionRaised: 'Raised',
  positionHigh: 'High',
  fontDefault: 'Default',
  fontSerif: 'Serif',
  fontTypewriter: 'Typewriter',
  delayNone: '0 s',
  delaySeconds: '{value} s',
  lookTitle: 'Subtitle look and timing',
  timing: 'Timing for this video',
  earlier: 'Earlier',
  earlierKey: 'Show subtitles earlier (Z)',
  later: 'Later',
  laterKey: 'Show subtitles later (X)',
  timingLabel: 'Subtitle timing {delay}',
  reset: 'Reset',
  timingHint: 'Later when the words come before they are spoken, earlier when they come after.',
  defaultLook: 'Back to the default look',
  onlineTitle: 'Subtitles online',
  onlineSearch: 'Search online',
  onlineSearchDetail: 'Find subtitles for this video online',
  onlineFound: 'Found online',
  onlineSearching: 'Searching online…',
  onlineSlow: 'This is taking longer than usual.',
  onlineNoneFound: 'No subtitles found online for this video.',
  onlineDownloading: 'Downloading subtitles…',
  onlineExactMatch: 'Exact match',
  onlineHearingImpaired: 'Hearing impaired',
  onlineMachineTranslated: 'Machine translated',
  onlineDownloads: '{count} downloads',
  onlineDownloadsLeft: '{remaining} of {count} downloads left today',
  unknownLanguage: 'Unknown language',
  onlineNoticeSignInToDownload:
    'OpenSubtitles asked for an account for this download. Sign in to download it.',
  onlineNoticeQuotaUsedUntil:
    'No downloads left until {time}. Subtitles already downloaded still work.',
  onlineNoticeQuotaUsed: 'No downloads left today. Subtitles already downloaded still work.',
  onlineNoticeFreeQuotaUsedUntil:
    'Downloads without an account are used up until {time}. Sign in to OpenSubtitles for your own daily quota.',
  onlineNoticeFreeQuotaUsed:
    "Today's downloads without an account are used up. Sign in to OpenSubtitles for your own daily quota.",
  onlineNoticeSignInExpired:
    'Your OpenSubtitles sign-in has expired. Downloads carry on without an account; sign in again for your own daily quota.',
  onlineNoticeUnavailable:
    'Online subtitles are unavailable right now. Subtitles already downloaded still work.',
  onlineNoticeBusy: 'OpenSubtitles is busy. Try again in a minute.',
  onlineNoticeOffline: "Couldn't reach the subtitle service. Check the connection and try again.",
  onlineNoticeSubdlKeyRefused: "SubDL didn't accept the key.",
  onlineNoticeUnreadable: "That subtitle file couldn't be read. Try another one.",
  onlineStatusSignedOut:
    'Optional. Subtitles download without an account. Sign in for your own daily quota.',
  onlineStatusExpired:
    "{user}'s sign-in has expired. Downloads carry on without an account. Sign in again for your own daily quota.",
  onlineStatusSignedIn: 'Signed in as {user}.',
  onlineStatusSignedInLeft: 'Signed in as {user}. {left}.',
  onlineStatusFreeQuotaUsedUntil:
    'Not signed in. Downloads without an account are used up until {time}. Sign in for your own daily quota.',
  onlineStatusFreeQuotaUsed:
    "Not signed in. Today's downloads without an account are used up. Sign in for your own daily quota.",
}

export type LabelKey = keyof typeof defaultLabels
/** A label: text with `{placeholders}`, or a function of the values that returns the text. */
export type LabelValue = string | ((values: Record<string, string | number>) => string)
export type PlayerLabels = Record<LabelKey, LabelValue>

/** A label with its `{placeholders}` filled in. */
export type Translate = (key: LabelKey, values?: Record<string, string | number>) => string

export function makeTranslate(labels: PlayerLabels): Translate {
  return (key, values) => {
    const label = labels[key] ?? defaultLabels[key]
    return typeof label === 'function' ? label(values ?? {}) : fill(label, values)
  }
}

/** Fills `{name}` placeholders; unknown ones are left as they are. */
export function fill(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

export function resolveLabels(overrides?: Partial<PlayerLabels>): PlayerLabels {
  return overrides ? { ...defaultLabels, ...overrides } : defaultLabels
}

export const LabelsContext = createContext<Translate>(makeTranslate(defaultLabels))

/** The player's text, in the language the app gave it. */
export function useT(): Translate {
  return useContext(LabelsContext)
}
