// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

/** What a name is read from: a file's name, the text posted with it, and a title. */
interface VideoItem {
  key: string
  fileName: string | null
  caption: string
  title: string
}
import { contains, endOf, find, findAll, matchesWhole, minOf, replaceAll } from './name-regex.js'

/*
 * Reading a title, a year, a season and an episode out of a video's file name: a port of
 * TMPlayer's MediaName (core/.../data/MediaName.kt) and the helpers it leans on
 * (SplitPieces.pieceOf, EpisodeCopies.markers, MediaMapper's caption and name rules). The rules
 * and the patterns are TMPlayer's, kept as close to the original as JavaScript allows, so the
 * same file name reads the same way in both apps. Where JavaScript differs: `\b` here is ASCII,
 * as on the desktop JVM TMPlayer's tests run on (Android's ICU treats Tamil or Arabic letters as
 * word characters too), and `\p{...}` classes need the `u` flag.
 */

/** What a short file posted beside a film can be, as its name says. */
export type ExtraKind = 'Trailer' | 'Teaser' | 'Promo' | 'Sample' | 'Extra'

/** A video title and year recovered from a descriptive file name. */
export interface ParsedName {
  title: string
  year: number | null
  /** Set when the name looks like an episode rather than a standalone video. */
  season: number | null
  episode: number | null
  /** "CD2", "Part2", "pt.2" after the title: one piece of a film cut into several files. */
  part: number | null
  /** Set when the file is a trailer, teaser or sample rather than the video itself. */
  extra: ExtraKind | null
  /** "2024-10-14" for a daily show named by the day it aired. Never a film. */
  airDate: string | null
  /** The last episode a file of several holds: 2 for "S01E01E02". */
  lastEpisode: number | null
}

/** Episodic media rather than a standalone video. */
export function isSeriesName(p: ParsedName): boolean {
  return p.season != null || p.episode != null || p.airDate != null
}

/** A single episode, as opposed to a season pack that names no episode at all. */
export function isEpisodeName(p: ParsedName): boolean {
  return p.episode != null
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "S01E02", or "E02" where the uploader never wrote a season down. */
export function episodeCode(p: ParsedName): string | null {
  if (p.episode == null) return null
  const tail = `E${pad2(p.episode)}`
  return p.season != null ? `S${pad2(p.season)}${tail}` : tail
}

/** What to send to a search box: the year disambiguates remakes, so keep it attached. */
export function nameQuery(p: ParsedName): string {
  return p.year != null ? `${p.title} ${p.year}` : p.title
}

function emptyName(): ParsedName {
  return {
    title: '',
    year: null,
    season: null,
    episode: null,
    part: null,
    extra: null,
    airDate: null,
    lastEpisode: null,
  }
}

/** A year later than next year cannot be a release year, so it stays in the title. */
function defaultMaxYear(): number {
  return new Date().getFullYear() + 1
}

// ---- patterns (MediaName.kt:531-696) -------------------------------------------------------

const MIN_YEAR = 1900
/** More pieces than this is a numbered run of clips, not one film cut to fit a disc. */
const MAX_PARTS = 9

/** "Trailer" in Tamil, Hindi and Malayalam script. */
const TRAILER_WORDS = ['ட்ரெய்லர்', 'டிரெய்லர்', 'ट्रेलर', 'ട്രെയിലർ']
/** "Teaser" in the same scripts. */
const TEASER_WORDS = ['டீசர்', 'टीज़र', 'ടീസർ']

/** "CD1", "Disc 2", "Part2", "Part 2", "pt.3" (a dot is a space by now), "Pt-1". */
const PART = /\b(cd|dis[ck]|part|pt)[\s-]?0*(\d{1,2})\b/i

/**
 * What a trailer or a sample calls itself. The Indian-script words end on a vowel sign, so
 * their edges are spelt out rather than left to `\b`.
 */
const EXTRA = new RegExp(
  String.raw`\b(?:official\s+)?(?:trailer|teaser|promo|sample|sneak\s?peek|first\s?look|glimpse|making\s?of)\b(?:\s?\d{1,2}\b)?` +
    String.raw`|(?<![\p{L}\p{M}])(?:${[...TRAILER_WORDS, ...TEASER_WORDS].join('|')})(?![\p{L}\p{M}])`,
  'iu',
)

const CLOSING = new Set([')', ']', '}'])
const ARTICLES = new Set(['', 'the', 'a', 'an'])
const JOINING_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'in',
  'on',
  'into',
  'to',
  'for',
  'with',
  'from',
  'my',
  'our',
])

const ISO_DATE = /(?<!\d)((?:19|20)\d{2})[ -](0[1-9]|1[0-2])[ -](0[1-9]|[12]\d|3[01])(?!\d)/
const DAY_FIRST_DATE = /(?<!\d)(0[1-9]|[12]\d|3[01])[ -](0[1-9]|1[0-2])[ -]((?:19|20)\d{2})(?!\d)/

/** The markers that never belong to a title: a resolution, a codec, a source, a size. */
const HARD_WORDS = [
  String.raw`\d{3,4}[pi]`,
  '4k',
  'uhd',
  '2160p',
  'bluray',
  'blu-ray',
  'bdrip',
  'brrip',
  'bdremux',
  'remux',
  'web-?rip',
  'web-?dl',
  'webrip',
  'hdrip',
  'hdtvrip',
  'dvdrip',
  'dvdr',
  'hdtv',
  'pdtv',
  'vodrip',
  'ds4k',
  'x264',
  'x265',
  'h ?264',
  'h ?265',
  'hevc',
  'xvid',
  'divx',
  '10bit',
  '8bit',
  String.raw`hdr10\+?`,
  String.raw`aac\d?`,
  'ac3',
  'eac3',
  'e-ac3',
  'dd5',
  'ddp5',
  'ddp',
  'dts-hd',
  'dts-ma',
  'truehd',
  String.raw`\d\.\dch`,
  String.raw`\d+kbps`,
  'esubs?',
  'msubs?',
  String.raw`\d+(?:\.\d+)? ?[mg]b`,
  'full ?movie',
]
const HARD_TAGS = new RegExp(String.raw`\b(` + HARD_WORDS.join('|') + String.raw`)\b`, 'i')

/** A dash, a colon or a bar. */
const LEADING_SEPARATOR = /^\s*[-:|–—]/

/**
 * A "[" after the title that opens on two words and holds no digit: the cast or the uploader's
 * notes ("Night Train [ Arun Kumar, Devi ..."), which is a caption written as a file name.
 */
const CAST_BRACKET = /\[\s*(?=\p{L}{2,}\s+\p{L})(?![^\]]*\d)/u

const LANGUAGE_CODES: Record<string, string> = {
  tamil: 'ta',
  telugu: 'te',
  hindi: 'hi',
  malayalam: 'ml',
  kannada: 'kn',
  marathi: 'mr',
  bengali: 'bn',
  punjabi: 'pa',
  english: 'en',
  korean: 'ko',
  japanese: 'ja',
  chinese: 'zh',
  spanish: 'es',
  french: 'fr',
  russian: 'ru',
  german: 'de',
  italian: 'it',
  turkish: 'tr',
  arabic: 'ar',
  // The short forms a multi-audio release lists: "Tam + Tel + Hin".
  tam: 'ta',
  tel: 'te',
  hin: 'hi',
  mal: 'ml',
  eng: 'en',
}
const LANGUAGE = new RegExp(
  String.raw`\b(` + Object.keys(LANGUAGE_CODES).join('|') + String.raw`)\b`,
  'i',
)

const SEPARATORS = /[._]+/
const WHITESPACE = /\s+/
/** Includes the long dashes: "Show — E5" ends in one once cut. */
const TRIM_CHARS = new Set(['-', '–', '—', '(', ')', '[', ']', '{', '}', ',', ':', '_', '.', '|'])

/** An uploader's Telegram handle, wherever in the name they put it. */
const HANDLE = /@[A-Za-z0-9_]{3,}/
/** A tracker's domain, with a known suffix so "S.W.A.T" is not mistaken for one. */
const SITE =
  /\b(?:www\.)?[a-z0-9][a-z0-9-]{2,}\.(?:com|net|org|to|me|cc|io|xyz|site|link|club|ws|sbs|top|pw|info|biz)\b/i

const BRACKETED_YEAR = /[([{]\s*((?:19|20)\d{2})\s*[)\]}]/
const BARE_YEAR = /(?<!\d)((?:19|20)\d{2})(?!\d)/

/** Season and episode written together; a multi-episode file names its last one too. */
const PAIRED_EPISODE = [
  /\bs(\d{1,2})[\s.-]?e(\d{1,3})(?:-?e(\d{1,3}))?\b/i,
  /\b(\d{1,2})x(\d{1,3})\b/i,
  /\bseason\s?(\d{1,2})\s?episode\s?(\d{1,3})\b/i,
]

/** The fansub form: "Show - 02", "Show - 1071", "Show - 02v2". */
const DASHED_EPISODE = /\s-\s(\d{2,4})(?:v\d)?(?=\s|$)/
/** A bracketed group name at the very front, before any title. Never a year. */
const GROUP_TAG = /^\s*\[(?!\s*(?:19|20)\d{2}\s*\])[^\]]{1,40}\]\s*/
const SEASON_ONLY = /\b(?:s|season\s?)(\d{1,2})\b/i
/** The word has to be there: a bare "E04" is too easy to find inside a title. */
const EPISODE_ONLY = /\bep(?:isode)?[\s-]?(\d{1,3})\b/i
/** "E05" with no word in front, which only {@link looseEpisode} reads. */
const BARE_EPISODE = /\be(\d{1,3})\b/i
/** The second code of a two-episode file, "-E02" or "&E02", just after the first. */
const EXTRA_EPISODE = /^\s*[-&+]?\s*e\d{1,3}\b/i

/** The technical vocabulary, used only to find where the title stops. */
const TAG_WORDS = [
  // Resolution and scan
  String.raw`\d{3,4}[pi]`,
  '4k',
  'uhd',
  'hd',
  'sd',
  // Source
  'bluray',
  'blu-ray',
  'bdrip',
  'brrip',
  'bdremux',
  'remux',
  'web-?rip',
  'web-?dl',
  'webrip',
  'web',
  'hdrip',
  'hdtvrip',
  'dvdrip',
  'dvdr',
  'hdtv',
  'pdtv',
  'vodrip',
  'ds4k',
  // Video codec
  'x264',
  'x265',
  'h ?264',
  'h ?265',
  'hevc',
  'avc',
  'xvid',
  'divx',
  'av1',
  'vp9',
  '10bit',
  '8bit',
  String.raw`hdr10\+?`,
  'hdr',
  'dolby ?vision',
  'dv',
  // Audio
  String.raw`aac\d?`,
  'ac3',
  'eac3',
  'e-ac3',
  'dd5',
  'ddp5',
  'ddp',
  String.raw`dd\+`,
  'dts',
  'dts-hd',
  'dts-ma',
  'truehd',
  'atmos',
  'flac',
  'mp3',
  'opus',
  String.raw`\d\.\d?ch`,
  String.raw`\d+ch`,
  String.raw`\d+kbps`,
  'dual ?audio',
  'multi',
  // Streaming source, which Indian releases in particular carry
  'nf',
  'amzn',
  'dsnp',
  'hmax',
  'hulu',
  'sonyliv',
  'zee5',
  'hotstar',
  'jiocinema',
  // Language: uploaders name the audio track, and it otherwise reads as part of the title.
  'tamil',
  'telugu',
  'hindi',
  'malayalam',
  'kannada',
  'marathi',
  'bengali',
  'punjabi',
  'english',
  'korean',
  'japanese',
  'chinese',
  'spanish',
  'french',
  'russian',
  'german',
  'italian',
  'turkish',
  'arabic',
  // Edition labels describe a cut, not the base title.
  "director'?s ?cut",
  'theatrical',
  'imax',
  'remastered',
  'criterion',
  'anniversary',
  'special ?edition',
  'final ?cut',
  // Release furniture
  'proper',
  'repack',
  'extended',
  'unrated',
  'uncut',
  'limited',
  'internal',
  'complete',
  'retail',
  'subbed',
  'dubbed',
  'esubs?',
  'msubs?',
  'hq',
  'hs',
  'nuked',
  'full ?movie',
  String.raw`\d+(?:\.\d+)? ?[mg]b`,
]
const TAGS = new RegExp(String.raw`\b(` + TAG_WORDS.join('|') + String.raw`)\b`, 'i')

// ---- small text helpers --------------------------------------------------------------------

const isSpace = (c: string) => /\s/.test(c)
const isTrimmable = (c: string) => isSpace(c) || TRIM_CHARS.has(c)

/** Kotlin's `trim { predicate }`. */
function trimBy(text: string, drop: (c: string) => boolean): string {
  let start = 0
  let end = text.length
  while (start < end && drop(text[start]!)) start++
  while (end > start && drop(text[end - 1]!)) end--
  return text.slice(start, end)
}

function trimStartBy(text: string, drop: (c: string) => boolean): string {
  let start = 0
  while (start < text.length && drop(text[start]!)) start++
  return text.slice(start)
}

/** Separators as spaces, whitespace collapsed, trimmed. */
function spaced(text: string): string {
  return replaceAll(replaceAll(text, SEPARATORS, ' '), WHITESPACE, ' ').trim()
}

/** An unterminated "(" is what is left when the title is cut at a bracketed year. */
function clean(raw: string): string {
  return replaceAll(trimBy(raw, isTrimmable), WHITESPACE, ' ').trim()
}

/** Kotlin's `lineSequence()` then the first line that says anything, trimmed. */
export function firstLine(text: string | null | undefined): string | null {
  if (!text) return null
  for (const line of text.split(/\r\n|\n|\r/)) {
    const t = line.trim()
    if (t) return t
  }
  return null
}

/** Whether everything in [text] is tags and separators. */
function onlyTags(text: string): boolean {
  return [...replaceAll(text, TAGS, ' ')].every(isTrimmable)
}

// ---- the parser ----------------------------------------------------------------------------

/**
 * Reads a file name, with the post's caption as a second source for the episode.
 *
 * "Harbour Notes (2026) Malayalam (1080p WEB-Rip E-AC3).mkv" gives "Harbour Notes", 2026. The
 * convention is title first, then the year, then a pile of technical markers, so the title is
 * everything before the first marker. Deliberately conservative: a wrong title is worse than
 * none, so anything ambiguous comes back as a bare title with no year.
 *
 * The file name wins whenever it carries an episode of its own: a caption is free text and its
 * first line is often an advert. Only the caption's first line is read, as text rather than as a
 * file name, and a caption that names an episode but no title keeps the file name's title.
 */
export function parseMediaName(
  name: string,
  caption?: string | null,
  maxYear: number = defaultMaxYear(),
): ParsedName {
  const fromName = parseFileName(name, maxYear)
  if (fromName.episode != null) return fromName
  const line = firstLine(caption)
  if (line == null) return fromName
  const fromCaption = read(line, maxYear).parsed
  if (fromCaption.episode == null) return fromName
  const nameTitle = name.trim() ? fromName.title : ''
  return {
    ...fromCaption,
    title: fromCaption.title || nameTitle,
    year: fromCaption.year ?? fromName.year,
  }
}

function parseFileName(fileName: string, maxYear: number): ParsedName {
  const result = read(stripExtension(fileName), maxYear)
  // Falling back to the whole name matters for a file that is nothing but a title.
  return { ...result.parsed, title: result.parsed.title || result.whole }
}

interface Read {
  parsed: ParsedName
  whole: string
}

function read(text: string, maxYear: number): Read {
  const stripped = stripDecoration(text)
  // Separators are interchangeable: one tracker uses dots, another spaces.
  let normalised = spaced(stripped)
  if (!normalised) return { parsed: emptyName(), whole: '' }

  // "Trailer - Night Train (2024)": only with a dash or a colon after it, so "Sample Room Tales"
  // stays a title.
  const lead = find(EXTRA, normalised)
  let leadingExtra: RegExpExecArray | null = null
  if (lead && lead.index === 0 && LEADING_SEPARATOR.test(normalised.slice(endOf(lead)))) {
    leadingExtra = lead
    normalised = clean(normalised.slice(endOf(lead)))
    if (!normalised) return { parsed: { ...emptyName(), extra: extraOf(lead[0]) }, whole: '' }
  }

  // A daily show or a match is numbered by the day it aired, "Show 2024.10.14 720p".
  const date = findAirDate(normalised)
  const episode = date == null ? findEpisode(normalised) : null
  const year = date != null ? { value: date.year, at: date.at } : findYear(normalised, maxYear)

  // The title ends at whichever marker comes first.
  const dated = minOf([year?.at, episode?.at, date?.at])
  const markers = minOf([dated, titleEnd(normalised, dated)])
  const part = episode == null ? findPart(normalised, markers) : null
  // The word has to end the title: "Night Train Trailer", but not "The Sample Room (2020)".
  const extra = findAll(EXTRA, normalised).find((m) => {
    if (m.index <= 0) return false
    if (markers != null && m.index > markers) return true
    const end = endOf(m)
    return clean(normalised.slice(end, Math.max(markers ?? normalised.length, end))) === ''
  })
  const castAt = find(CAST_BRACKET, normalised)?.index
  const bracket = castAt != null && castAt > 0 ? castAt : null
  const cut = minOf([markers, part?.at, extra?.index, bracket]) ?? normalised.length

  const word = extra ?? leadingExtra
  return {
    parsed: {
      title: clean(normalised.slice(0, cut)),
      year: year?.value ?? null,
      season: episode?.season ?? null,
      episode: episode?.number ?? null,
      lastEpisode: episode?.last ?? null,
      part: part?.number ?? null,
      extra: word ? extraOf(word[0]) : null,
      airDate: date?.text ?? null,
    },
    whole: clean(normalised),
  }
}

/**
 * "CD1", "Disc 2", "Part2", "pt.3": the piece of one film a file holds. "Part 2" with a space
 * reads as a sequel's title unless it comes after the year or the tags, where no title is.
 */
function findPart(text: string, markers: number | null): { number: number; at: number } | null {
  const match = findAll(PART, text).find((m) => m.index > 0)
  if (!match) return null
  const number = Number(match[2])
  if (!(number >= 1 && number <= MAX_PARTS)) return null
  const word = match[1]!.toLowerCase()
  const runTogether = !match[0].includes(' ')
  const afterTitle = markers != null && match.index > markers
  const split = word === 'cd' || word.startsWith('dis') || runTogether || afterTitle
  return split ? { number, at: match.index } : null
}

function extraOf(word: string): ExtraKind {
  const text = word.toLowerCase()
  if (text.includes('trailer') || TRAILER_WORDS.some((w) => text.includes(w))) return 'Trailer'
  if (text.includes('teaser') || TEASER_WORDS.some((w) => text.includes(w))) return 'Teaser'
  if (text.includes('promo')) return 'Promo'
  if (text.includes('sample')) return 'Sample'
  return 'Extra'
}

interface Episode {
  season: number | null
  number: number | null
  at: number
  last: number | null
}

const toInt = (s: string | undefined): number | null => {
  if (s == null || s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Finds an episode however the uploader wrote it: "S02E04", "2x04", "Season 2 Episode 4",
 * "S01 EP04", "Ep 04", or the fansub "Show - 04". A season with no episode is a whole-season
 * pack, which is still television, just with no single episode to show.
 */
function findEpisode(text: string): Episode | null {
  let paired: RegExpExecArray | null = null
  for (const re of PAIRED_EPISODE) {
    const m = find(re, text)
    if (m && (paired == null || m.index < paired.index)) paired = m
  }
  if (paired) {
    const number = toInt(paired[2])
    const last = toInt(paired[3])
    return {
      season: toInt(paired[1]),
      number,
      at: paired.index,
      last: last != null && number != null && last > number ? last : null,
    }
  }
  const season = find(SEASON_ONLY, text)
  let number = find(EPISODE_ONLY, text)
  if (!number) {
    const dashed = find(DASHED_EPISODE, text)
    number = dashed && !notAnEpisode(dashed, text) ? dashed : null
  }
  if (!season && !number) return null
  return {
    season: toInt(season?.[1]),
    number: toInt(number?.[1]),
    at: minOf([season?.index, number?.index])!,
    last: null,
  }
}

/**
 * "Show - 2019" is a year, not episode 2019, and a number after the release tags is a picture
 * height or what is left of a name Telegram cut short.
 */
function notAnEpisode(match: RegExpExecArray, text: string): boolean {
  if (contains(TAGS, text.slice(0, match.index))) return true
  const digits = match[1]!
  const value = Number(digits)
  return digits.length === 4 && value >= MIN_YEAR && value <= 2099
}

/**
 * A bracketed year is always the recording year, and a year later than next year cannot be one.
 * Otherwise the last plausible year wins, unless it opens the name: "1944.1080p.mkv" is a title.
 */
function findYear(text: string, maxYear: number): { value: number; at: number } | null {
  const inRange = (v: number) => v >= MIN_YEAR && v <= maxYear
  const bracketed = findAll(BRACKETED_YEAR, text)
    .map((m) => ({ value: Number(m[1]), at: m.index }))
    .filter((y) => inRange(y.value))
  if (bracketed.length > 0) return bracketed[bracketed.length - 1]!
  const bare = findAll(BARE_YEAR, text)
    .map((m) => ({ value: Number(m[1]), at: m.index }))
    .filter((y) => inRange(y.value) && (y.at > 0 || CLOSING.has(text[4] ?? '')))
  return bare.length > 0 ? bare[bare.length - 1]! : null
}

/** Where the technical markers start; a marker at the very front would leave no title. */
function firstTagIndex(text: string): number | null {
  return minOf(findAll(TAGS, text).map((m) => (m.index > 0 ? m.index : null)))
}

/**
 * Where the title ends on account of its tags. A hard marker ends it wherever it is; a softer
 * word (a language, an edition, "Complete") only where nothing but tags follows it up to the
 * next marker, so "The Italian Job 2003" and "Learn Tamil Fast" keep their words.
 */
function titleEnd(text: string, dated: number | null): number | null {
  const hard = findAll(HARD_TAGS, text).find((m) => m.index > 0)?.index ?? null
  const bound = minOf([dated, hard]) ?? text.length
  const soft = findAll(TAGS, text).find((m) => {
    const at = m.index
    if (at < 1 || at >= bound) return false
    if (!onlyTags(text.slice(at, bound))) return false
    if (ARTICLES.has(clean(text.slice(0, at)).toLowerCase())) return false
    // "Into the Web", "Tales of Tamil": a word straight after "the" or "of" is the title's.
    const before = text.slice(0, at).trim()
    const lastWord = before.slice(before.lastIndexOf(' ') + 1).toLowerCase()
    return !JOINING_WORDS.has(lastWord)
  })?.index
  return minOf([hard, soft])
}

/** "2024 10 14" or "14 10 2024", separators already spaces, after a title. */
function findAirDate(text: string): { text: string; year: number; at: number } | null {
  const iso = find(ISO_DATE, text)
  if (iso && iso.index > 0) {
    return { text: `${iso[1]}-${iso[2]}-${iso[3]}`, year: Number(iso[1]), at: iso.index }
  }
  const dayFirst = find(DAY_FIRST_DATE, text)
  if (dayFirst && dayFirst.index > 0) {
    return {
      text: `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}`,
      year: Number(dayFirst[3]),
      at: dayFirst.index,
    }
  }
  return null
}

/**
 * Removes the branding uploaders staple to the front of a name: symbols that render as a logo
 * (every emoji and the squared and circled letters are Unicode "other symbols"), a fansub
 * group's "[Group]", a "@handle" and a tracker's domain. Letters in any script are left alone.
 */
function stripDecoration(name: string): string {
  let text = name.replace(/\p{So}/gu, '')
  text = text.replace(GROUP_TAG, '')
  text = replaceAll(text, HANDLE, handleOf)
  text = replaceAll(text, SITE, ' ')
  return trimStartBy(text, isTrimmable)
}

/**
 * A handle can run on into the name with underscores ("@TamilMob_LinkZz_BEAST_2022_Tamil_HQ").
 * When it runs into a year or a release tag, the handle is its first two words and the rest
 * goes back as the name.
 */
function handleOf(match: string): string {
  const words = match
    .slice(1)
    .split('_')
    .filter((w) => w.length > 0)
  const runsOn = words.slice(1).some((w) => matchesWhole(BARE_YEAR, w) || matchesWhole(TAGS, w))
  return runsOn && words.length > 2 ? ` ${words.slice(2).join(' ')}` : ' '
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/**
 * The name without its extension, and without a byte piece's suffix ("Name.mkv.001",
 * "Name.part007"). Only something that is actually an extension goes: "Workshop 2" keeps its 2
 * and "S.W.A.T" its T.
 */
export function stripExtension(whole: string): string {
  const pieceFound = pieceOf(whole)
  const piece = pieceFound?.certain ? pieceFound : null
  if (piece && !VIDEO_EXTENSIONS.has(extensionOf(piece.base))) return piece.base
  const name = piece?.base ?? whole
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return name
  const extension = name.slice(dot + 1)
  return /^[\p{L}\p{N}]{2,4}$/u.test(extension) ? name.slice(0, dot) : name
}

// ---- the other readings --------------------------------------------------------------------

/**
 * The lenient reading, for a chat that has already established the show: a bare "E05" after the
 * title, which {@link parseMediaName} turns down on its own. Null unless there is a title before
 * it and an episode number in it.
 */
export function looseEpisode(text: string, maxYear: number = defaultMaxYear()): ParsedName | null {
  const strict = parseMediaName(text, null, maxYear)
  if (strict.episode != null) return strict
  const normalised = spaced(stripDecoration(stripExtension(text)))
  const match = find(BARE_EPISODE, normalised)
  if (!match || match.index <= 0) return null
  const title = clean(read(normalised.slice(0, match.index), maxYear).parsed.title)
  if (!title) return null
  return { ...emptyName(), title, year: strict.year, episode: Number(match[1]) }
}

/**
 * The episode's own name where the uploader wrote one after the code:
 * "Harbour.Notes.S01E04.The.Lighthouse.1080p.mkv" gives "The Lighthouse".
 */
export function episodeName(text: string): string | null {
  const normalised = spaced(stripDecoration(stripExtension(text)))
  const candidates: RegExpExecArray[] = []
  for (const re of [...PAIRED_EPISODE, EPISODE_ONLY, BARE_EPISODE]) {
    const m = find(re, normalised)
    if (m) candidates.push(m)
  }
  const dashed = find(DASHED_EPISODE, normalised)
  if (dashed && !notAnEpisode(dashed, normalised)) candidates.push(dashed)
  if (candidates.length === 0) return null
  const code = candidates.reduce((a, b) => (b.index < a.index ? b : a))
  const rest = normalised.slice(endOf(code)).replace(EXTRA_EPISODE, '')
  const brackets = ['(', '[', '{'].map((c) => rest.indexOf(c)).filter((i) => i >= 0)
  const cut =
    minOf([find(TAGS, rest)?.index, find(BARE_YEAR, rest)?.index, ...brackets]) ?? rest.length
  const name = clean(rest.slice(0, cut))
  return [...name].filter((c) => /\p{L}/u.test(c)).length >= 2 ? name : null
}

/**
 * The name a card shows for a file: "Gladiator II (2024)" for
 * "Gladiator.II.2024.1080p.WEB-DL.x265.mkv", "Harbour Notes S01E03" for an episode, and for a
 * name that is no release name at all, the name tidied ("Lecture 07 - Limits"). The title is only
 * cut short where the name proves it is a release, so "Learn Tamil Fast" is never cut to one
 * word. Null when nothing readable is left.
 */
export function tileTitle(
  fileName: string,
  caption?: string | null,
  maxYear: number = defaultMaxYear(),
): string | null {
  if (!fileName.trim()) return null
  const tidy = clean(spaced(stripDecoration(stripExtension(fileName))))
  const parsed = parseMediaName(fileName, caption, maxYear)
  const hard = find(HARD_TAGS, tidy)?.index ?? 0
  const cast = find(CAST_BRACKET, tidy)?.index ?? 0
  const release =
    parsed.year != null ||
    parsed.episode != null ||
    copyMarkers(fileName).size > 0 ||
    endsInTags(tidy) ||
    parsed.part != null ||
    parsed.extra != null ||
    hard > 0 ||
    cast > 0
  // A name that is nothing but its marker ("Episode 1") already says it.
  const keep = release && parsed.title.trim() && parsed.title.toLowerCase() !== tidy.toLowerCase()
  if (!keep) return tidy || null
  if (parsed.episode != null) return `${parsed.title} ${episodeCode(parsed)}`
  if (parsed.year != null) return `${parsed.title} (${parsed.year})`
  return parsed.title
}

/** Whether everything from the first release tag on is tags: "Marina Tamil Hd". */
function endsInTags(text: string): boolean {
  const start = firstTagIndex(text)
  if (start == null) return false
  return onlyTags(text.slice(start))
}

/**
 * The audio languages a name states after its title, as ISO 639-1 codes in the order written.
 * A language word at the very front is the title's own ("Tamil Lessons").
 */
export function nameLanguages(text: string): string[] {
  const normalised = spaced(stripDecoration(stripExtension(text)))
  const out: string[] = []
  for (const m of findAll(LANGUAGE, normalised)) {
    if (m.index <= 0) continue
    const code = LANGUAGE_CODES[m[0].toLowerCase()]
    if (code && !out.includes(code)) out.push(code)
  }
  return out
}

// ---- copies, quality and generic names (EpisodeCopies, MediaMapper) ------------------------

const RESOLUTION = /(?<![a-z0-9])(\d{3,4})[pi](?![a-z0-9])/
const UHD = /(?<![a-z0-9])(4k|uhd)(?![a-z0-9])/
const HEVC = /(?<![a-z0-9])(x265|h\.?265|hevc)(?![a-z0-9])/
const AVC = /(?<![a-z0-9])(x264|h\.?264|avc)(?![a-z0-9])/
const TEN_BIT = /(?<![a-z0-9])10.?bit(?![a-z0-9])/

/** The markers that say how a copy was made (resolution, codec), in one spelling each. */
export function copyMarkers(name: string): Set<string> {
  const text = name.toLowerCase()
  const out = new Set<string>()
  const resolution = find(RESOLUTION, text)
  if (resolution) out.add(resolution[1]!)
  if (UHD.test(text)) out.add('2160')
  if (HEVC.test(text)) out.add('hevc')
  if (AVC.test(text)) out.add('avc')
  if (TEN_BIT.test(text)) out.add('10bit')
  return out
}

const RESOLUTION_4K = /\b(2160p|4k|uhd)\b/
/** "HDRip - 1080.mkv": the height with its "p" left off, only beside release words. */
const BARE_1080 = /(?<!\w)1080(?!\w)/
const BARE_720 = /(?<!\w)720(?!\w)/
const RELEASE_WORDS = /(rip|web|blu-?ray|x26[45]|h\.?26[45]|hevc|avc|aac|hq)/

/** The one badge worth showing, how sharp the file is: "4K", "1080p", "720p", "SD". */
export function qualityTags(fileName: string | null | undefined): string[] {
  if (fileName == null) return []
  const name = fileName.toLowerCase()
  if (RESOLUTION_4K.test(name)) return ['4K']
  if (
    name.includes('1080p') ||
    name.includes('1080i') ||
    (BARE_1080.test(name) && RELEASE_WORDS.test(name))
  )
    return ['1080p']
  if (name.includes('720p') || (BARE_720.test(name) && RELEASE_WORDS.test(name))) return ['720p']
  if (name.includes('480p') || name.includes('360p')) return ['SD']
  return []
}

/** Containers the parser treats as an extension (MediaMapper.VIDEO_EXTENSIONS). */
export const VIDEO_EXTENSIONS = new Set([
  'mkv',
  'mp4',
  'm4v',
  'avi',
  'mov',
  'webm',
  'ts',
  'm2ts',
  'mts',
  'flv',
  'wmv',
  'mpg',
  'mpeg',
  '3gp',
  'ogv',
  'divx',
  'vob',
  'asf',
  'rmvb',
])

const GENERIC_NAMES = [
  // Camera rolls, Telegram's own saves and screen recorders: a prefix, then a date and time.
  /(vid|img|mov|pxl|mvimg|video|movie|clip|file|document|telegram|tg|record|recording|screen[ _-]?record(ing)?|screenrecorder|wa)[ _-]*\d[\d _.:-]*(wa\d+)?([ _-]?\(\d+\))?/,
  // "video", "video (2)", "untitled".
  /(video|vid|movie|clip|file|untitled|new video)([ _-]*\(?\d+\)?)?/,
  // A number, or a date and time, and nothing else.
  /[\d _.:-]+/,
  // A hash or a UUID.
  /[0-9a-f]{16,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
]

/**
 * Whether a camera, a messenger or a screen recorder chose the name rather than a person:
 * `VID_20241013_120000.mp4`, `IMG_1234.MOV`, `video.mp4`, a bare number or a hash.
 */
export function isGenericName(fileName: string): boolean {
  const trimmed = fileName.trim()
  const dot = trimmed.lastIndexOf('.')
  const base = (dot < 0 ? trimmed : trimmed.slice(0, dot)).trim().toLowerCase()
  if (!base) return true
  return GENERIC_NAMES.some((re) => matchesWhole(re, base))
}

// ---- captions (MediaMapper.captionOf) ------------------------------------------------------

const LINKISH = /(https?:\/\/\S+|www\.\S+|t\.me\/\S+|telegram\.me\/\S+|@[A-Za-z0-9_]{4,}|#\S+)/
const NOT_A_LETTER = /[^\p{L}\p{N} ]+/u
const CALL_WORDS = new Set(
  'join us subscribe follow share channel our for more via by from on telegram main backup group updates official here click visit and to the now link links'.split(
    ' ',
  ),
)
const CAPTION_MAX = 600
const TITLE_MAX = 120

/** A line that is nothing but links and handles, or one behind "Join" or "Subscribe". */
function isBoilerplate(line: string): boolean {
  if (!line.trim() || !contains(LINKISH, line)) return false
  const rest = replaceAll(replaceAll(line, LINKISH, ' '), NOT_A_LETTER, ' ')
    .trim()
    .toLowerCase()
  if (!rest) return true
  return rest
    .split(' ')
    .filter((w) => w.length > 0)
    .every((w) => CALL_WORDS.has(w))
}

/**
 * The caption with the channel's advertising lines taken off and kept short: it is read for an
 * episode and shown as a synopsis, never as a whole post.
 */
export function cleanCaption(text: string | null | undefined): string {
  if (!text || !text.trim()) return ''
  return text
    .split(/\r\n|\n|\r/)
    .map((l) => l.trimEnd())
    .filter((l) => !isBoilerplate(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, CAPTION_MAX)
}

/**
 * The name to read a show or a film out of: the file's own, unless a camera or Telegram made it
 * up, in which case the caption's first line (TMPlayer's `displayTitle` and `nameForParsing`).
 */
export function nameForParsing(item: Pick<VideoItem, 'fileName' | 'caption' | 'title'>): string {
  const fileName = item.fileName?.trim() ?? ''
  if (fileName && !isGenericName(fileName)) return item.fileName ?? ''
  const line = firstLine(cleanCaption(item.caption))
  if (line) return line.slice(0, TITLE_MAX)
  return fileName || item.title
}

interface Memo {
  fileName: string | null
  caption: string
  title: string
  parsed: ParsedName
  alone: ParsedName
  cleaned: string
}

const MEMO_LIMIT = 20_000
const memo = new Map<string, Memo>()

function memoOf(item: VideoItem): Memo {
  const held = memo.get(item.key)
  if (
    held &&
    held.fileName === item.fileName &&
    held.caption === item.caption &&
    held.title === item.title
  )
    return held
  const cleaned = cleanCaption(item.caption)
  const name = nameForParsing(item)
  const alone = parseMediaName(name)
  const parsed = cleaned ? parseMediaName(name, cleaned) : alone
  const entry: Memo = {
    fileName: item.fileName,
    caption: item.caption,
    title: item.title,
    parsed,
    alone,
    cleaned,
  }
  if (memo.size >= MEMO_LIMIT) memo.delete(memo.keys().next().value!)
  memo.set(item.key, entry)
  return entry
}

/** What to parse for a Telegram video (file name unless generic, else title), memoised per key. */
export function parsedNameOf(item: VideoItem): ParsedName {
  return memoOf(item).parsed
}

/** The same without the caption, for a caption the chat puts under every post. */
export function parsedNameAloneOf(item: VideoItem): ParsedName {
  return memoOf(item).alone
}

/** The caption without the channel's boilerplate, memoised with the parse. */
export function cleanCaptionOf(item: VideoItem): string {
  return memoOf(item).cleaned
}

// ---- byte pieces (SplitPieces.pieceOf) -----------------------------------------------------

/** What a name says about one piece of a file cut into raw byte pieces. */
export interface SplitPiece {
  base: string
  number: number
  /** False for a name that could also be an ordinary file ("Name.part001.mkv", "Name.001"). */
  certain: boolean
}

const PART_SUFFIX = /^(.+?)([._\s-])part[._-]?(\d{1,4})$/i
const PART_THEN_EXT = /^(.+?)[._\s-]part[._-]?(\d{3,4})\.([A-Za-z0-9]{2,4})$/i
const NUMBER_EXT = /^(.+?)\.(\d{2,4})$/
const ARCHIVES = new Set([
  '7z',
  'zip',
  'rar',
  'tar',
  'gz',
  'tgz',
  'bz2',
  'xz',
  'zst',
  'lz',
  'lzma',
  'cab',
  'arj',
  'lzh',
  'iso',
  'img',
  'exe',
  'apk',
])
const padded = (digits: string) => digits.length >= 2 && digits[0] === '0'

function piece(base: string, digits: string, certain: boolean): SplitPiece | null {
  if (!base.trim()) return null
  if (ARCHIVES.has(extensionOf(base))) return null
  return { base, number: Number(digits), certain }
}

/**
 * The byte piece a name stands for ("Name.part001", "Name.mkv.001"), or null. Telegram's 4 GB
 * limit is why such pieces exist; none of them plays alone.
 */
export function pieceOf(fileName: string): SplitPiece | null {
  const name = fileName.trim()
  if (!name) return null
  const endsInDigit = /\d/.test(name[name.length - 1]!)
  if (!endsInDigit && !name.toLowerCase().includes('part')) return null
  if (endsInDigit) {
    const m = PART_SUFFIX.exec(name)
    if (m) {
      // "Night_Train_Part_2" is a title; only a dot is a splitter's suffix whatever the number.
      if (m[2] !== '.' && !padded(m[3]!)) return null
      return piece(m[1]!, m[3]!, true)
    }
  }
  const then = PART_THEN_EXT.exec(name)
  if (then) {
    const extension = then[3]!.toLowerCase()
    if (!VIDEO_EXTENSIONS.has(extension)) return null
    return piece(`${then[1]}.${extension}`, then[2]!, false)
  }
  const numbered = NUMBER_EXT.exec(name)
  if (numbered) {
    const base = numbered[1]!
    const digits = numbered[2]!
    if (VIDEO_EXTENSIONS.has(extensionOf(base))) return piece(base, digits, true)
    // "Night.Train.2019.001" is a piece; "Night.Train.1080" is a height.
    if (digits.length >= 3 && padded(digits)) return piece(base, digits, false)
  }
  return null
}

const NOT_WORD = /[^\p{L}\p{M}\p{N}]+/gu

/** A title as a key: lower case, words only, single spaces ("Show: The Name!" → "show the name"). */
export function seriesKeyOf(title: string): string {
  return title.toLowerCase().replace(NOT_WORD, ' ').trim().replace(/\s+/g, ' ')
}
