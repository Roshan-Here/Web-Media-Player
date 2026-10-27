import { describe, expect, it } from 'vitest'
import { chapterIndexAt, chapterJump, timelineChapters } from '../src/lib/chapters.js'

const untitled = (n: number) => `Chapter ${n}`
const mark = (start: number, title = '', end = 0) => ({ title, start, end })

describe('timelineChapters', () => {
  it('runs each part to the next one, and the last to the end', () => {
    expect(
      timelineChapters([mark(0, 'Prologue'), mark(20, 'Part A'), mark(5, 'Opening')], 40, untitled),
    ).toEqual([
      { title: 'Prologue', start: 0, end: 5 },
      { title: 'Opening', start: 5, end: 20 },
      { title: 'Part A', start: 20, end: 40 },
    ])
  })

  it('names a part the file left unnamed by its number', () => {
    expect(timelineChapters([mark(0, '  '), mark(30)], 60, untitled).map((c) => c.title)).toEqual([
      'Chapter 1',
      'Chapter 2',
    ])
  })

  it('adds a part before a first mark that comes after the start', () => {
    expect(timelineChapters([mark(12, 'Story'), mark(40, 'End')], 60, untitled)).toEqual([
      { title: 'Chapter 1', start: 0, end: 12 },
      { title: 'Story', start: 12, end: 40 },
      { title: 'End', start: 40, end: 60 },
    ])
  })

  it('treats a first mark just after the start as the start', () => {
    expect(timelineChapters([mark(0.4, 'A'), mark(30, 'B')], 60, untitled)[0]).toEqual({
      title: 'A',
      start: 0,
      end: 30,
    })
  })

  it('merges a mark repeated at the same time, keeping its name', () => {
    expect(
      timelineChapters([mark(0, 'A'), mark(30), mark(30.2, 'B')], 60, untitled).map((c) => c.title),
    ).toEqual(['A', 'B'])
  })

  it('drops marks past the end and broken ones', () => {
    expect(
      timelineChapters(
        [mark(0, 'A'), mark(30, 'B'), mark(59.8, 'C'), mark(90, 'D'), mark(NaN), mark(-3)],
        60,
        untitled,
      ).map((c) => c.title),
    ).toEqual(['A', 'B'])
  })

  it('has no chapters for one part, no marks, or an unknown length', () => {
    expect(timelineChapters([mark(0, 'Whole film')], 60, untitled)).toEqual([])
    expect(timelineChapters([], 60, untitled)).toEqual([])
    expect(timelineChapters([mark(0, 'A'), mark(30, 'B')], 0, untitled)).toEqual([])
  })
})

describe('chapterIndexAt and chapterJump', () => {
  const chapters = timelineChapters(
    [mark(0, 'A'), mark(10, 'B'), mark(20, 'C'), mark(30, 'D')],
    40,
    untitled,
  )

  it('finds the part playing', () => {
    expect([0, 9.9, 10, 25, 39.9, 40].map((t) => chapterIndexAt(chapters, t))).toEqual([
      0, 0, 1, 2, 3, 3,
    ])
    expect(chapterIndexAt([], 5)).toBe(-1)
  })

  it('goes to the next part, and nowhere from the last', () => {
    expect(chapterJump(chapters, 12, 1)?.title).toBe('C')
    expect(chapterJump(chapters, 35, 1)).toBeNull()
  })

  it("goes back to this part's start, or the one before within its first seconds", () => {
    expect(chapterJump(chapters, 15, -1)?.title).toBe('B')
    expect(chapterJump(chapters, 11, -1)?.title).toBe('A')
    expect(chapterJump(chapters, 1, -1)).toBeNull()
  })
})
