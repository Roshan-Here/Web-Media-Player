// Captures the README's screenshots from the demo, in headless Chromium.
//
//   npm run fixtures      # once: the demo film
//   npm run screenshots   # writes docs/images/*.jpg
//
// Needs `npx playwright install chromium` once.
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const OUT = 'docs/images'
mkdirSync(OUT, { recursive: true })

const server = await createServer({
  root: 'examples/demo',
  configFile: 'examples/demo/vite.config.ts',
  server: { port: 5299, strictPort: true },
  logLevel: 'error',
})
await server.listen()
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const player = page.locator('.mp-root').first()
const spinning = () =>
  page.evaluate(() => !!document.querySelector('.mp-root [role="status"][aria-label="Loading"]'))
const shot = async (name, target = player, before = async () => {}) => {
  // Headless Chromium decodes HEVC in software and now and then waits for frames: a picture
  // that caught the loading spinner is taken again once playback has caught up.
  for (let attempt = 0; attempt < 8; attempt++) {
    await page
      .waitForFunction(
        () => !document.querySelector('.mp-root [role="status"][aria-label="Loading"]'),
        null,
        { timeout: 10_000 },
      )
      .catch(() => undefined)
    // Brings the controls back if they faded while waiting.
    await before()
    await target.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 88 })
    if (!(await spinning())) break
    await page.waitForTimeout(400)
  }
  console.log(`  ${name}.jpg`)
}
const wake = async () => {
  const box = await player.boundingBox()
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.42)
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.4)
}
const seek = (time) => page.evaluate((t) => window.player.current.seekTo(t), time)
const at = (time) =>
  page.waitForFunction((t) => (window.player.current?.media?.currentTime ?? 0) >= t, time, {
    timeout: 60_000,
  })
const openMenu = async (label) => {
  await wake()
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.waitForTimeout(350)
}
const closeMenu = async () => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
}

try {
  // The pre-roll while the film opens: the film is held back a moment so it stays up.
  let holding = true
  await page.route('**/media/northern-lights.mkv', async (route) => {
    if (holding) await new Promise((resolve) => setTimeout(resolve, 2500))
    await route.continue()
  })
  await page.goto('http://localhost:5299/')
  await page.waitForSelector('[data-player-loader]')
  await page.waitForTimeout(1600)
  await shot('loader')
  holding = false

  await at(1)
  // English subtitles, from the file itself.
  await openMenu('Subtitles')
  await page.getByRole('menuitemradio', { name: /^English/ }).click()

  // Playing, with subtitles and the controls showing: tried again until a moment with a line
  // on screen and no buffering.
  for (let attempt = 0; attempt < 6; attempt++) {
    await seek(47.5)
    await at(49)
    await wake()
    await page.waitForTimeout(250)
    const caption = await page.locator('[data-player-caption]').count()
    if (caption && !(await spinning())) break
  }
  await shot('player')

  // The menus, between two lines of dialogue.
  await seek(57)
  await at(58.5)
  await openMenu('Subtitles')
  await shot('subtitles-menu')
  await closeMenu()
  await openMenu('Audio track')
  await shot('audio-menu')
  await closeMenu()
  await openMenu('Playback settings')
  await shot('settings-menu')
  await closeMenu()
  await wake()
  await page.getByRole('button', { name: /^Chapter:/ }).click()
  await page.waitForTimeout(350)
  await shot('chapters-menu')
  await closeMenu()

  // The timeline: chapters, and a preview of the scene under the pointer.
  await page.evaluate(() => document.activeElement?.blur())
  const bar = await page.getByRole('slider', { name: 'Seek' }).boundingBox()
  await page.mouse.move(bar.x + bar.width * 0.2, bar.y + bar.height / 2)
  await page.mouse.move(bar.x + bar.width * 0.66, bar.y + bar.height / 2, { steps: 8 })
  for (let i = 0; i < 40; i++) {
    if (await page.locator('[data-seek-preview] img').count()) break
    // Small moves keep the controls up while the still is made.
    await page.mouse.move(bar.x + bar.width * 0.66 + (i % 2), bar.y + bar.height / 2)
    await page.waitForTimeout(500)
  }
  const hover = async () => {
    await page.mouse.move(bar.x + bar.width * 0.66 + 1, bar.y + bar.height / 2)
    await page.mouse.move(bar.x + bar.width * 0.66, bar.y + bar.height / 2)
    await page.waitForTimeout(300)
  }
  await hover()
  await shot('timeline-preview', player, hover)

  // The subtitle look panel, with a look changed so the caption behind shows it.
  await seek(86.5)
  await at(87.5)
  await openMenu('Subtitles')
  await page.getByRole('menuitemradio', { name: /^Look and timing/ }).click()
  await page.getByRole('radio', { name: 'Yellow' }).click()
  await page.getByRole('radio', { name: 'Dark box' }).click()
  await page.waitForTimeout(300)
  await shot('subtitle-style')
  await page.getByRole('button', { name: 'Back to the default look' }).click()
  await page.getByRole('button', { name: 'Close' }).first().click()

  // "Skip opening", from the file's chapter named Opening.
  await seek(15)
  await at(16)
  await page.waitForSelector('[data-skip]:not([aria-hidden])')
  await page.mouse.move(5, 5)
  await page.waitForTimeout(3300)
  await shot('skip-intro')

  // The next episode, offered as the ending begins.
  await seek(129)
  await at(131)
  await page.waitForSelector('[data-up-next]')
  await page.mouse.move(5, 5)
  await page.waitForTimeout(3300)
  await shot('up-next')

  // The miniplayer, docked while the page is browsed.
  await page.getByRole('button', { name: 'Hide' }).click()
  await seek(60)
  await page.getByRole('button', { name: 'Dock as miniplayer' }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(1200)
  await page.mouse.move(1100, 700)
  await page.waitForTimeout(300)
  await shot('miniplayer', page)
} finally {
  await browser.close()
  await server.close()
}
