# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-10-28

### Added

- Subtitles from the web: the `onlineSubtitles` prop adds "Search online" to the Subtitles
  menu, a panel listing what a subtitle service has for the video, best first, with what blocks
  a download said on its first line. The chosen subtitle shows in place of the video's own
  tracks, with the same look and timing, and its language is searched first for the next
  episode of the same show.
- `createOnlineSubtitles({ apiKey, appName, appVersion })`: OpenSubtitles (with the viewer's
  optional account, and the downloads allowed without one) and SubDL as a second source with
  the viewer's own key. Results are ranked by file hash, show, season, episode and release;
  searches and files are kept in IndexedDB for up to six months.
- `OnlineSubtitleService`, for plugging in a source of your own, with `makeHit`.
- What a settings page needs for the feature: `status()`, `signIn()`, `signOut()`,
  `setSubdlKey()`, and `statusText`, `noticeText` and `downloadsLeft` for the words.
- `PlayerSource.openUrl`: an address for the browser decoder made when it starts (a Service
  Worker stream over your own bytes, say), released when it stops; null hands the video to the
  built-in decoder.
- `PlayerSource.previewUrl`: where the browser decoder's timeline previews read the video, set
  up on the first preview and released with the video; `false` for none.
- `LabelsProvider`, to translate the player's parts used outside a player, and `PlayerLoader`
  with `loaderStatus`, the pre-roll, for a placeholder shown before the player arrives.
- Labels may be functions of their values (`LabelValue`), for plurals a template cannot
  express. `makeTranslate`, `LabelKey` and `Translate` are exported.

### Changed

- A timeline preview that could not be made is tried again after 10 seconds instead of never.
- Works with Web-Buildin-decoder 0.2, whose download scheduling makes seeking on a slow link
  about twice as quick.

## [0.1.0] - 2026-10-27

First release.

### Added

- `<Player>`: a React video player over two decoders, the built-in one (every common format,
  with its audio and subtitle tracks, through Web-Buildin-decoder) and the browser's own
  `<video>`, with automatic fallback between them.
- Sources: a URL (Range requests), a local `File` or `Blob`, or your own bytes through `open`.
- Controls: play, seek ±10 s, volume with an animated icon, time, speed, decoder choice, full
  screen (with a fill-the-window fallback for iPhone), picture in picture (a floating window
  with its own controls where Document Picture-in-Picture exists, the system's elsewhere), and
  the system's media controls.
- A timeline that is an accessible slider, merges bursts of seeks, shows chapters as segments,
  and previews the scene under the pointer.
- Audio track menu, subtitle menu with the file's own tracks and subtitle files you pass
  (SRT, WebVTT, ASS/SSA), and a subtitle look and timing panel (size, colour, background, edge,
  position, typeface, ±10 s timing per video).
- Chapters menu, Shift+arrows to jump between chapters.
- "Skip intro" (recap, opening, credits, ending, preview) from times you pass or from chapter
  names in the file.
- Up Next: a card near the end, a countdown, and "Still watching?" with `createStillWatching`.
- A pre-roll while the video opens (backdrop, poster, title, overview, progress).
- A miniplayer layout that docks without interrupting playback.
- Autoplay that falls back to muted with a "Turn on sound" button.
- An error panel with retry, switch decoder and copy diagnostics.
- Keyboard shortcuts, scoped to the player by default.
- Remembered volume, decoder, track languages, subtitle look and timing, with
  `configureStorage` to change or turn off storage.
- Every label replaceable through `labels`, for translation.
- A self-contained stylesheet: `mp:`-prefixed utilities and `--mp-*` design tokens that never
  touch the page, an `accentColor` prop, and theming through CSS variables.
- An imperative handle (`ref`) to play, pause, seek and read diagnostics.

[0.2.0]: https://github.com/Roshan-Here/Web-Media-Player/releases/tag/v0.2.0
[0.1.0]: https://github.com/Roshan-Here/Web-Media-Player/releases/tag/v0.1.0
