/*
 * Writes the demo's Blu-ray (PGS) subtitle track: a light bar with a dark edge where each line
 * of the English subtitles is, as a stand-in for the pictures of words a Blu-ray carries. Run
 * by `npm run fixtures` (Node 22.6 or later); the player recolours, resizes and lifts it.
 */
import { writeFileSync } from 'node:fs'
import { boxPixels, writeSup, type PgsDisplaySetSpec } from './pgs-writer.ts'

const WIDTH = 1920
const HEIGHT = 1080
const palette = new Map([
  [0, { r: 0, g: 0, b: 0, a: 0 }],
  [1, { r: 245, g: 245, b: 245, a: 255 }],
  [2, { r: 16, g: 16, b: 16, a: 255 }],
])
// When the English lines are on screen (see fixtures.sh), and how wide each is.
const LINES: Array<[number, number, number]> = [
  [1, 5.5, 820],
  [6, 11, 760],
  [41, 47, 900],
  [48, 54, 640],
  [86, 92, 960],
  [93, 100, 1000],
  [120, 127, 880],
]
const sets: PgsDisplaySetSpec[] = []
let n = 0
for (const [start, end, width] of LINES) {
  const height = 64
  sets.push({
    time: start,
    width: WIDTH,
    height: HEIGHT,
    compositionNumber: n++,
    palette,
    objects: [
      {
        x: Math.round((WIDTH - width) / 2),
        y: HEIGHT - 150,
        width,
        height,
        pixels: boxPixels(width, height, 1, 2),
      },
    ],
  })
  sets.push({
    time: end,
    width: WIDTH,
    height: HEIGHT,
    compositionNumber: n++,
    palette,
    objects: [],
  })
}
writeFileSync(process.argv[2] ?? 'picture-subs.sup', writeSup(sets))
