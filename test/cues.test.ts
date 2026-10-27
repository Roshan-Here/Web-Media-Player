import { describe, expect, it } from 'vitest'
import { assText, CueTrack, parseSubtitle } from '../src/lib/cues.js'

describe('SubRip', () => {
  it('reads cues, keeps line breaks and drops tags', () => {
    const cues = parseSubtitle(
      [
        '1',
        '00:00:01,000 --> 00:00:02,500',
        '<i>Hello</i> there',
        '{\\an8}<font color="#ff0">second line</font>',
        '',
        '2',
        '00:01:02,050 --> 00:01:03,000 X1:10 X2:20',
        'Next',
        '',
      ].join('\r\n'),
      'srt',
    )
    expect(cues).toEqual([
      { start: 1, end: 2.5, text: 'Hello there\nsecond line' },
      { start: 62.05, end: 63, text: 'Next' },
    ])
  })

  it('reads a file without blank lines between cues', () => {
    const cues = parseSubtitle(
      '1\n00:00:01,000 --> 00:00:02,000\nOne\n2\n00:00:03,000 --> 00:00:04,000\nTwo\n',
      'srt',
    )
    expect(cues.map((c) => c.text)).toEqual(['One', 'Two'])
  })

  it('skips broken cues', () => {
    const cues = parseSubtitle('1\n00:00:05,000 --> 00:00:04,000\nBackwards\n\nnonsense\n', 'srt')
    expect(cues).toEqual([])
  })
})

describe('WebVTT', () => {
  it('reads cues without hours, skipping the header, notes and styles', () => {
    const cues = parseSubtitle(
      [
        'WEBVTT - with a title',
        '',
        'NOTE written by hand',
        '',
        'STYLE',
        '::cue { color: lime }',
        '',
        'intro',
        '00:01.000 --> 00:04.000 line:0 position:20%',
        '<v Roger>Hi &amp; welcome</v>',
        '',
        '01:00:00.000 --> 01:00:01.000',
        'Late <00:00:00.500><c.loud>words</c>',
      ].join('\n'),
      'vtt',
    )
    expect(cues).toEqual([
      { start: 1, end: 4, text: 'Hi & welcome' },
      { start: 3600, end: 3601, text: 'Late words' },
    ])
  })
})

describe('ASS and SSA', () => {
  const ass = [
    '[Script Info]',
    'Title: test',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname',
    'Style: Default,Arial',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Comment: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,not shown',
    'Dialogue: 0,0:00:01.50,0:00:03.00,Default,,0,0,0,,{\\i1}Hello,{\\i0} world\\Nsecond line',
    'Dialogue: 0,0:00:02.00,0:00:04.00,Sign,,0,0,0,,{\\pos(10,10)}A sign',
    'Dialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,{\\p1}m 0 0 l 10 10{\\p0}',
  ].join('\n')

  it('reads dialogue as plain text, commas and line breaks kept, drawings dropped', () => {
    expect(parseSubtitle(ass, 'ass')).toEqual([
      { start: 1.5, end: 3, text: 'Hello, world\nsecond line' },
      { start: 2, end: 4, text: 'A sign' },
    ])
  })

  it('follows the Format line when fields come in another order', () => {
    const ssa = [
      '[Events]',
      'Format: Marked, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: Marked=0,0:00:01.00,0:00:02.00,Default,NTP,0000,0000,0000,!Effect,Hi\\hthere',
    ].join('\n')
    expect(parseSubtitle(ssa, 'ssa')).toEqual([{ start: 1, end: 2, text: 'Hi there' }])
  })

  it('reads text alone', () => {
    expect(assText('{\\an8}Top{\\b1} bold\\nnext')).toBe('Top bold\nnext')
  })
})

describe('what shows at a time', () => {
  const track = new CueTrack([
    { start: 1, end: 3, text: 'A' },
    { start: 2, end: 4, text: 'B' },
    { start: 10, end: 11, text: 'C' },
    { start: 0, end: 30, text: 'Long' },
  ])

  it('joins lines that overlap, in start order', () => {
    expect(track.textAt(0.5)).toBe('Long')
    expect(track.textAt(2.5)).toBe('Long\nA\nB')
    expect(track.textAt(3)).toBe('Long\nB')
    expect(track.textAt(10.5)).toBe('Long\nC')
    expect(track.textAt(40)).toBeNull()
    expect(new CueTrack([]).textAt(1)).toBeNull()
  })
})
