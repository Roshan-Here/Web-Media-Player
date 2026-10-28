import { describe, expect, it, vi } from 'vitest'
import type { MenuSection } from '../src/components/Menu.js'
import { defaultLabels, makeTranslate } from '../src/lib/labels.js'
import { withOnlineSubtitles } from '../src/lib/online-menu.js'

const t = makeTranslate(defaultLabels)

function tracks(onSelect = vi.fn()): MenuSection {
  return {
    options: [
      { value: 'off', label: 'Off' },
      { value: 'en', label: 'English' },
    ],
    selected: 'en',
    onSelect,
  }
}

const online = (attached: { label: string; language: string } | null = null) => ({
  available: true,
  attached,
  clear: vi.fn(),
  openPanel: vi.fn(),
})

describe('online subtitles in the Subtitles menu', () => {
  it('leaves the menu alone without a service', () => {
    const base = [tracks()]
    expect(withOnlineSubtitles(base, { ...online(), available: false }, t)).toBe(base)
  })

  it('ends with Search online, which opens the panel', () => {
    const o = online()
    const sections = withOnlineSubtitles([tracks()], o, t)
    const last = sections.at(-1)!
    expect(last.options[0]!.label).toBe('Search online')
    last.onSelect(last.options[0]!.value)
    expect(o.openPanel).toHaveBeenCalled()
  })

  it('checks the attached subtitle, and a track chosen instead puts it away', () => {
    const pick = vi.fn()
    const o = online({ label: 'English · OpenSubtitles', language: 'en' })
    const [first] = withOnlineSubtitles([tracks(pick)], o, t)
    expect(first!.options.at(-1)!.label).toBe('English · OpenSubtitles')
    expect(first!.selected).toBe(first!.options.at(-1)!.value)
    first!.onSelect(first!.options.at(-1)!.value)
    expect(o.clear).not.toHaveBeenCalled()
    first!.onSelect('en')
    expect(o.clear).toHaveBeenCalled()
    expect(pick).toHaveBeenCalledWith('en')
  })

  it('gives a video with no tracks an Off beside the attached one', () => {
    const o = online({ label: 'Français · SubDL', language: 'fr' })
    const none: MenuSection = { options: [], selected: null, onSelect: () => {}, empty: 'None' }
    const sections = withOnlineSubtitles([none], o, t)
    expect(sections[0]!.options.map((x) => x.label)).toEqual(['Off', 'Français · SubDL'])
    expect(sections.some((s) => s.empty)).toBe(false)
    sections[0]!.onSelect('off')
    expect(o.clear).toHaveBeenCalled()
  })
})
