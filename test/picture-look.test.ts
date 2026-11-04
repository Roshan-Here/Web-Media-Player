import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE, type SubtitleStyle } from '../src/lib/subtitle-style.js'
import type { PictureFrame, SubPicture } from 'web-buildin-decoder'
import {
  asFiled,
  boxOf,
  inColour,
  isPlainText,
  placePictures,
  sizeScale,
} from '../src/lib/picture-look.js'

const look = (change: Partial<SubtitleStyle>): SubtitleStyle => ({ ...DEFAULT_STYLE, ...change })

/** A picture filled with one colour, with an [edge]-pixel dark border round it. */
function picture(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: [number, number, number] = [255, 255, 255],
  edge = 2,
): SubPicture {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let row = 0; row < height; row++)
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4
      const border = row < edge || col < edge || row >= height - edge || col >= width - edge
      const [r, g, b] = border ? [16, 16, 16] : fill
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = 255
    }
  return { x, y, width, height, rgba }
}

const frameOf = (...pictures: SubPicture[]): PictureFrame => ({
  canvasWidth: 1920,
  canvasHeight: 1080,
  pictures,
})

describe('picture subtitle look', () => {
  it('draws the default look exactly as the file has it', () => {
    expect(asFiled(DEFAULT_STYLE)).toBe(true)
    // The typeface, weight and edge cannot change a picture, so they leave it as filed too.
    expect(asFiled(look({ font: 'serif', bold: true, edge: 'shadow' }))).toBe(true)
    expect(asFiled(look({ size: 'large' }))).toBe(false)
    expect(asFiled(look({ position: 'raised' }))).toBe(false)
    expect(asFiled(look({ box: true }))).toBe(false)
    expect(asFiled(look({ color: 'yellow' }))).toBe(false)
    expect(sizeScale(look({ size: 'xlarge' }))).toBe(1.55)
  })

  it('grows the dialogue from its bottom centre, and moves it up with the position', () => {
    const line = picture(760, 940, 400, 80)
    const [big] = placePictures(frameOf(line), look({ size: 'large' }))
    expect(big!.scale).toBe(1.25)
    // Centre stays at 960; the bottom stays at 1020.
    expect(big!.x + (400 * 1.25) / 2).toBeCloseTo(960, 6)
    expect(big!.y + 80 * 1.25).toBeCloseTo(1020, 6)

    const [raised] = placePictures(frameOf(line), look({ position: 'raised' }))
    // Raised is 7% of the height above Bottom: 75.6 px of 1080.
    expect(raised!.y).toBeCloseTo(940 - 75.6, 6)
    expect(raised!.x).toBe(760)
  })

  it('keeps two lines together, and leaves a sign at the top where the file put it', () => {
    const first = picture(800, 880, 320, 60)
    const second = picture(700, 950, 520, 60)
    const sign = picture(100, 40, 300, 50)
    const placed = placePictures(
      frameOf(first, second, sign),
      look({ size: 'large', position: 'high' }),
    )
    const top = placed.find((p) => p.picture === sign)!
    // Grown from its top centre, not moved by the position.
    expect(top.y).toBeCloseTo(40, 6)
    expect(top.x + (300 * 1.25) / 2).toBeCloseTo(250, 6)
    const a = placed.find((p) => p.picture === first)!
    const b = placed.find((p) => p.picture === second)!
    // The gap between the lines grows with them, so they never overlap.
    expect(b.y - (a.y + 60 * 1.25)).toBeCloseTo(10 * 1.25, 6)
  })

  it('keeps a big picture inside the canvas', () => {
    const wide = picture(20, 1000, 1880, 70)
    const [placed] = placePictures(frameOf(wide), look({ size: 'xlarge' }))
    // 1880 × 1.55 is wider than the canvas: centred on it instead of cut off at one side.
    expect(placed!.x + (1880 * 1.55) / 2).toBeCloseTo(960, 6)
    const low = picture(1700, 1040, 200, 40)
    const [moved] = placePictures(frameOf(low), look({ size: 'xlarge' }))
    expect(moved!.x + 200 * 1.55).toBeLessThanOrEqual(1920 + 1e-6)
    expect(moved!.y + 40 * 1.55).toBeLessThanOrEqual(1080 + 1e-6)
  })

  it('puts the box a little round the picture', () => {
    const [placed] = placePictures(frameOf(picture(760, 940, 400, 80)), look({ box: true }))
    const b = boxOf(placed!, frameOf())
    expect(b.x).toBeLessThan(760)
    expect(b.x + b.width).toBeGreaterThan(1160)
    expect(b.y).toBeLessThan(940)
    expect(b.y + b.height).toBeGreaterThan(1020)
  })

  it('recolours plain white text and keeps its dark edge', () => {
    const plain = picture(0, 0, 40, 20)
    expect(isPlainText(plain)).toBe(true)
    const yellow = inColour(plain, 'yellow')
    expect(yellow).not.toBe(plain)
    // The middle: #ffe14d.
    const middle = (10 * 40 + 20) * 4
    expect([...yellow.rgba.slice(middle, middle + 4)]).toEqual([255, 225, 77, 255])
    // The edge stays dark.
    expect([...yellow.rgba.slice(0, 4)]).toEqual([16, 16, 16, 255])
    // Made once.
    expect(inColour(plain, 'yellow')).toBe(yellow)
    expect(inColour(plain, 'white')).toBe(plain)
  })

  it('leaves coloured pictures, signs and karaoke their own colours', () => {
    const coloured = picture(0, 0, 40, 20, [240, 200, 40])
    expect(isPlainText(coloured)).toBe(false)
    expect(inColour(coloured, 'cyan')).toBe(coloured)
    const empty: SubPicture = { x: 0, y: 0, width: 4, height: 4, rgba: new Uint8ClampedArray(64) }
    expect(isPlainText(empty)).toBe(false)
  })
})
