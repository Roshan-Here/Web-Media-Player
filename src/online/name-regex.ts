// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/**
 * Small helpers that give JavaScript regexes the Kotlin `Regex` calls TMPlayer's parser is written
 * with: `find` (first match), `findAll`, `matches` (the whole string) and `replace` (every match).
 *
 * The patterns themselves are declared without the `g` flag, because a global regex carries
 * `lastIndex` between calls and a shared one would give different answers on alternate calls.
 * The global and anchored copies are made once and kept.
 */

const globals = new WeakMap<RegExp, RegExp>()
const anchored = new WeakMap<RegExp, RegExp>()

function globalOf(re: RegExp): RegExp {
  let g = globals.get(re)
  if (!g) {
    g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    globals.set(re, g)
  }
  g.lastIndex = 0
  return g
}

/** The first match, or null. */
export function find(re: RegExp, text: string): RegExpExecArray | null {
  const g = globalOf(re)
  return g.exec(text)
}

/** Every non-overlapping match, in order. */
export function findAll(re: RegExp, text: string): RegExpExecArray[] {
  return [...text.matchAll(globalOf(re))]
}

/** Whether [re] matches anywhere in [text]. */
export function contains(re: RegExp, text: string): boolean {
  return find(re, text) !== null
}

/** Whether [re] matches the whole of [text], as Kotlin's `matches`. */
export function matchesWhole(re: RegExp, text: string): boolean {
  let a = anchored.get(re)
  if (!a) {
    a = new RegExp(`^(?:${re.source})$`, re.flags.replace('g', ''))
    anchored.set(re, a)
  }
  return a.test(text)
}

/** Every match replaced, as Kotlin's `replace`. */
export function replaceAll(
  text: string,
  re: RegExp,
  by: string | ((match: string) => string),
): string {
  const g = globalOf(re)
  return typeof by === 'string' ? text.replace(g, () => by) : text.replace(g, (m) => by(m))
}

/** Where a match ends: Kotlin's `range.last + 1`. */
export function endOf(m: RegExpExecArray): number {
  return m.index + m[0].length
}

/** The smallest of the numbers given, ignoring nulls; null when there are none. */
export function minOf(values: readonly (number | null | undefined)[]): number | null {
  let best: number | null = null
  for (const v of values) if (v != null && (best == null || v < best)) best = v
  return best
}
