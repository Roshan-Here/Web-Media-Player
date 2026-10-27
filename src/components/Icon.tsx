// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowSquareIn,
  ArrowSquareOut,
  ArrowsOutSimple,
  CaretRight,
  Check,
  Copy,
  CornersIn,
  CornersOut,
  GearSix,
  ListBullets,
  MusicNotes,
  Pause,
  PictureInPicture,
  Play,
  SkipForward,
  SpeakerSlash,
  Subtitles,
  Television,
  WarningCircle,
  X,
  type Icon as PhosphorIcon,
  type IconWeight,
} from '@phosphor-icons/react'

/** Every glyph the player uses, from one family (Phosphor), named by what it means here. */
const icons = {
  play: Play,
  pause: Pause,
  settings: GearSix,
  close: X,
  check: Check,
  refresh: ArrowClockwise,
  alert: WarningCircle,
  chevron: CaretRight,
  volumeOff: SpeakerSlash,
  fullscreen: CornersOut,
  fullscreenExit: CornersIn,
  /** The miniplayer docked in a corner of the page. */
  miniplayer: PictureInPicture,
  /** Back from the miniplayer to the full player. */
  expand: ArrowsOutSimple,
  subtitles: Subtitles,
  audio: MusicNotes,
  back10: ArrowCounterClockwise,
  forward10: ArrowClockwise,
  copy: Copy,
  /** The floating picture-in-picture window, out of the tab. */
  popOut: ArrowSquareOut,
  popIn: ArrowSquareIn,
  series: Television,
  /** Past the intro, recap or credits. */
  skip: SkipForward,
  /** A video's chapters. */
  chapters: ListBullets,
} satisfies Record<string, PhosphorIcon>

export type IconName = keyof typeof icons

/** Glyphs that read better solid. */
const filled = new Set<IconName>(['play', 'pause'])

export interface IconProps {
  name: IconName
  size?: number
  /** Gives the icon an accessible name; without it the icon is decorative. */
  label?: string
  weight?: IconWeight
  className?: string
}

export function Icon({ name, size = 20, label, weight, className }: IconProps) {
  const Glyph = icons[name]
  return (
    <Glyph
      size={size}
      weight={weight ?? (filled.has(name) ? 'fill' : 'regular')}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    />
  )
}
