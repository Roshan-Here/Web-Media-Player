// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { useSyncExternalStore } from 'react'
import { subtitleStyle, type SubtitleStyle } from '../lib/subtitle-style.js'

/** The subtitle look, redrawn wherever it shows when it is changed anywhere. */
export function useSubtitleStyle(): SubtitleStyle {
  return useSyncExternalStore(subtitleStyle.subscribe, subtitleStyle.get, subtitleStyle.get)
}
