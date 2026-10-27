// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import type { EngineKind } from './engine.js'
import { onStorageReset, readJson, writeJson } from './storage.js'

/** Player settings remembered on this device (see configureStorage). */
export interface PlayerPrefs {
  volume: number
  muted: boolean
  /** Language of the last subtitle track chosen, or null when subtitles were turned off. */
  subtitleLanguage: string | null
  /** Language of the last audio track chosen. */
  audioLanguage: string | null
  decoder: EngineKind
}

const KEY = 'prefs-v1'
const defaults: PlayerPrefs = {
  volume: 1,
  muted: false,
  subtitleLanguage: null,
  audioLanguage: null,
  decoder: 'builtin',
}

let memory: PlayerPrefs | null = null
onStorageReset(() => {
  memory = null
})

export function readPrefs(): PlayerPrefs {
  if (memory) return memory
  const stored = readJson(KEY)
  memory = { ...defaults, ...(stored && typeof stored === 'object' ? stored : {}) }
  if (memory.decoder !== 'builtin' && memory.decoder !== 'browser') memory.decoder = 'builtin'
  if (typeof memory.volume !== 'number' || !(memory.volume >= 0 && memory.volume <= 1))
    memory.volume = 1
  return memory
}

export function writePrefs(change: Partial<PlayerPrefs>): PlayerPrefs {
  memory = { ...readPrefs(), ...change }
  writeJson(KEY, memory)
  return memory
}
