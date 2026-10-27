import { describe, expect, it } from 'vitest'
import { defaultLabels, fill, makeTranslate, resolveLabels } from '../src/lib/labels.js'

describe('labels', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(fill('{position} of {duration}', { position: '1:00', duration: '2:00' })).toBe(
      '1:00 of 2:00',
    )
    expect(fill('Hello {name}', {})).toBe('Hello {name}')
  })

  it('takes overrides and falls back to English for the rest', () => {
    const t = makeTranslate(resolveLabels({ play: 'Lecture' }))
    expect(t('play')).toBe('Lecture')
    expect(t('pause')).toBe(defaultLabels.pause)
    expect(t('volumePercent', { percent: 40 })).toBe('40%')
  })
})
