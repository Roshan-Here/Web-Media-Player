import { describe, expect, it } from 'vitest'
import { clampOffset } from '../src/hooks/useDragPanel.js'

const bounds = { left: 0, top: 0, width: 1000, height: 600 }
// At top right, as the panel opens: 400 wide, 300 high.
const panel = { left: 588, top: 12, width: 400, height: 300 }

describe('a panel moved over the picture', () => {
  it('goes where it is dragged', () => {
    expect(clampOffset({ x: -300, y: 100 }, panel, bounds)).toEqual({ x: -300, y: 100 })
  })

  it('stays inside the player, a little in from its edges', () => {
    expect(clampOffset({ x: 200, y: -50 }, panel, bounds)).toEqual({ x: 4, y: -4 })
    expect(clampOffset({ x: -2000, y: 2000 }, panel, bounds)).toEqual({ x: -580, y: 280 })
  })

  it('keeps to the top left when the player is smaller than the panel', () => {
    const small = { left: 0, top: 0, width: 300, height: 200 }
    expect(clampOffset({ x: 50, y: 50 }, { ...panel, left: 8, top: 8 }, small)).toEqual({
      x: 0,
      y: 0,
    })
  })
})
