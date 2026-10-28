// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { readJson, writeJson } from '../lib/storage.js'
import { parseMediaName, seriesKeyOf } from './media-name.js'
import { iso1 } from './languages.js'

/*
 * The subtitle language chosen online for each show, so the next episode's search puts it
 * first. Per show rather than app-wide, because the answer differs between shows; a film is
 * keyed by its own title, which makes this a no-op for it. Kept in the player's storage (see
 * configureStorage), newest last, and trimmed so it never grows without end.
 */

const STORAGE_KEY = 'online-subtitle-languages'
const LIMIT = 300

/** What a video's language choice is filed under: its show (or film) title, as the shelf keys it. */
export function seriesKeyForName(name: string, caption?: string | null): string {
  const parsed = parseMediaName(name, caption ?? null)
  return seriesKeyOf(parsed.title || name)
}

function load(): Record<string, string> {
  const value = readJson(STORAGE_KEY)
  return value && typeof value === 'object' ? (value as Record<string, string>) : {}
}

export function rememberedLanguage(seriesKey: string): string | null {
  if (!seriesKey) return null
  const code = load()[seriesKey]
  return typeof code === 'string' ? iso1(code) : null
}

export function rememberLanguage(seriesKey: string, language: string): void {
  const code = iso1(language)
  if (!seriesKey || !code) return
  const all = load()
  delete all[seriesKey]
  all[seriesKey] = code
  const keys = Object.keys(all)
  for (const key of keys.slice(0, Math.max(0, keys.length - LIMIT))) delete all[key]
  writeJson(STORAGE_KEY, all)
}
