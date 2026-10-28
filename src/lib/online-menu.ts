// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { MenuSection } from '../components/Menu.js'
import type { OnlineSubtitleControls } from '../hooks/useOnlineSubtitle.js'
import type { Translate } from './labels.js'

const ATTACHED = 'online:attached'
const SEARCH = 'online:search'

/**
 * The Subtitles menu with online subtitles in it: the attached one as a checked entry among the
 * file's tracks (choosing a track or Off puts it away, since one subtitle shows at a time), and
 * "Search online" at the end. Unchanged when the player was given no subtitle service.
 */
export function withOnlineSubtitles(
  base: MenuSection[],
  online: Pick<OnlineSubtitleControls, 'available' | 'attached' | 'clear' | 'openPanel'>,
  t: Translate,
): MenuSection[] {
  if (!online.available) return base
  const attached = online.attached
  const entry = attached
    ? { value: ATTACHED, label: attached.label, detail: t('onlineFound') }
    : null
  let placed = false
  const sections = base.map((section): MenuSection => {
    if (!section.options.some((o) => o.value === 'off')) return section
    placed = true
    return {
      ...section,
      options: entry ? [...section.options, entry] : section.options,
      selected: entry ? ATTACHED : section.selected,
      onSelect: (value) => {
        if (value === ATTACHED) return
        online.clear()
        section.onSelect(value)
      },
    }
  })
  // A video with no tracks of its own has no Off to choose: the online one brings its own, in
  // place of the "no subtitles" line.
  const out = entry && !placed ? sections.filter((s) => s.options.length > 0) : sections
  if (entry && !placed)
    out.unshift({
      options: [{ value: 'off', label: t('off') }, entry],
      selected: ATTACHED,
      onSelect: (value) => {
        if (value === 'off') online.clear()
      },
    })
  out.push({
    options: [{ value: SEARCH, label: t('onlineSearch'), detail: t('onlineSearchDetail') }],
    selected: null,
    onSelect: () => online.openPanel(),
  })
  return out
}
