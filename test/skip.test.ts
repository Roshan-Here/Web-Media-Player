import { describe, expect, it } from 'vitest'
import { defaultLabels, makeTranslate } from '../src/lib/labels.js'
import {
  activeSegment,
  creditsStart,
  runsToEnd,
  segmentsFromChapters,
  skipLabel,
  skipTarget,
  type SkipSegment,
} from '../src/lib/skip.js'

describe('the button', () => {
  const intro: SkipSegment = { kind: 'intro', start: 60, end: 150 }
  const credits: SkipSegment = { kind: 'credits', start: 2700, end: null }
  const all = [intro, credits]

  it('shows inside a segment, not in its last second, and not once skipped', () => {
    expect(activeSegment(all, 59, 3000)).toBeNull()
    expect(activeSegment(all, 61, 3000)).toBe(intro)
    expect(activeSegment(all, 149.5, 3000)).toBeNull()
    expect(activeSegment(all, 61, 3000, new Set([60]))).toBeNull()
    expect(activeSegment(all, 2800, 3000)).toBe(credits)
    expect(activeSegment(all, 61, 0)).toBeNull()
  })

  it('knows where closing credits begin, for the next-episode card', () => {
    expect(creditsStart(all, 3000)).toBe(2700)
    expect(runsToEnd({ kind: 'ending', start: 1300, end: 1398 }, 1400)).toBe(true)
    expect(runsToEnd({ kind: 'ending', start: 1300, end: 1350 }, 1400)).toBe(false)
    expect(runsToEnd(intro, 3000)).toBe(false)
    expect(creditsStart([intro], 3000)).toBeNull()
  })

  it('jumps to the end, or to the end of the file for credits that run to it', () => {
    expect(skipTarget(intro, 3000)).toBe(150)
    expect(skipTarget(credits, 3000)).toBe(3000)
    expect(skipLabel('opening', makeTranslate(defaultLabels))).toBe('Skip opening')
  })
})

describe("the file's own chapters", () => {
  it('turns named chapters into segments and ignores the rest', () => {
    expect(
      segmentsFromChapters(
        [
          { title: 'Prologue', start: 0 },
          { title: 'Opening', start: 90 },
          { title: 'Part A', start: 180 },
          { title: 'ED', start: 1290 },
          { title: 'Preview', start: 1380 },
        ],
        1410,
      ),
    ).toEqual([
      { kind: 'opening', start: 90, end: 180 },
      { kind: 'ending', start: 1290, end: 1380 },
      { kind: 'preview', start: 1380, end: null },
    ])
  })

  it('leaves out marks too short or too long to be an intro', () => {
    expect(
      segmentsFromChapters(
        [
          { title: 'Intro', start: 0, end: 2 },
          { title: 'Credits', start: 100, end: 1000 },
        ],
        1000,
      ),
    ).toEqual([])
  })
})
