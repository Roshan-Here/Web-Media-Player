// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Roshan-Here (https://github.com/Roshan-Here) - Web-Media-Player

import { languageName as trackLanguageName } from 'web-buildin-decoder'

/*
 * Languages as OpenSubtitles writes them: two-letter ISO 639-1 codes, with Brazilian Portuguese
 * kept apart as `pt-br`. Track languages in files are often three-letter codes.
 */

/** ISO 639-2 (bibliographic and terminology) to 639-1, for the languages files commonly use. */
const ISO_639_2: Record<string, string> = {
  eng: 'en',
  spa: 'es',
  fre: 'fr',
  fra: 'fr',
  ger: 'de',
  deu: 'de',
  ita: 'it',
  por: 'pt',
  rus: 'ru',
  jpn: 'ja',
  kor: 'ko',
  chi: 'zh',
  zho: 'zh',
  ara: 'ar',
  hin: 'hi',
  tam: 'ta',
  tel: 'te',
  mal: 'ml',
  kan: 'kn',
  ben: 'bn',
  mar: 'mr',
  urd: 'ur',
  tur: 'tr',
  pol: 'pl',
  ukr: 'uk',
  dut: 'nl',
  nld: 'nl',
  swe: 'sv',
  nor: 'no',
  nob: 'nb',
  nno: 'nn',
  dan: 'da',
  fin: 'fi',
  gre: 'el',
  ell: 'el',
  heb: 'he',
  ind: 'id',
  may: 'ms',
  msa: 'ms',
  tha: 'th',
  vie: 'vi',
  per: 'fa',
  fas: 'fa',
  cze: 'cs',
  ces: 'cs',
  hun: 'hu',
  rum: 'ro',
  ron: 'ro',
  bul: 'bg',
  hrv: 'hr',
  srp: 'sr',
  slo: 'sk',
  slk: 'sk',
  slv: 'sl',
  est: 'et',
  lav: 'lv',
  lit: 'lt',
  ice: 'is',
  isl: 'is',
  cat: 'ca',
  baq: 'eu',
  eus: 'eu',
  glg: 'gl',
  alb: 'sq',
  sqi: 'sq',
  mac: 'mk',
  mkd: 'mk',
  bos: 'bs',
  geo: 'ka',
  kat: 'ka',
  arm: 'hy',
  hye: 'hy',
  aze: 'az',
  kaz: 'kk',
  uzb: 'uz',
  tgl: 'tl',
  fil: 'tl',
  khm: 'km',
  lao: 'lo',
  bur: 'my',
  mya: 'my',
  sin: 'si',
  nep: 'ne',
  pan: 'pa',
  guj: 'gu',
  ori: 'or',
  asm: 'as',
  swa: 'sw',
  afr: 'af',
  amh: 'am',
  som: 'so',
  wel: 'cy',
  cym: 'cy',
  gle: 'ga',
  bel: 'be',
  mon: 'mn',
  tib: 'bo',
  bod: 'bo',
  epo: 'eo',
  lat: 'la',
}

const NOT_A_LANGUAGE = new Set(['und', 'mul', 'zxx', 'qaa', 'xa'])

/** A track or interface language as OpenSubtitles' code; Portuguese keeps its two kinds. */
export function iso1(code: string | null | undefined): string | null {
  const raw = code?.trim().replace(/_/g, '-').toLowerCase()
  if (!raw) return null
  if (raw === 'pt-br' || raw === 'pob') return 'pt-br'
  const base = raw.split('-')[0]!
  if (NOT_A_LANGUAGE.has(base)) return null
  return ISO_639_2[base] ?? (/^[a-z]{2}$/.test(base) ? base : null)
}

/**
 * The languages to search in, best first: the one last chosen for this show, then the
 * browser's own, then English.
 */
export function languagesFor(
  preferred: string | null,
  browser: readonly string[] = browserLanguages(),
): string[] {
  const out: string[] = []
  for (const code of [preferred, ...browser.slice(0, 2), 'en']) {
    const c = iso1(code)
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length ? navigator.languages : [navigator.language]
}

/**
 * "English" for "en", "Brazilian Portuguese" for "pt-br", in `locale` (through
 * Intl.DisplayNames); `unknown` for nothing.
 */
export function languageLabel(code: string, unknown: string, locale?: string): string {
  return trackLanguageName(code, locale) ?? (code || unknown)
}

const englishNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' })
  } catch {
    return null
  }
})()

/** "spanish" as SubDL writes it in `lang`, as a code; null when no language has that name. */
export function codeOfEnglishName(name: string): string | null {
  const wanted = name.trim().toLowerCase()
  if (!wanted || !englishNames) return null
  for (const code of new Set(Object.values(ISO_639_2))) {
    if (englishNames.of(code)?.toLowerCase() === wanted) return code
  }
  return null
}
