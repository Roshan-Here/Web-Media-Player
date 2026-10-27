import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STYLE,
  captionCss,
  clampDelay,
  delayLabel,
  positionPercent,
  readStyle,
  stepSize,
} from '../src/lib/subtitle-style.js'
import { defaultLabels, makeTranslate } from '../src/lib/labels.js'

const t = makeTranslate(defaultLabels)

describe('subtitle style', () => {
  it('reads a stored style back, defaulting anything unknown', () => {
    expect(readStyle(null)).toEqual(DEFAULT_STYLE)
    expect(readStyle({ size: 'huge', color: 'yellow', boxOpacity: 9, box: 'yes' })).toEqual({
      ...DEFAULT_STYLE,
      color: 'yellow',
      boxOpacity: 1,
    })
  })

  it('steps the size within the four', () => {
    expect(stepSize('medium', 1)).toBe('large')
    expect(stepSize('xlarge', 1)).toBe('xlarge')
    expect(stepSize('small', -1)).toBe('small')
  })

  it('draws an outline without a box, and a box without an outline', () => {
    const plain = captionCss(DEFAULT_STYLE, '20px')
    expect(plain.backgroundColor).toBe('transparent')
    expect(String(plain.textShadow)).toContain('#000')
    expect(plain.fontSize).toBe('calc(20px * 1)')
    const boxed = captionCss(
      { ...DEFAULT_STYLE, box: true, boxOpacity: 0.8, size: 'large' },
      '20px',
    )
    expect(boxed.backgroundColor).toBe('rgb(0 0 0 / 80%)')
    expect(boxed.textShadow).toBe('none')
    expect(boxed.fontSize).toBe('calc(20px * 1.25)')
  })

  it('places the line higher for raised and high', () => {
    expect(positionPercent('bottom')).toBeLessThan(positionPercent('raised'))
    expect(positionPercent('raised')).toBeLessThan(positionPercent('high'))
  })
})

describe('subtitle timing', () => {
  it('snaps to tenths within ten seconds', () => {
    expect(clampDelay(0.25)).toBe(0.3)
    expect(clampDelay(0.1 + 0.2)).toBe(0.3)
    expect(clampDelay(-12)).toBe(-10)
  })

  it('says it with a sign', () => {
    expect(delayLabel(0, t)).toBe('0 s')
    expect(delayLabel(0.3, t)).toBe('+0.3 s')
    expect(delayLabel(-1.2, t)).toBe('-1.2 s')
  })
})
