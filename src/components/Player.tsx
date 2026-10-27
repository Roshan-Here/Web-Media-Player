// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { diagnosticsReport, logDecoder as logPlayer } from 'web-buildin-decoder'
import { useFileChapters, useTimelineChapters } from '../hooks/useChapters.js'
import { useEngine } from '../hooks/useEngine.js'
import {
  externalId,
  useExternalSubtitles,
  type SubtitleFile,
} from '../hooks/useExternalSubtitles.js'
import { useMediaState } from '../hooks/useMediaState.js'
import { useSeek } from '../hooks/useSeek.js'
import { useSeekPreview } from '../hooks/useSeekPreview.js'
import { useSkip } from '../hooks/useSkip.js'
import { useSubtitleStyle } from '../hooks/useSubtitleStyle.js'
import { useUpNext, type UpNext } from '../hooks/useUpNext.js'
import { chapterIndexAt, chapterJump } from '../lib/chapters.js'
import { cx } from '../lib/cx.js'
import {
  setMedia,
  type ChapterMark,
  type EngineKind,
  type MediaEngine,
  type MediaLike,
} from '../lib/engine.js'
import { formatDuration } from '../lib/format.js'
import {
  LabelsContext,
  makeTranslate,
  resolveLabels,
  useT,
  type PlayerLabels,
} from '../lib/labels.js'
import {
  openPictureInPictureWindow,
  openVideoPictureInPicture,
  pictureInPictureSupport,
} from '../lib/picture-in-picture.js'
import { browserCanPlaySource, sourceKey, type PlayerSource } from '../lib/source.js'
import { creditsStart, skipLabel, type SkipKind, type SkipSegment } from '../lib/skip.js'
import {
  DELAY_STEP,
  SIZES,
  captionCss,
  clampDelay,
  delayLabel,
  positionPercent,
  stepSize,
  subtitleDelays,
  subtitleStyle,
} from '../lib/subtitle-style.js'
import { SwapIcon, VolumeIcon } from './AnimatedIcons.js'
import { Button } from './Button.js'
import { ControlButton } from './ControlButton.js'
import { Icon, type IconName } from './Icon.js'
import { MenuButton, type MenuSection } from './Menu.js'
import { PipWindow } from './PipWindow.js'
import { PlayerLoader, loaderStatus, type LoaderInfo } from './PlayerLoader.js'
import { SeekBar } from './SeekBar.js'
import { Spinner } from './Spinner.js'
import { SubtitleStylePanel } from './SubtitleStylePanel.js'
import { NextCountdown, StillWatching, UpNextCard } from './UpNext.js'

export interface PlayerProps {
  /** What to play: a `url`, a `file`, or your own bytes through `open`. */
  source: PlayerSource
  /** The video's name: for screen readers, full screen, picture in picture and the system's media controls. */
  title?: string
  /** A picture shown, dimmed, while the video opens. */
  poster?: string | null
  /** Seconds to start from, for resuming. */
  startAt?: number
  /** Start playing as soon as it can (muted, with a "Turn on sound" button, when the browser refuses sound). Default `true`. */
  autoPlay?: boolean
  /**
   * The decoder to start with: `'builtin'` plays every common format with its tracks;
   * `'browser'` is the browser's own `<video>`, lighter but limited. Default: the one the viewer
   * chose last time, else built-in. The viewer can switch in the settings menu.
   */
  decoder?: EngineKind
  /** Whether the browser's own decoder can play this; worked out from the file type when absent. */
  browserCanPlay?: boolean
  /** Subtitle files to offer beside the video's own tracks. */
  subtitles?: readonly SubtitleFile[]
  /** Chapters for a video that has none of its own (or to replace them). */
  chapters?: readonly ChapterMark[]
  /**
   * Stretches to offer a "Skip intro" (recap, credits...) button for. Without them, chapters
   * named "Opening", "Ending" and the like are used.
   */
  skipSegments?: readonly SkipSegment[] | null
  /** Show the "Skip intro" button. Default `true`. */
  skipButton?: boolean
  /** The episode after this one, offered near the end and played when this one ends. */
  upNext?: UpNext | null
  /** Offer and play `upNext` by itself. Default `true`. */
  autoplayNext?: boolean
  /**
   * Full size (`'page'`), or the compact miniplayer (`'mini'`) for docking in a corner while
   * the viewer browses. Playback carries on without a hitch across a change.
   */
  layout?: PlayerLayout
  /** Shows the miniplayer button (and the I key); called to switch layout. */
  onToggleMiniplayer?: () => void
  /** Mini layout: shows a close button; called to stop playback and close it. */
  onClose?: () => void
  /** Mini layout: what goes beside or under the picture, such as the title. */
  renderMiniBar?: (controls: MiniControls) => ReactNode
  /**
   * `'aspect'` (the default) makes the player a 16:9 box as wide as its parent; `'fill'` fills
   * its parent's width and height (give the parent a height).
   */
  fit?: 'aspect' | 'fill'
  /** A pre-roll over the player while the video opens (title, backdrop, poster, overview). */
  loader?: LoaderInfo | null
  /**
   * Where keyboard shortcuts work: `'focused'` (the default) once the viewer has clicked or
   * tabbed into the player; `'global'` anywhere on the page (a watch page); `'off'`.
   */
  keyboard?: 'focused' | 'global' | 'off'
  /** Remember the viewer's volume, decoder, track languages and subtitle timing. Default `true`. */
  rememberSettings?: boolean
  /** Your own text for every label, to translate the player. */
  labels?: Partial<PlayerLabels>
  /** The accent colour of the timeline, buttons and highlights: any CSS colour. */
  accentColor?: string
  /** Where `movi.wasm` is served, when your bundler does not emit it (see the decoder's README). */
  wasmUrl?: string
  /** Called every few seconds while playing, and on pause, with the position and length. */
  onProgress?: (position: number, duration: number) => void
  /** Called when the video plays to its end. */
  onEnded?: () => void
  /** Called when playback fails and will not recover by itself. */
  onError?: (failure: { title: string; message: string }) => void
  /** Called with the engine playing the video, and null when it goes. */
  onEngine?: (engine: MediaEngine | null) => void
  className?: string
  style?: CSSProperties
}

/** Control the player from outside: `const ref = useRef<PlayerHandle>(null)`. */
export interface PlayerHandle {
  /** The playing media (behaves like a `<video>`); null while opening. */
  readonly media: MediaLike | null
  readonly engine: MediaEngine | null
  play(): Promise<void>
  pause(): void
  /** Seeks to `time` seconds. */
  seekTo(time: number): void
  toggleFullscreen(): void
  /** The diagnostics report, for a bug report. */
  diagnostics(): string
}

export type PlayerLayout = 'page' | 'mini'

/** What the miniplayer's bar can show and do. */
export interface MiniControls {
  paused: boolean
  ready: boolean
  togglePlay: () => void
}

const SEEK_STEP = 10
const HIDE_AFTER_MS = 2800
const VOLUME_STEP = 0.05
const VOLUME_HUD_MS = 900

/** The volume a step up or down, on the slider's own steps, so a few presses land on 0 or 1. */
function stepVolume(volume: number, direction: 1 | -1): number {
  const steps = Math.round(volume / VOLUME_STEP) + direction * 2
  return Math.min(1, Math.max(0, steps * VOLUME_STEP))
}
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

/** The picture in picture that is open: our own floating window, or the system's video window. */
type Pip = { kind: 'window'; window: Window } | { kind: 'video'; close: () => void } | null

/**
 * The video player: its own controls over one of two decoders. The built-in decoder plays
 * every common format with its audio and subtitle tracks; the browser decoder is the
 * browser's own `<video>`, lighter but limited to what the browser decodes. Playback starts by
 * itself at the given position (muted, with an offer to turn sound on, when the browser
 * refuses sound), and the viewer's settings are remembered on this device.
 *
 * Import the stylesheet once: `import '@roshan-here/web-media-player/style.css'`.
 */
export const Player = forwardRef<PlayerHandle, PlayerProps>(function Player(props, ref) {
  const labels = useMemo(() => makeTranslate(resolveLabels(props.labels)), [props.labels])
  return (
    <LabelsContext.Provider value={labels}>
      <PlayerView {...props} handleRef={ref} />
    </LabelsContext.Provider>
  )
})

function PlayerView({
  title = '',
  poster,
  source,
  startAt = 0,
  autoPlay = true,
  decoder: initialDecoder,
  browserCanPlay: browserCanPlayProp,
  subtitles: subtitleFiles,
  chapters: givenChapters,
  skipSegments,
  skipButton = true,
  upNext,
  autoplayNext = true,
  layout = 'page',
  onToggleMiniplayer,
  onClose,
  renderMiniBar,
  fit = 'aspect',
  loader,
  keyboard = 'focused',
  rememberSettings = true,
  accentColor,
  wasmUrl,
  onProgress,
  onEnded,
  onError,
  onEngine,
  className,
  style,
  handleRef,
}: PlayerProps & { handleRef: React.ForwardedRef<PlayerHandle> }) {
  const t = useT()
  const key = sourceKey(source)
  const browserCanPlay = useMemo(
    () => browserCanPlayProp ?? browserCanPlaySource(source),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [browserCanPlayProp, key],
  )
  const mini = layout === 'mini'
  const rootRef = useRef<HTMLDivElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const {
    decoder,
    setDecoder,
    retry,
    engine,
    status,
    phase,
    caption,
    audio,
    subtitles,
    selectAudio,
    selectSubtitle,
    notice,
    setNotice,
    soundBlocked,
    unmute,
  } = useEngine({
    surfaceRef,
    source,
    startAt,
    browserCanPlay,
    initialDecoder,
    autoPlay,
    rememberTracks: rememberSettings,
    wasmUrl,
    t,
    onProgress,
  })

  const media = engine?.media ?? null
  const state = useMediaState(media)

  // The app's callbacks, read when called rather than re-subscribed on every render.
  const callbacks = useRef({ onEnded, onError, onEngine })
  useEffect(() => {
    callbacks.current = { onEnded, onError, onEngine }
  })
  useEffect(() => {
    callbacks.current.onEngine?.(engine)
    if (!engine) return
    const ended = () => callbacks.current.onEnded?.()
    engine.media.addEventListener('ended', ended)
    return () => {
      engine.media.removeEventListener('ended', ended)
      callbacks.current.onEngine?.(null)
    }
  }, [engine])
  useEffect(() => {
    if (status.kind === 'failed') callbacks.current.onError?.(status.failure)
  }, [status])
  /** The pre-roll has faded off; it is not shown again for this video. */
  const [loaderGoneFor, setLoaderGoneFor] = useState<string | null>(null)
  const loaderGone = loaderGoneFor === key
  const setLoaderGone = (gone: boolean) => setLoaderGoneFor(gone ? key : null)
  // How subtitles look (one setting for every video) and their timing (this video's own).
  const subStyle = useSubtitleStyle()
  const [delayFor, setDelayFor] = useState(() => ({
    key,
    value: rememberSettings ? subtitleDelays.get(key) : 0,
  }))
  // A new video brings its own timing.
  if (delayFor.key !== key)
    setDelayFor({ key, value: rememberSettings ? subtitleDelays.get(key) : 0 })
  const subtitleDelay = delayFor.key === key ? delayFor.value : 0
  const setSubtitleDelay = useCallback(
    (seconds: number) => {
      const value = clampDelay(seconds)
      setDelayFor({ key, value })
      if (rememberSettings) subtitleDelays.set(key, value)
      return value
    },
    [key, rememberSettings],
  )
  useEffect(() => {
    engine?.setSubtitleDelay(subtitleDelay)
  }, [engine, subtitleDelay])
  const [stylePanelOpen, setStylePanelOpen] = useState(false)
  // The key handler reads the latest timing without being added again on every change.
  const subtitleDelayRef = useRef(subtitleDelay)
  const setDelayRef = useRef(setSubtitleDelay)
  useEffect(() => {
    subtitleDelayRef.current = subtitleDelay
    setDelayRef.current = setSubtitleDelay
  }, [subtitleDelay, setSubtitleDelay])
  const external = useExternalSubtitles({
    files: subtitleFiles,
    media,
    delay: subtitleDelay,
    onError: () => setNotice(t('noticeSubtitleFailed')),
  })
  // A subtitle file marked default turns on once per video, unless the viewer's last choice
  // was one of the video's own tracks in another language.
  const defaultApplied = useRef<string | null>(null)
  useEffect(() => {
    if (status.kind !== 'ready' || defaultApplied.current === key) return
    defaultApplied.current = key
    const index = subtitleFiles?.findIndex((f) => f.default) ?? -1
    if (index >= 0 && !subtitles.selected) external.select(index)
  }, [status.kind, key, subtitleFiles, subtitles.selected, external])
  /** One subtitle shows at a time: a file given to the player in place of the video's own. */
  const shownCaption = external.selected !== null ? external.caption : caption
  const seek = useSeek(media)
  // Timeline previews only once this engine has started playing: the preview decoder is a
  // second FFmpeg and its own reads, and a pointer that happens to rest on the timeline while
  // the video opens must not make the start compete with it.
  const [startedEngine, setStartedEngine] = useState<typeof engine>(null)
  useEffect(() => {
    if (!engine) return
    const onPlaying = () => setStartedEngine(engine)
    engine.media.addEventListener('playing', onPlaying, { once: true })
    return () => engine.media.removeEventListener('playing', onPlaying)
  }, [engine])
  const preview = useSeekPreview(
    engine && startedEngine === engine ? engine.previews : null,
    state.duration,
  )
  /** Where the timeline shows playback: the pending seek target, else the playhead. */
  const shownTime = seek.target ?? state.currentTime

  const offersNext = autoplayNext && !mini && upNext != null
  const seekTo = seek.seekTo
  // The file's own chapters: parts of the timeline, and the "Skip opening" marks below.
  const ownChapters = useFileChapters(engine)
  const fileChapters = givenChapters && givenChapters.length > 0 ? givenChapters : ownChapters
  const chapters = useTimelineChapters(fileChapters, state.duration)
  const chapterIndex = chapterIndexAt(chapters, shownTime)
  const currentChapter = chapters[chapterIndex] ?? null
  const skipper = useSkip({
    chapters: fileChapters,
    given: skipSegments,
    position: state.currentTime,
    duration: state.duration,
    enabled: skipButton && !mini,
    seekTo: useCallback((time: number) => seekTo(time, true), [seekTo]),
    hideClosing: offersNext,
  })
  const next = useUpNext({
    upNext,
    enabled: offersNext && status.kind === 'ready',
    media,
    position: state.currentTime,
    duration: state.duration,
    credits: creditsStart(skipper.segments, state.duration),
  })
  // The key handler reads the latest skip without being added again on every tick.
  const skipRef = useRef(skipper.skip)
  useEffect(() => {
    skipRef.current = skipper.skip
  }, [skipper.skip])
  // The words stay through the pill's exit, after the stretch has passed.
  const [skipKind, setSkipKind] = useState<SkipKind | null>(null)
  if (skipper.active && skipper.active.kind !== skipKind) setSkipKind(skipper.active.kind)

  const [active, setActive] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  // Full screen is the browser's element full screen where it has one, and otherwise (iPhone,
  // whose browsers only let a bare <video> go full screen, losing these controls, the subtitles
  // and the built-in decoder's picture) the player filling the window above everything else.
  const [elementFullscreen, setElementFullscreen] = useState(false)
  const [windowFullscreen, setWindowFullscreen] = useState(false)
  const fullscreen = elementFullscreen || windowFullscreen
  const [copied, setCopied] = useState(false)
  const [pip, setPip] = useState<Pip>(null)
  const pipRef = useRef<Pip>(null)
  useEffect(() => {
    pipRef.current = pip
  }, [pip])

  // Controls hide after a moment of no movement while playing.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A moment's readout when the volume, the subtitles' size or timing, or the chapter is changed
  // from the keyboard, as the controls may be hidden then: 'volume', or the words to show, with
  // the icon of what they are about.
  const [hud, setHud] = useState<string | null>(null)
  const [hudIcon, setHudIcon] = useState<IconName>('subtitles')
  const volumeHudTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = useCallback((what: string, icon: IconName = 'subtitles') => {
    setHud(what)
    setHudIcon(icon)
    if (volumeHudTimer.current) clearTimeout(volumeHudTimer.current)
    volumeHudTimer.current = setTimeout(() => setHud(null), VOLUME_HUD_MS)
  }, [])
  const flashVolume = useCallback(() => flash('volume'), [flash])
  /** To the next chapter, or back to this one's start (or the one before); false when none. */
  const jumpChapter = useCallback(
    (direction: 1 | -1): boolean => {
      const to = chapterJump(chapters, shownTime, direction)
      if (!to) return false
      seekTo(to.start, true)
      flash(to.title, 'chapters')
      return true
    },
    [chapters, shownTime, seekTo, flash],
  )
  // The key handler reads the latest without being added again on every tick.
  const jumpChapterRef = useRef(jumpChapter)
  useEffect(() => {
    jumpChapterRef.current = jumpChapter
  }, [jumpChapter])
  useEffect(
    () => () => {
      if (volumeHudTimer.current) clearTimeout(volumeHudTimer.current)
    },
    [],
  )

  const poke = useCallback(() => {
    setActive(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setActive(false), HIDE_AFTER_MS)
  }, [])
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    [],
  )

  const togglePlay = useCallback(() => {
    if (!media) return
    if (media.paused || media.ended)
      void media.play().catch((e: unknown) => logPlayer('play() refused', e, 'warn'))
    else media.pause()
  }, [media])

  const seekBy = useCallback(
    (delta: number) => {
      seek.seekBy(delta)
      poke()
    },
    [seek, poke],
  )

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else if (windowFullscreen) setWindowFullscreen(false)
    else if (canElementFullscreen(root)) void root.requestFullscreen()
    else setWindowFullscreen(true)
  }, [windowFullscreen])

  useEffect(() => {
    const onChange = () => setElementFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Filling the window: the page under it stops scrolling (and the top bar and other floating
  // parts step aside, see app.css), Escape leaves, and turning the phone keeps it filled.
  useEffect(() => {
    if (!windowFullscreen) return
    const root = document.documentElement
    root.dataset.mpFullscreen = ''
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWindowFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      delete root.dataset.mpFullscreen
      window.removeEventListener('keydown', onKey)
    }
  }, [windowFullscreen])

  // Shrinking into the miniplayer while in full screen leaves full screen too.
  useEffect(() => {
    if (mini && document.fullscreenElement === rootRef.current) void document.exitFullscreen()
  }, [mini])
  if (mini && windowFullscreen) setWindowFullscreen(false)

  // Picture in picture belongs to one engine; a decoder switch or closing the player closes
  // it. Moving between the page layout and the miniplayer does not.
  const closePip = useCallback(() => {
    const current = pipRef.current
    pipRef.current = null
    if (current?.kind === 'window') current.window.close()
    else if (current?.kind === 'video') current.close()
    setPip(null)
  }, [])
  useEffect(() => closePip, [engine, closePip])

  const support = pictureInPictureSupport()
  const togglePip = useCallback(async () => {
    if (!engine) return
    if (pip) {
      closePip()
      return
    }
    try {
      if (support === 'window') {
        const width = Math.min(480, Math.round(window.screen.availWidth / 3))
        const win = await openPictureInPictureWindow({
          width,
          height: Math.round((width * 9) / 16),
        })
        win.addEventListener('pagehide', () => setPip(null), { once: true })
        setPip({ kind: 'window', window: win })
      } else if (support === 'video') {
        const close = await openVideoPictureInPicture({
          video: engine.video,
          captureStream: () => engine.captureStream(),
          media: engine.media,
          keepPictureAlive: () => engine.keepPictureAlive(),
          onClose: () => setPip(null),
        })
        setPip({ kind: 'video', close })
      }
      logPlayer(`picture in picture opened (${support})`)
    } catch (error) {
      logPlayer('picture in picture refused', error, 'warn')
      setNotice(t('pipFailed'))
    }
  }, [engine, pip, support, closePip, setNotice, t])

  const lastSubtitle = useRef<string | null>(null)
  useEffect(() => {
    if (subtitles.selected) lastSubtitle.current = subtitles.selected
  }, [subtitles.selected])
  const selectExternal = external.select
  const externalOn = external.selected !== null
  /** Chooses a subtitle from the menu: one of the video's own, a file given to the player, or off. */
  const chooseSubtitle = useCallback(
    (value: string | null) => {
      const index = value?.startsWith('file:') ? Number(value.slice(5)) : null
      if (index !== null) {
        // One subtitle at a time: the video's own goes while a file shows.
        selectSubtitle(null, subtitleFiles?.[index]?.language ?? null)
        selectExternal(index)
        lastSubtitle.current = value
        return
      }
      selectExternal(null)
      selectSubtitle(value)
    },
    [selectSubtitle, selectExternal, subtitleFiles],
  )
  const toggleSubtitles = useCallback(() => {
    if (externalOn || subtitles.selected) {
      // Off means off: whatever shows goes.
      selectExternal(null)
      selectSubtitle(null)
    } else {
      const first =
        lastSubtitle.current ??
        subtitles.options.find((o) => o.selectable)?.id ??
        (subtitleFiles && subtitleFiles.length > 0 ? externalId(0) : null)
      if (first) chooseSubtitle(first)
    }
  }, [subtitles, selectSubtitle, selectExternal, externalOn, subtitleFiles, chooseSubtitle])

  const switchDecoder = useCallback(
    (next: EngineKind) => {
      if (next !== decoder) setDecoder(next)
    },
    [decoder, setDecoder],
  )

  // With `keyboard="focused"`, keys work once the viewer has clicked or tabbed into the player,
  // and stop when they click elsewhere on the page.
  const engaged = useRef(false)
  useEffect(() => {
    if (keyboard !== 'focused') return
    const onPointer = (event: PointerEvent) => {
      engaged.current = rootRef.current?.contains(event.target as Node) ?? false
    }
    const onFocus = (event: FocusEvent) => {
      if (rootRef.current?.contains(event.target as Node)) engaged.current = true
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('focusin', onFocus, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('focusin', onFocus, true)
    }
  }, [keyboard])

  // Keyboard shortcuts, the ones common video sites use. Ignored while typing in a field and
  // inside menus; the timeline handles its own arrow keys. While the miniplayer is docked the
  // page around it is what the person is using, so only the keys that cannot clash with it
  // (scrolling, buttons, links) work: K, M and I.
  useEffect(() => {
    if (keyboard === 'off') return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (keyboard === 'focused') {
        const inside = target ? (rootRef.current?.contains(target) ?? false) : false
        const onPage = !target || target === document.body || target === document.documentElement
        if (!inside && !(onPage && engaged.current)) return
      }
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        if (!(target instanceof HTMLInputElement && target.type === 'range')) return
      }
      if (target?.closest('[role="menu"]')) return
      // Moving between the page and the miniplayer works before (or without) a picture.
      if (event.key === 'i' && onToggleMiniplayer) {
        event.preventDefault()
        onToggleMiniplayer()
        return
      }
      if (!media) return
      if (mini) {
        if (event.key === 'k') togglePlay()
        else if (event.key === 'm') setMedia(media, { muted: !media.muted })
        else return
        event.preventDefault()
        return
      }
      switch (event.key) {
        case ' ':
        case 'k':
          if (target?.tagName === 'BUTTON') return
          togglePlay()
          break
        case 'ArrowLeft':
        case 'j':
          if (target instanceof HTMLInputElement) return
          // Shift and an arrow: the chapter before (or this one's start), as on video sites.
          if (event.shiftKey && event.key === 'ArrowLeft' && jumpChapterRef.current(-1)) break
          seekBy(-SEEK_STEP)
          break
        case 'ArrowRight':
        case 'l':
          if (target instanceof HTMLInputElement) return
          if (event.shiftKey && event.key === 'ArrowRight' && jumpChapterRef.current(1)) break
          seekBy(SEEK_STEP)
          break
        case 'ArrowUp':
          if (target instanceof HTMLInputElement) return
          setMedia(media, { volume: stepVolume(media.volume, 1), muted: false })
          flashVolume()
          break
        case 'ArrowDown':
          if (target instanceof HTMLInputElement) return
          setMedia(media, { volume: stepVolume(media.volume, -1) })
          flashVolume()
          break
        case 'm':
          setMedia(media, { muted: !media.muted })
          flashVolume()
          break
        case '+':
        case '=':
        case '-':
        case '_': {
          const now = subtitleStyle.get().size
          const size = stepSize(now, event.key === '+' || event.key === '=' ? 1 : -1)
          subtitleStyle.set({ size })
          flash(t('hudSubtitleSize', { size: t(SIZES.find((s) => s.value === size)!.label) }))
          break
        }
        case 'z':
        case 'x': {
          const value = setDelayRef.current(
            subtitleDelayRef.current + (event.key === 'x' ? DELAY_STEP : -DELAY_STEP),
          )
          flash(t('hudSubtitleTiming', { delay: delayLabel(value, t) }))
          break
        }
        case 's':
          // Past the intro, recap or credits the pill offers; nothing while there is none.
          if (!skipRef.current()) return
          break
        case 'f':
          toggleFullscreen()
          break
        case 'c':
          toggleSubtitles()
          break
        case 'i':
          if (support) void togglePip()
          break
        case 'p':
          if (support) void togglePip()
          break
        default:
          if (/^[0-9]$/.test(event.key) && Number.isFinite(media.duration)) {
            seek.seekTo((Number(event.key) / 10) * media.duration, true)
            break
          }
          return
      }
      event.preventDefault()
      poke()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    keyboard,
    media,
    togglePlay,
    seekBy,
    seek,
    flashVolume,
    flash,
    toggleFullscreen,
    toggleSubtitles,
    togglePip,
    onToggleMiniplayer,
    mini,
    support,
    poke,
    t,
  ])

  // The system's media controls (lock screen, headphones, keyboard media keys).
  useEffect(() => {
    if (!('mediaSession' in navigator) || !media) return
    const session = navigator.mediaSession
    session.metadata = new MediaMetadata({
      title,
      artwork: poster ? [{ src: poster }] : undefined,
    })
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void media.play()],
      ['pause', () => media.pause()],
      ['seekbackward', () => seekBy(-SEEK_STEP)],
      ['seekforward', () => seekBy(SEEK_STEP)],
      [
        'seekto',
        (d) => {
          if (d.seekTime != null) seek.seekTo(d.seekTime, true)
        },
      ],
    ]
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler)
      } catch {
        // Not every browser supports every action.
      }
    }
    return () => {
      session.metadata = null
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null)
        } catch {
          // As above.
        }
      }
    }
  }, [media, title, poster, seekBy, seek])

  // Notices fade on their own.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 7000)
    return () => clearTimeout(timer)
  }, [notice, setNotice])

  // A click toggles playback; a second click soon after toggles full screen instead.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSurfaceClick = () => {
    // In the corner, the picture is the way back to the full player.
    if (mini) {
      onToggleMiniplayer?.()
      return
    }
    poke()
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      toggleFullscreen()
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      togglePlay()
    }, 220)
  }

  useImperativeHandle(
    handleRef,
    () => ({
      media,
      engine,
      play: () => media?.play() ?? Promise.resolve(),
      pause: () => media?.pause(),
      seekTo: (time: number) => seek.seekTo(time, true),
      toggleFullscreen,
      diagnostics: () => diagnosticsReport({ title, decoder, key, status }),
    }),
    [media, engine, seek, toggleFullscreen, title, decoder, key, status],
  )

  const copyDetails = async () => {
    const text = diagnosticsReport({ title, decoder, key, status })
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      console.info(text)
    }
  }

  /** The video's own text tracks, then the files given to the player, then Off at the top. */
  const subtitleChoices = [
    ...subtitles.options.map((o) => ({
      value: o.id,
      label: o.label,
      detail: o.detail,
      disabled: !o.selectable,
    })),
    ...(subtitleFiles ?? []).map((file, i) => ({
      value: externalId(i),
      label: file.label,
      detail: t('subtitleFileDetail'),
    })),
  ]
  const fileSubtitleSections: MenuSection[] =
    subtitleChoices.length > 0
      ? [
          {
            options: [{ value: 'off', label: t('off') }, ...subtitleChoices],
            selected:
              external.selected !== null
                ? externalId(external.selected)
                : (subtitles.selected ?? 'off'),
            onSelect: (value: string) => chooseSubtitle(value === 'off' ? null : value),
          },
          ...(decoder === 'browser'
            ? [
                {
                  options: [
                    {
                      value: 'builtin',
                      label: t('useBuiltin'),
                      detail: t('subtitlesBuiltinDetail'),
                    },
                  ],
                  selected: null,
                  onSelect: () => switchDecoder('builtin'),
                },
              ]
            : []),
        ]
      : [
          {
            options: [],
            selected: null,
            onSelect: () => undefined,
            empty: decoder === 'browser' ? t('subtitlesBrowserCannot') : t('subtitlesNone'),
          },
          ...(decoder === 'browser'
            ? [
                {
                  options: [
                    {
                      value: 'builtin',
                      label: t('useBuiltin'),
                      detail: t('subtitlesBuiltinDetail'),
                    },
                  ],
                  selected: null,
                  onSelect: () => switchDecoder('builtin'),
                },
              ]
            : []),
        ]

  const subtitleSections: MenuSection[] = [
    // Any other choice in the menu puts the look panel away.
    ...fileSubtitleSections.map((section) => ({
      ...section,
      onSelect: (value: string) => {
        setStylePanelOpen(false)
        section.onSelect(value)
      },
    })),
    {
      options: [
        {
          value: 'look',
          label: t('look'),
          detail: subtitleDelay
            ? t('lookDetailDelay', { delay: delayLabel(subtitleDelay, t) })
            : t('lookDetail'),
        },
      ],
      selected: null,
      onSelect: () => setStylePanelOpen(true),
    },
  ]

  const ready = status.kind === 'ready'
  // The pre-roll covers the opening wait in the page layout, until playback starts (or the start
  // is refused and the play button takes over, or opening failed); then it fades off once.
  const opened =
    phase === 'started' || status.kind === 'failed' || (ready && !state.paused && !state.waiting)
  const preRoll = !mini && loader != null && !loaderGone
  const controlsVisible =
    !ready || active || state.paused || menuOpen || scrubbing || stylePanelOpen
  const selectableSubtitles = subtitles.options.filter((o) => o.selectable)
  const otherDecoder: EngineKind = decoder === 'builtin' ? 'browser' : 'builtin'
  const canSwitch = otherDecoder === 'builtin' || browserCanPlay
  const muted = state.muted || state.volume === 0
  const inWindow = pip?.kind === 'window'
  const playedShare = state.duration > 0 ? Math.min(1, shownTime / state.duration) : 0

  const accentStyle = accentColor
    ? ({
        '--mp-color-accent': accentColor,
        '--mp-color-accent-hover': `color-mix(in srgb, ${accentColor} 82%, white)`,
      } as CSSProperties)
    : undefined

  // One tree for both layouts: the surface the decoder draws into must never be unmounted
  // or moved (the built-in decoder tears itself down when its element leaves the document),
  // so changing layout only changes classes and which overlays are drawn.
  return (
    <>
      <div
        ref={rootRef}
        className={cx(
          // The player's chrome is dark whatever the page's theme: it sits on the picture.
          'mp-root mp:@container mp:relative mp:grid mp:w-full mp:bg-black mp:text-ink mp:font-body mp:outline-none mp:select-none',
          mini
            ? 'mp:group/mini mp:aspect-video mp:rounded-[inherit]'
            : windowFullscreen
              ? // Clear of the notch and the home bar; the shadow blacks out everything around.
                'mp:fixed! mp:inset-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)] mp:z-[90] mp:h-auto! mp:w-auto! mp:shadow-[0_0_0_100vmax_#000]'
              : fullscreen || fit === 'fill'
                ? 'mp:h-full'
                : // 16:9 by itself.
                  'mp:aspect-video',
          !mini && !controlsVisible && 'mp:cursor-none',
          className,
        )}
        style={accentStyle ? { ...style, ...accentStyle } : style}
        onPointerMove={mini ? undefined : poke}
        onPointerDown={mini ? undefined : poke}
        tabIndex={-1}
        aria-label={mini ? t('regionMini', { title }) : t('region', { title })}
        role="region"
        // The timeline and controls run left to right in every language, as video players do.
        dir="ltr"
        data-layout={layout}
        data-fullscreen={fullscreen ? (windowFullscreen ? 'window' : 'element') : undefined}
        // Resting with its controls away: a page can fade its own bars out with them.
        data-idle={!mini && !controlsVisible ? '' : undefined}
      >
        {/* The picture is clipped to the rounded corners; menus are not, so they can reach past them. */}
        <div
          ref={surfaceRef}
          className="mp:absolute mp:inset-0 mp:overflow-hidden mp:rounded-[inherit] mp:*:absolute mp:*:inset-0"
        />
        <div
          className={cx('mp:absolute mp:inset-0', mini && 'mp:cursor-pointer')}
          onClick={onSurfaceClick}
          aria-hidden="true"
        />

        {preRoll ? (
          <PlayerLoader
            info={loader}
            phase={phase}
            status={loaderStatus(startAt, formatDuration, t)}
            leaving={opened}
            onGone={() => setLoaderGone(true)}
          />
        ) : null}

        {poster && status.kind === 'loading' && !preRoll ? (
          <img
            src={poster}
            alt=""
            className="mp:pointer-events-none mp:absolute mp:inset-0 mp:size-full mp:rounded-[inherit] mp:object-contain mp:opacity-35"
          />
        ) : null}

        {shownCaption && !inWindow ? (
          <div
            className={cx(
              'mp:pointer-events-none mp:absolute mp:left-1/2 mp:w-max mp:max-w-[88%] mp:-translate-x-1/2 mp:text-center mp:leading-[1.38] mp:text-balance mp:whitespace-pre-line',
              'mp:transition-[bottom] mp:duration-200 mp:ease-soft mp:[--controls-h:96px] mp:@max-[520px]:[--controls-h:84px]',
            )}
            style={{
              // Over the controls while they show; otherwise where the viewer put it.
              bottom: mini
                ? '8%'
                : controlsVisible
                  ? `max(calc(var(--controls-h) + 2%), ${positionPercent(subStyle.position)}%)`
                  : `${positionPercent(subStyle.position)}%`,
            }}
            aria-live="polite"
            data-player-caption=""
          >
            <span
              style={captionCss(
                subStyle,
                mini ? 'clamp(11px, 4.2cqi, 16px)' : 'clamp(15px, 3.1cqi, 38px)',
              )}
            >
              {shownCaption}
            </span>
          </div>
        ) : null}

        <div className="mp:pointer-events-none mp:absolute mp:inset-0 mp:grid mp:place-items-center">
          {preRoll && !opened ? null : status.kind === 'loading' ||
            (ready && state.waiting && !state.paused) ? (
            <Spinner
              size={mini ? 28 : 40}
              label={status.kind === 'loading' ? t('opening') : t('loading')}
            />
          ) : ready && state.paused && !scrubbing && !inWindow && !mini ? (
            <button
              type="button"
              className="mp:pointer-events-auto mp:grid mp:size-18 mp:place-items-center mp:rounded-full mp:bg-bg/70 mp:text-ink mp:backdrop-blur-sm mp:transition-transform mp:duration-150 mp:ease-soft mp:hover:scale-106 mp:active:scale-[0.96]"
              onClick={togglePlay}
              aria-label={t('play')}
            >
              <Icon name="play" size={30} />
            </button>
          ) : null}
        </div>

        {inWindow ? (
          <div className="mp:absolute mp:inset-0 mp:z-1 mp:grid mp:place-items-center mp:rounded-[inherit] mp:bg-bg/92 mp:p-5 mp:@max-[420px]:p-2">
            <div className="mp:grid mp:justify-items-center mp:gap-3 mp:text-center mp:@max-[420px]:gap-1.5">
              <Icon name="popOut" size={30} className="mp:text-accent mp:@max-[420px]:hidden" />
              <p className="mp:text-muted mp:@max-[420px]:text-sm">{t('pipPlaying')}</p>
              <Button size="small" icon="popIn" onClick={closePip}>
                {t('backToTab')}
              </Button>
            </div>
          </div>
        ) : null}

        {fullscreen && !mini ? (
          <div
            className={cx(
              'mp:pointer-events-none mp:absolute mp:inset-x-0 mp:top-0 mp:truncate mp:bg-linear-to-b mp:from-black/70 mp:to-transparent mp:px-5 mp:pt-4 mp:pb-12',
              'mp:font-display mp:text-lg mp:font-[650] mp:transition-opacity mp:duration-200 mp:ease-soft',
              !controlsVisible && 'mp:opacity-0',
            )}
          >
            {title}
          </div>
        ) : null}

        {!mini && upNext && next.card && !inWindow ? (
          <UpNextCard
            next={upNext}
            seconds={next.card.seconds}
            share={next.card.share}
            lifted={controlsVisible}
            onHide={next.hide}
            onPlay={next.playNow}
          />
        ) : null}

        {!mini && upNext && next.phase.kind === 'countdown' ? (
          <NextCountdown
            next={upNext}
            seconds={next.phase.seconds}
            onPlay={next.playNow}
            onCancel={next.stop}
          />
        ) : null}

        {!mini && upNext && next.phase.kind === 'ask' ? (
          <StillWatching next={upNext} onPlay={next.playNow} onStop={next.stop} />
        ) : null}

        {!mini && skipKind ? (
          <SkipPill
            kind={skipKind}
            shown={ready && !inWindow && skipper.active !== null && !next.card}
            lifted={controlsVisible}
            onSkip={() => {
              skipper.skip()
              poke()
            }}
          />
        ) : null}

        {notice && !mini ? (
          <div
            className="mp:absolute mp:top-[calc(var(--mp-overlay-top,0px)+0.75rem)] mp:left-1/2 mp:z-3 mp:max-w-[90%] mp:-translate-x-1/2 mp:rounded-control mp:border mp:border-line-strong mp:bg-surface/94 mp:px-4 mp:py-2 mp:text-sm"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        {!mini ? (
          <div
            role="status"
            className={cx(
              'mp:pointer-events-none mp:absolute mp:top-[calc(var(--mp-overlay-top,0px)+1rem)] mp:left-1/2 mp:z-3 mp:flex mp:-translate-x-1/2 mp:items-center mp:gap-2 mp:rounded-full mp:bg-black/72 mp:py-2 mp:pr-4 mp:pl-3 mp:text-sm mp:font-semibold mp:text-ink mp:tabular-nums mp:backdrop-blur-sm',
              'mp:transition-[opacity,transform] mp:duration-200 mp:ease-standard',
              hud ? 'mp:translate-y-0 mp:opacity-100' : 'mp:-translate-y-1 mp:opacity-0',
            )}
          >
            {hud === 'volume' ? (
              <>
                <VolumeIcon volume={state.volume} muted={state.muted} size={20} />
                <span className="mp:min-w-[3.5ch]">
                  {muted
                    ? t('muted')
                    : t('volumePercent', { percent: Math.round(state.volume * 100) })}
                </span>
              </>
            ) : hud ? (
              <>
                <Icon name={hudIcon} size={20} />
                <span>{hud}</span>
              </>
            ) : null}
          </div>
        ) : null}

        {soundBlocked && ready ? (
          <button
            type="button"
            onClick={unmute}
            className={cx(
              'mp:absolute mp:z-3 mp:flex mp:items-center mp:gap-2 mp:rounded-full mp:bg-accent mp:font-semibold mp:text-accent-ink',
              mini
                ? 'mp:bottom-2 mp:left-2 mp:py-1.5 mp:pr-3 mp:pl-2 mp:text-xs'
                : 'mp:top-[calc(var(--mp-overlay-top,0px)+0.75rem)] mp:left-3 mp:py-2 mp:pr-4 mp:pl-3 mp:text-sm',
              'mp:shadow-[0_6px_20px_rgb(10_8_12/45%)] mp:transition-[background-color,transform] mp:duration-150 mp:ease-soft mp:hover:bg-accent-hover mp:active:scale-[0.97]',
            )}
          >
            <Icon name="volumeOff" size={18} />
            {t('turnOnSound')}
          </button>
        ) : null}

        {mini ? (
          <MiniOverlay
            ready={ready}
            paused={state.paused}
            share={playedShare}
            inWindow={inWindow}
            togglePlay={togglePlay}
            seekBy={seekBy}
            onExpand={onToggleMiniplayer}
            onClose={onClose}
          />
        ) : (
          <div
            className={cx(
              'mp:absolute mp:inset-x-0 mp:bottom-0 mp:z-2 mp:bg-linear-to-t mp:from-black/78 mp:to-transparent mp:px-4 mp:pt-12 mp:pb-3 mp:@max-[520px]:px-2',
              'mp:transition-opacity mp:duration-200 mp:ease-soft',
              !controlsVisible && 'mp:pointer-events-none mp:opacity-0',
            )}
          >
            <SeekBar
              position={shownTime}
              duration={state.duration}
              bufferedEnd={state.bufferedEnd}
              onScrubbing={setScrubbing}
              onSeek={(time) => {
                seek.seekTo(time, true)
                poke()
              }}
              onStep={seekBy}
              preview={preview}
              chapters={chapters}
            />
            <div className="mp:mt-1 mp:flex mp:items-center mp:gap-1">
              <ControlButton
                onClick={togglePlay}
                disabled={!ready}
                aria-label={state.paused ? t('play') : t('pause')}
                title={state.paused ? t('playKey') : t('pauseKey')}
              >
                <SwapIcon
                  showOn={state.paused}
                  on={<Icon name="play" size={22} />}
                  off={<Icon name="pause" size={22} />}
                />
              </ControlButton>
              <ControlButton
                wide
                onClick={() => seekBy(-SEEK_STEP)}
                disabled={!ready}
                aria-label={t('back10')}
                title={t('back10Key')}
              >
                <Icon name="back10" size={20} />
              </ControlButton>
              <ControlButton
                wide
                onClick={() => seekBy(SEEK_STEP)}
                disabled={!ready}
                aria-label={t('forward10')}
                title={t('forward10Key')}
              >
                <Icon name="forward10" size={20} />
              </ControlButton>
              <div className="mp:group/volume mp:flex mp:items-center">
                <ControlButton
                  onClick={() => {
                    if (!media) return
                    if (muted) unmute()
                    else setMedia(media, { muted: true })
                  }}
                  disabled={!ready}
                  aria-label={muted ? t('unmute') : t('mute')}
                  title={t('muteKey')}
                >
                  <VolumeIcon volume={state.volume} muted={state.muted} size={20} />
                </ControlButton>
                <input
                  className={cx(
                    'mp:w-0 mp:accent-accent mp:opacity-0 mp:transition-[width,opacity,margin] mp:duration-200 mp:ease-soft',
                    // No slider on a phone: its buttons set the volume, and a slider opened by a
                    // tap on mute stayed open and pushed full screen off a portrait bar.
                    'mp:@max-[520px]:hidden mp:pointer-coarse:hidden',
                    'mp:group-focus-within/volume:mr-2 mp:group-focus-within/volume:w-21 mp:group-focus-within/volume:opacity-100',
                    'mp:group-hover/volume:mr-2 mp:group-hover/volume:w-21 mp:group-hover/volume:opacity-100',
                  )}
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={state.muted ? 0 : state.volume}
                  aria-label={t('volume')}
                  aria-valuetext={
                    muted
                      ? t('muted')
                      : t('volumePercent', { percent: Math.round(state.volume * 100) })
                  }
                  onChange={(event) => {
                    if (!media) return
                    const volume = Number(event.target.value)
                    setMedia(media, { volume, muted: volume === 0 })
                  }}
                />
              </div>
              {/* The one thing on the bar that gives way: it cuts off (and, on the narrowest
                  phones, drops the length) before a button is pushed out of reach. */}
              <span className="mp:ml-2 mp:min-w-0 mp:truncate mp:text-sm mp:whitespace-nowrap mp:tabular-nums mp:@max-[520px]:ml-1 mp:@max-[520px]:text-xs">
                {formatDuration(shownTime)}
                <span className="mp:text-muted mp:@max-[380px]:hidden">
                  {' '}
                  / {formatDuration(state.duration)}
                </span>
              </span>

              {currentChapter ? (
                // The part playing, beside the time as on video sites; it opens the list of
                // parts to jump to. Phones leave it to the timeline, which names the parts.
                <MenuButton
                  label={t('chapters')}
                  align="start"
                  className="mp:min-w-0 mp:@max-[520px]:hidden"
                  onOpenChange={setMenuOpen}
                  sections={[
                    {
                      heading: t('chapters'),
                      options: chapters.map((chapter, i) => ({
                        value: String(i),
                        label: chapter.title,
                        detail: formatDuration(chapter.start),
                      })),
                      selected: String(chapterIndex),
                      onSelect: (value) => {
                        const chapter = chapters[Number(value)]
                        if (chapter) seekTo(chapter.start, true)
                      },
                    },
                  ]}
                  trigger={({ toggle, ariaProps }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      disabled={!ready}
                      aria-label={t('chapterButton', { title: currentChapter.title })}
                      title={t('chapters')}
                      className="mp:group/chapter mp:ml-1 mp:flex mp:h-9 mp:max-w-full mp:min-w-0 mp:items-center mp:gap-1.5 mp:rounded-control mp:pr-1.5 mp:pl-2 mp:text-sm mp:text-ink/88 mp:transition-colors mp:duration-150 mp:hover:bg-ink/12 mp:hover:text-ink"
                      data-current-chapter=""
                      {...ariaProps}
                    >
                      <span aria-hidden="true" className="mp:text-faint">
                        •
                      </span>
                      <span className="mp:min-w-0 mp:truncate mp:font-medium" key={chapterIndex}>
                        {currentChapter.title}
                      </span>
                      <Icon
                        name="chevron"
                        size={14}
                        className="mp:shrink-0 mp:text-muted mp:transition-transform mp:duration-150 mp:ease-soft mp:group-hover/chapter:translate-x-0.5"
                      />
                    </button>
                  )}
                />
              ) : null}

              <span className="mp:min-w-1 mp:flex-1" />

              <MenuButton
                label={t('subtitles')}
                onOpenChange={setMenuOpen}
                sections={subtitleSections}
                trigger={({ toggle, ariaProps }) => (
                  <ControlButton
                    on={subtitles.selected !== null || external.selected !== null}
                    onClick={toggle}
                    disabled={!ready}
                    aria-label={
                      selectableSubtitles.length > 0 ? t('subtitles') : t('subtitlesNoneInVideo')
                    }
                    title={t('subtitlesKey')}
                    {...ariaProps}
                  >
                    <Icon name="subtitles" size={20} />
                  </ControlButton>
                )}
              />

              {audio.options.length > 1 ? (
                <MenuButton
                  label={t('audioTrack')}
                  onOpenChange={setMenuOpen}
                  sections={[
                    {
                      options: audio.options.map((o) => ({
                        value: o.id,
                        label: o.label,
                        detail: o.detail,
                      })),
                      selected: audio.selected,
                      onSelect: selectAudio,
                    },
                  ]}
                  trigger={({ toggle, ariaProps }) => (
                    <ControlButton
                      onClick={toggle}
                      disabled={!ready}
                      aria-label={t('audioTrack')}
                      title={t('audioTrack')}
                      {...ariaProps}
                    >
                      <Icon name="audio" size={20} />
                    </ControlButton>
                  )}
                />
              ) : null}

              <MenuButton
                label={t('playbackSettings')}
                onOpenChange={setMenuOpen}
                sections={[
                  {
                    heading: t('speed'),
                    layout: 'row',
                    options: SPEEDS.map((s) => ({
                      value: String(s),
                      label: t('speedValue', { speed: s }),
                      detail: s === 1 ? t('speedNormal') : t('speedTimes', { speed: s }),
                    })),
                    selected: String(state.playbackRate),
                    onSelect: (value) => {
                      if (media) setMedia(media, { playbackRate: Number(value) })
                    },
                  },
                  {
                    heading: t('decoder'),
                    options: [
                      {
                        value: 'builtin',
                        label: t('decoderBuiltin'),
                        detail: t('decoderBuiltinDetail'),
                      },
                      {
                        value: 'browser',
                        label: t('decoderBrowser'),
                        detail: browserCanPlay
                          ? t('decoderBrowserDetail')
                          : t('decoderBrowserCannot'),
                        disabled: !browserCanPlay,
                      },
                    ],
                    selected: decoder,
                    onSelect: (value) => switchDecoder(value as EngineKind),
                  },
                ]}
                trigger={({ toggle, ariaProps }) => (
                  <ControlButton
                    className="mp:px-3 mp:text-sm mp:font-semibold mp:tabular-nums"
                    onClick={toggle}
                    aria-label={t('playbackSettings')}
                    title={t('speedAndDecoder')}
                    {...ariaProps}
                  >
                    {state.playbackRate === 1 ? (
                      <Icon name="settings" size={20} />
                    ) : (
                      t('speedValue', { speed: state.playbackRate })
                    )}
                  </ControlButton>
                )}
              />

              {onToggleMiniplayer ? (
                <ControlButton
                  wide
                  onClick={onToggleMiniplayer}
                  aria-label={t('miniplayer')}
                  title={t('miniplayerKey')}
                >
                  <Icon name="miniplayer" size={20} />
                </ControlButton>
              ) : null}
              {support ? (
                <ControlButton
                  wide
                  on={pip !== null}
                  onClick={() => void togglePip()}
                  disabled={!ready}
                  aria-label={pip ? t('pipClose') : t('pip')}
                  aria-pressed={pip !== null}
                  title={onToggleMiniplayer ? t('pipKeyP') : t('pipKeyI')}
                >
                  <Icon name="popOut" size={20} />
                </ControlButton>
              ) : null}
              <ControlButton
                onClick={toggleFullscreen}
                aria-label={fullscreen ? t('fullscreenExit') : t('fullscreen')}
                title={t('fullscreenKey')}
              >
                <SwapIcon
                  showOn={fullscreen}
                  on={<Icon name="fullscreenExit" size={20} />}
                  off={<Icon name="fullscreen" size={20} />}
                />
              </ControlButton>
            </div>
          </div>
        )}

        {stylePanelOpen && !mini ? (
          <SubtitleStylePanel
            delay={subtitleDelay}
            onDelay={setSubtitleDelay}
            onClose={() => setStylePanelOpen(false)}
          />
        ) : null}

        {status.kind === 'failed' && mini ? (
          <div
            className="mp:absolute mp:inset-0 mp:z-4 mp:grid mp:place-items-center mp:rounded-[inherit] mp:bg-bg/90 mp:p-3 mp:text-center"
            role="alert"
          >
            <div className="mp:grid mp:justify-items-center mp:gap-2">
              <p className="mp:text-sm mp:font-medium">{status.failure.title}</p>
              <Button variant="primary" size="small" icon="refresh" onClick={retry}>
                {t('tryAgain')}
              </Button>
            </div>
            {onClose ? (
              <button
                type="button"
                className={cx(miniButton, 'mp:absolute mp:top-1.5 mp:right-1.5 mp:text-ink')}
                onClick={onClose}
                aria-label={t('closeMiniplayer')}
              >
                <Icon name="close" size={18} />
              </button>
            ) : null}
          </div>
        ) : status.kind === 'failed' ? (
          <div
            // In the flow, so on a small screen the player grows to fit the message.
            className="mp:relative mp:z-4 mp:grid mp:place-items-center mp:rounded-[inherit] mp:bg-bg/88 mp:p-5 mp:@max-[520px]:p-4"
            role="alert"
          >
            <div className="mp:grid mp:max-w-[46ch] mp:justify-items-center mp:gap-3 mp:text-center mp:@max-[520px]:gap-2">
              <Icon name="alert" size={28} className="mp:text-danger" />
              <h2 className="mp:text-xl mp:@max-[520px]:text-lg">{status.failure.title}</h2>
              <p className="mp:text-muted mp:@max-[520px]:text-sm">{status.failure.message}</p>
              <div className="mp:mt-2 mp:flex mp:flex-wrap mp:justify-center mp:gap-2">
                <Button variant="primary" size="small" icon="refresh" onClick={retry}>
                  {t('tryAgain')}
                </Button>
                {canSwitch ? (
                  <Button size="small" onClick={() => switchDecoder(otherDecoder)}>
                    {otherDecoder === 'builtin' ? t('useBuiltin') : t('useBrowser')}
                  </Button>
                ) : null}
                <Button variant="ghost" size="small" icon="copy" onClick={() => void copyDetails()}>
                  {copied ? t('copied') : t('copyDetails')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {pip?.kind === 'window' && engine ? (
          <PipWindow
            pipWindow={pip.window}
            engine={engine}
            title={title}
            caption={shownCaption}
            seekTarget={seek.target}
            onSeek={seek.seekTo}
            onSeekBy={seek.seekBy}
            style={accentStyle}
          />
        ) : null}
      </div>
      {mini ? renderMiniBar?.({ paused: state.paused, ready, togglePlay }) : null}
    </>
  )
}

const miniButton = cx(
  'mp:grid mp:size-9 mp:place-items-center mp:rounded-full mp:text-white mp:transition-[background-color,transform] mp:duration-150 mp:ease-soft mp:hover:bg-white/16 mp:active:scale-[0.94] mp:disabled:opacity-50',
)

/**
 * The miniplayer's controls over the picture, the way video sites lay them out: expand and
 * close in the top corners, play and skips in the middle, and how far along
 * the video is as a thin line at the bottom. They show on hover or keyboard focus, and stay
 * while paused; phones and touch screens use the bar `renderMiniBar` draws instead.
 */
function MiniOverlay({
  ready,
  paused,
  share,
  inWindow,
  togglePlay,
  seekBy,
  onExpand,
  onClose,
}: {
  ready: boolean
  paused: boolean
  share: number
  inWindow: boolean
  togglePlay: () => void
  seekBy: (delta: number) => void
  onExpand?: () => void
  onClose?: () => void
}) {
  const t = useT()
  const shown = paused && ready && !inWindow
  return (
    <>
      <div
        className={cx(
          'mp:pointer-events-none mp:absolute mp:inset-0 mp:z-2 mp:rounded-[inherit] mp:bg-black/45 mp:opacity-0 mp:transition-opacity mp:duration-200 mp:ease-soft',
          'mp:group-focus-within/mini:opacity-100 mp:group-hover/mini:opacity-100',
          // Only where it can be hovered and has room; otherwise the bar beside it has the
          // buttons (see renderMiniBar), so there is always exactly one set.
          'mp:hidden mp:[@media(hover:hover)_and_(min-width:40rem)]:block',
          shown && 'mp:opacity-100',
        )}
      >
        <div className="mp:pointer-events-auto mp:absolute mp:inset-x-1.5 mp:top-1.5 mp:flex mp:justify-between">
          {onExpand ? (
            <button
              type="button"
              className={miniButton}
              onClick={onExpand}
              aria-label={t('expand')}
              title={t('expandKey')}
            >
              <Icon name="expand" size={18} />
            </button>
          ) : (
            <span />
          )}
          {onClose ? (
            <button
              type="button"
              className={miniButton}
              onClick={onClose}
              aria-label={t('closeMiniplayer')}
              title={t('close')}
            >
              <Icon name="close" size={18} />
            </button>
          ) : null}
        </div>
        {!inWindow ? (
          <div className="mp:pointer-events-auto mp:absolute mp:top-1/2 mp:left-1/2 mp:flex mp:-translate-1/2 mp:items-center mp:gap-3">
            <button
              type="button"
              className={miniButton}
              onClick={() => seekBy(-SEEK_STEP)}
              disabled={!ready}
              aria-label={t('back10')}
            >
              <Icon name="back10" size={18} />
            </button>
            <button
              type="button"
              className={cx(miniButton, 'mp:size-12')}
              onClick={togglePlay}
              disabled={!ready}
              aria-label={paused ? t('play') : t('pause')}
              title={paused ? t('playKey') : t('pauseKey')}
            >
              <SwapIcon
                showOn={paused}
                on={<Icon name="play" size={26} />}
                off={<Icon name="pause" size={26} />}
              />
            </button>
            <button
              type="button"
              className={miniButton}
              onClick={() => seekBy(SEEK_STEP)}
              disabled={!ready}
              aria-label={t('forward10')}
            >
              <Icon name="forward10" size={18} />
            </button>
          </div>
        ) : null}
      </div>
      <div
        className="mp:pointer-events-none mp:absolute mp:inset-x-0 mp:bottom-0 mp:z-2 mp:h-[3px] mp:bg-white/20"
        aria-hidden="true"
      >
        <div className="mp:h-full mp:bg-accent" style={{ width: `${share * 100}%` }} />
      </div>
    </>
  )
}

/**
 * "Skip intro" (or recap, opening, credits, ending, preview): bottom right, while the playhead is
 * inside a timed stretch, as on streaming apps. It stays when the controls fade,
 * rises above the bar while they show, slides in from the edge and out again once the stretch
 * has passed. S does the same; the tooltip says so.
 */
function SkipPill({
  kind,
  shown,
  lifted,
  onSkip,
}: {
  kind: SkipKind
  shown: boolean
  lifted: boolean
  onSkip: () => void
}) {
  const t = useT()
  const label = skipLabel(kind, t)
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-hidden={shown ? undefined : true}
      tabIndex={shown ? undefined : -1}
      title={t('skipKey', { label })}
      data-skip={kind}
      className={cx(
        'mp:absolute mp:right-5 mp:bottom-5 mp:z-3 mp:flex mp:h-11 mp:items-center mp:gap-2 mp:rounded-full mp:border mp:border-ink/35 mp:bg-black/62 mp:pr-4 mp:pl-5 mp:text-[0.9375rem] mp:font-semibold mp:text-ink mp:backdrop-blur-md mp:@max-[520px]:right-3 mp:@max-[520px]:h-10 mp:@max-[520px]:text-sm',
        'mp:shadow-[0_10px_30px_color-mix(in_srgb,var(--color-shadow)_45%,transparent)] mp:transition-[opacity,translate,visibility,background-color,border-color,scale] mp:duration-250 mp:ease-standard',
        'mp:hover:border-ink/70 mp:hover:bg-ink/18 mp:focus-visible:outline-2 mp:focus-visible:outline-offset-2 mp:focus-visible:outline-accent mp:active:scale-[0.96]',
        lifted
          ? 'mp:-translate-y-[5.25rem] mp:@max-[520px]:-translate-y-[4.5rem]'
          : 'mp:translate-y-0',
        shown
          ? 'mp:visible mp:translate-x-0 mp:opacity-100'
          : 'mp:pointer-events-none mp:invisible mp:translate-x-6 mp:opacity-0',
      )}
    >
      {label}
      <Icon name="skip" size={20} weight="fill" />
    </button>
  )
}

/**
 * Whether [element] can go full screen itself. Not on an iPhone: its browsers keep full screen
 * for a bare <video>, so there the player fills the window instead.
 */
function canElementFullscreen(element: HTMLElement): boolean {
  return typeof element.requestFullscreen === 'function' && document.fullscreenEnabled === true
}
