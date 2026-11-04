import { describe, expect, it } from 'vitest'
import { liftAbove, pictureRect } from '../src/components/PictureSubtitles.js'

const frame = (y: number, height: number) => ({
  canvasWidth: 1920,
  canvasHeight: 1080,
  pictures: [{ x: 0, y, width: 10, height, rgba: new Uint8ClampedArray(10 * height * 4) }],
})

describe('PictureSubtitles', () => {
  it('fits the video into the player whole, centred, as the decoder draws it', () => {
    const square = pictureRect({ width: 1000, height: 1000 }, 1920, 1080)
    expect(square.x).toBeCloseTo(0, 6)
    expect(square.y).toBeCloseTo(218.75, 6)
    expect(square.width).toBeCloseTo(1000, 6)
    expect(square.height).toBeCloseTo(562.5, 6)
    expect(pictureRect({ width: 1600, height: 900 }, 720, 576)).toEqual({
      x: 237.5,
      y: 0,
      width: 1125,
      height: 900,
    })
  })

  it('moves low subtitles up over the controls, and leaves high ones where they are', () => {
    const box = { width: 1600, height: 900 }
    const rect = pictureRect(box, 1920, 1080)
    // A line at the very bottom: 900 px down; the controls and 2% take the last 114 px.
    expect(liftAbove(frame(1000, 80), rect, box)).toBe(114)
    expect(liftAbove(frame(100, 80), rect, box)).toBe(0)
    expect(liftAbove({ ...frame(0, 1), pictures: [] }, rect, box)).toBe(0)
  })
})
