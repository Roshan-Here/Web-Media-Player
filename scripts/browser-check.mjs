// Plays the demo film in headless Chromium and checks what a viewer would: the picture moves,
// tracks and chapters are listed, subtitles (the file's own and a subtitle file) show, "Skip
// opening" skips, keyboard shortcuts work, the browser decoder plays the MP4, the miniplayer
// keeps the same playback, a missing file shows the error panel, and the page's own CSS does
// not reach inside the player.
//
//   npm run fixtures && npm run test:browser      (needs `npx playwright install chromium`)
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({
  root: 'examples/demo',
  configFile: 'examples/demo/vite.config.ts',
  server: { port: 5298, strictPort: true },
  logLevel: 'error',
})
await server.listen()
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
let failures = 0
const check = (ok, what) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${what}`)
  if (!ok) failures++
}
const settle = (promise) =>
  promise.then(
    () => true,
    () => false,
  )

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  // A page with heavy-handed styles of its own, which must not reach inside the player.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent =
        'button { padding: 40px; background: red; font-size: 30px; } .flex { display: none; } h2 { font-size: 80px; }'
      document.head.append(style)
    })
  })
  await page.goto('http://localhost:5298/')
  const at = (time, timeout = 60_000) =>
    settle(
      page.waitForFunction((t) => (window.player.current?.media?.currentTime ?? 0) >= t, time, {
        timeout,
      }),
    )
  const wake = async () => {
    const box = await page.locator('.mp-root').boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3)
    await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 3)
  }

  console.log('Built-in decoder, HEVC + AC-3 Matroska')
  check(await at(2), 'plays')
  await wake()
  await page.getByRole('button', { name: 'Audio track', exact: true }).click()
  const audio = await page.getByRole('menuitemradio').allInnerTexts()
  check(
    audio.length === 2,
    `lists the audio tracks: ${audio.map((a) => a.replace(/\n/g, ' ')).join(', ')}`,
  )
  await page.keyboard.press('Escape')
  const chapters = await page.locator('[data-seek-part]').count()
  check(chapters === 5, `draws the timeline in chapters (${chapters})`)

  await wake()
  await page.getByRole('button', { name: 'Subtitles', exact: true }).click()
  const subtitleChoices = await page.getByRole('menuitemradio').allInnerTexts()
  check(
    subtitleChoices.some((s) => s.startsWith('English')) &&
      subtitleChoices.some((s) => s.startsWith('Français')),
    'lists the file’s subtitles and the subtitle file',
  )
  await page.getByRole('menuitemradio', { name: /^Français/ }).click()
  await page.evaluate(() => window.player.current.seekTo(41))
  const french = await settle(
    page.waitForFunction(
      () => document.querySelector('[data-player-caption]')?.textContent?.includes('vallée'),
      null,
      { timeout: 20_000 },
    ),
  )
  check(french, 'shows a line from the subtitle file')

  await page.keyboard.press('c')
  await page.waitForTimeout(400)
  check((await page.locator('[data-player-caption]').count()) === 0, 'C turns subtitles off')
  await page.keyboard.press('c')
  const back = await settle(page.waitForSelector('[data-player-caption]', { timeout: 10_000 }))
  check(back, 'C turns them back on')

  await page.evaluate(() => window.player.current.seekTo(14))
  const pill = await settle(
    page.waitForSelector('[data-skip="opening"]:not([aria-hidden])', { timeout: 20_000 }),
  )
  check(pill, 'offers "Skip opening" from the chapter named Opening')
  await page.keyboard.press('s')
  check(await at(39.5, 20_000), 'S skips to the end of the opening')

  const before = await page.evaluate(() => window.player.current.media.currentTime)
  await page.keyboard.press('l')
  check(await at(before + 9, 20_000), 'L goes forward 10 seconds')

  // The page's CSS stays out.
  const button = page.getByRole('button', { name: 'Audio track', exact: true })
  const padding = await button.evaluate((el) => getComputedStyle(el).paddingTop)
  const bg = await button.evaluate((el) => getComputedStyle(el).backgroundColor)
  check(
    padding !== '40px' && bg !== 'rgb(255, 0, 0)',
    `the page’s button styles stay out (padding ${padding})`,
  )

  console.log('Miniplayer')
  const engineBefore = await page.evaluate(
    () => (window.__engine = window.player.current.engine) !== null,
  )
  await page.getByRole('button', { name: 'Dock as miniplayer' }).click()
  await page.waitForTimeout(800)
  const same = await page.evaluate(() => window.player.current.engine === window.__engine)
  const mini = await page.locator('.mp-root[data-layout="mini"]').count()
  check(engineBefore && same && mini === 1, 'docks without restarting playback')
  await page.getByRole('button', { name: 'Back to the page player' }).click()

  console.log('Browser decoder, H.264 MP4')
  await page.evaluate(() => window.player.current.seekTo(140))
  await settle(page.waitForSelector('[data-up-next]', { timeout: 20_000 }))
  check(
    (await page.locator('[data-up-next]').count()) === 1,
    'offers the next episode near the end',
  )
  await page.getByRole('button', { name: 'Play now' }).click()
  await page.waitForTimeout(500)
  check(await at(1), 'plays the next episode')
  await wake()
  await page.getByRole('button', { name: 'Playback settings' }).click()
  await page.getByRole('menuitemradio', { name: /^Browser/ }).click()
  await page.waitForTimeout(1500)
  const kind = await page.evaluate(() => window.player.current.engine?.kind)
  check(kind === 'browser', 'switches to the browser decoder')
  check(await at(2), 'the browser decoder plays')

  console.log('Errors')
  await page.getByPlaceholder(/video URL/).fill(new URL('/media/missing.mkv', page.url()).href)
  await page.getByRole('button', { name: 'Play URL' }).click()
  const alert = await settle(page.waitForSelector('[role="alert"]', { timeout: 20_000 }))
  check(alert, 'a missing file shows the error panel')
  check(errors.length === 0, `no uncaught errors${errors.length ? `: ${errors.join('; ')}` : ''}`)
} finally {
  await browser.close()
  await server.close()
}
if (failures) {
  console.error(`${failures} check(s) failed`)
  process.exit(1)
}
console.log('All browser checks passed')
