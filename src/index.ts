// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/**
 * Web-Media-Player: a complete video player for the web, built for React. It plays MKV, HEVC,
 * AC-3, DTS, multiple audio tracks and embedded subtitles in the browser, with a timeline with
 * previews and chapters, a subtitle look panel, picture in picture, a miniplayer, "Skip intro"
 * and Up Next.
 *
 * Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here). MIT licence.
 */
export {
  Player,
  type PlayerProps,
  type PlayerHandle,
  type PlayerLayout,
  type MiniControls,
} from './components/Player.js'
export type { PlayerSource } from './lib/source.js'
export type { SubtitleFile } from './hooks/useExternalSubtitles.js'
export type { UpNext } from './hooks/useUpNext.js'
export type { LoaderInfo } from './components/PlayerLoader.js'
export type { SkipKind, SkipSegment } from './lib/skip.js'
export { createStillWatching, type StillWatching } from './lib/still-watching.js'

export { SubtitleStyleControls, SubtitlePreview } from './components/SubtitleStyleControls.js'
export { useSubtitleStyle } from './hooks/useSubtitleStyle.js'
export {
  subtitleStyle,
  DEFAULT_STYLE,
  type SubtitleStyle,
  type SubtitleSize,
  type SubtitleColor,
  type SubtitleEdge,
  type SubtitlePosition,
  type SubtitleFont,
} from './lib/subtitle-style.js'

export { defaultLabels, type PlayerLabels } from './lib/labels.js'
export { configureStorage, type PlayerStorage, type StorageOptions } from './lib/storage.js'
export { parseSubtitle, detectFormat, CueTrack, type SubtitleFormat } from './lib/cues.js'
export { formatDuration } from './lib/format.js'

export type {
  ChapterMark,
  EngineKind,
  MediaEngine,
  MediaLike,
  TrackList,
  TrackOption,
} from './lib/engine.js'
export { preloadDecoder, type ByteSource } from 'web-buildin-decoder'
