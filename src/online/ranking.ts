// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { parseMediaName, type ParsedName } from './media-name.js'
import { iso1 } from './languages.js'
import { PROVIDER_ORDER, type SubtitleHit } from './models.js'

/*
 * Which results are for this video and in what order (TMPlayer's OnlineSubtitles.relevant and
 * relevance). A name search brings back other people's films as well as this one: every release
 * of the year in the name, or a show whose release group happens to share the title's word.
 */

const NOT_WORD = /[^\p{L}\p{N}]+/u
/** A release group: the word after the last dash, at the end or before a closing bracket. */
const RELEASE_GROUP = /-[A-Za-z0-9]+(?=\s*(?:$|[)\]]))/g
/** A subtitle file's own extension, off before the release group is looked for. */
const SUBTITLE_EXTENSION = /\.(srt|ass|ssa|vtt|sub|txt)$/i
/** Words too common in release names to say that a release is this video. */
const FILLER = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'with'])
/** Release names carry years well past now ("2099" would still be a year). */
const RELEASE_MAX_YEAR = 2099

function wordsOf(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(NOT_WORD)
      .filter((w) => w.length > 0),
  )
}

/** The title's words that say something: "the" and "of" are in every other release name. */
export function titleWords(title: string): Set<string> {
  const all = wordsOf(title)
  const meaningful = new Set([...all].filter((w) => !FILLER.has(w)))
  return meaningful.size > 0 ? meaningful : all
}

const parseRelease = (name: string) => parseMediaName(name, null, RELEASE_MAX_YEAR)

/**
 * The words of the title a hit is for: OpenSubtitles' own filing when it gave one; otherwise the
 * release name read the way a file name is, what comes before its episode code or year, without
 * a release group. "Entourage.S1E04.DVDRip-LOKi" is Entourage, and
 * "Season 1 whole (AC3.DVDRip.XviD-LOKi)" names no show at all.
 */
function releaseTitle(hit: SubtitleHit): Set<string> {
  if (hit.featureTitle.trim()) return titleWords(hit.featureTitle)
  const out = new Set<string>()
  for (const name of [hit.release, hit.fileName]) {
    if (!name.trim()) continue
    const bare = name.replace(SUBTITLE_EXTENSION, '').replace(RELEASE_GROUP, '')
    for (const w of titleWords(parseRelease(bare).title)) out.add(w)
  }
  return out
}

const containsAll = (a: Set<string>, b: Set<string>) => [...b].every((w) => a.has(w))

/**
 * `hits` without the ones that are plainly another video: an OpenSubtitles release that shares
 * not one word with the title. A hash match always stays, whatever it is called, and so does
 * SubDL, which is asked for a film by name and answers with releases of that film. A title with
 * no Latin letters ("ഹാർബർ നോട്ട്സ്") cannot be compared with release names, which are written in
 * Latin letters, so nothing is dropped for one of those.
 */
export function relevant(hits: SubtitleHit[], parsed: ParsedName): SubtitleHit[] {
  const title = titleWords(parsed.title)
  if (![...title].some((w) => /[a-z]/.test(w))) return hits
  return hits.filter((hit) => {
    if (hit.hashMatch || hit.provider !== 'OpenSubtitles') return true
    const theirs = releaseTitle(hit)
    const shares = [...title].some((w) => theirs.has(w))
    if (!hit.featureTitle.trim()) return shares
    // OpenSubtitles' own filing: the show or film has to be this one, word for word, or one
    // name has to hold the other whole ("Thor & Loki Blood Brothers" stays, ranked under
    // "Loki"; "Entourage" goes, whatever its release group is called).
    return shares && (containsAll(theirs, title) || containsAll(title, theirs))
  })
}

/**
 * How well a hit fits the video, for the order after hash matches. First the release's own
 * title against the video's: the share of the video's title words it carries, then how little
 * else it carries, and a bonus for exactly the video's title. Then the right episode and the
 * right year; a wrong one counts against it. The exact title with the right episode outranks
 * everything but a hash match.
 */
export function relevance(hit: SubtitleHit, parsed: ParsedName): number {
  const title = titleWords(parsed.title)
  const release = hit.release.trim() ? hit.release : hit.fileName
  const words = releaseTitle(hit)
  let score = 0
  if (title.size > 0) {
    const shared = [...title].filter((w) => words.has(w)).length
    const union = new Set([...title, ...words]).size
    score += Math.trunc((100 * shared) / title.size)
    score += Math.trunc((50 * shared) / union)
    if (words.size === title.size && containsAll(words, title)) score += 40
  }
  const read = parseRelease(release)
  // OpenSubtitles' own season, episode and year first, the release name's where it gave none.
  const season = hit.featureSeason ?? read.season
  const episode = hit.featureEpisode ?? read.episode
  const year = hit.featureYear ?? read.year
  if (parsed.episode !== null && episode !== null) {
    const sameSeason = parsed.season === null || season === null || parsed.season === season
    // A wrong episode weighs more than the exact title, so it sits under a release that names no episode.
    score += sameSeason && parsed.episode === episode ? 50 : -100
  }
  if (parsed.year !== null && year !== null) score += parsed.year === year ? 20 : -20
  return score
}

/**
 * The hits for this video, best first: hash matches, then relevance, then the wanted languages
 * in order, then OpenSubtitles before SubDL, then the most downloaded.
 */
export function rank(hits: SubtitleHit[], parsed: ParsedName, languages: string[]): SubtitleHit[] {
  const order = new Map(languages.map((code, i) => [code, i]))
  const scored = relevant(hits, parsed).map((hit) => ({ hit, score: relevance(hit, parsed) }))
  const languageRank = (hit: SubtitleHit) => order.get(iso1(hit.language) ?? '') ?? order.size
  scored.sort(
    (a, b) =>
      Number(b.hit.hashMatch) - Number(a.hit.hashMatch) ||
      b.score - a.score ||
      languageRank(a.hit) - languageRank(b.hit) ||
      (PROVIDER_ORDER[a.hit.provider] ?? 9) - (PROVIDER_ORDER[b.hit.provider] ?? 9) ||
      b.hit.downloads - a.hit.downloads,
  )
  return scored.map((s) => s.hit)
}
