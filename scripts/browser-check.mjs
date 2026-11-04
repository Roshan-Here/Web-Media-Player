// Plays the demo film in headless Chromium and checks what a viewer would: the picture moves,
// tracks and chapters are listed, subtitles (the file's own and a subtitle file) show, "Skip
// opening" skips, keyboard shortcuts work, the browser decoder plays the MP4, the miniplayer
// keeps the same playback, a missing file shows the error panel, and the page's own CSS does
// not reach inside the player; the read ahead shows on the timeline, the subtitle panels move,
// full screen carries on into the next episode, the Episodes panel plays an episode, Blu-ray
// (PGS) subtitles are drawn, and the paused screen comes and goes.
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
  const ahead = await page.evaluate(() => {
    const m = window.player.current.media
    return m.buffered.length > 0 ? m.buffered.end(m.buffered.length - 1) - m.currentTime : 0
  })
  check(ahead > 20, `shows what is loaded ahead on the timeline (${ahead.toFixed(0)} s)`)
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

  // Search online, through the demo's stand-in service.
  await wake()
  await page.getByRole('button', { name: 'Subtitles', exact: true }).click()
  await page.locator('[role^="menuitem"]', { hasText: 'Search online' }).click()
  const listed = await settle(
    page.waitForSelector('[data-online-subtitles] li button', { timeout: 10_000 }),
  )
  check(listed, 'Search online lists what the service found')
  await page
    .locator('[data-online-subtitles] li button', { hasText: 'Northern.Lights.2026.Spanish' })
    .click()
  const closed = await settle(
    page.waitForSelector('[data-online-subtitles]', { state: 'detached', timeout: 10_000 }),
  )
  await page.evaluate(() => window.player.current.seekTo(41))
  const spanish = await settle(
    page.waitForFunction(
      () => document.querySelector('[data-player-caption]')?.textContent?.includes('valle.'),
      null,
      { timeout: 20_000 },
    ),
  )
  check(closed && spanish, 'shows the subtitle chosen online')
  await wake()
  await page.getByRole('button', { name: 'Subtitles', exact: true }).click()
  const checked = await page.locator('[role="menuitemradio"][aria-checked="true"]').allInnerTexts()
  check(
    checked.some((s) => s.includes('ES · Demo')),
    'checks the online subtitle in the menu',
  )
  await page.getByRole('menuitemradio', { name: /^Français/ }).click()
  const swapped = await settle(
    page.waitForFunction(
      () => document.querySelector('[data-player-caption]')?.textContent?.includes('vallée'),
      null,
      { timeout: 20_000 },
    ),
  )
  check(swapped, 'a track chosen instead puts the online subtitle away')

  // The page's CSS stays out.
  const button = page.getByRole('button', { name: 'Audio track', exact: true })
  const padding = await button.evaluate((el) => getComputedStyle(el).paddingTop)
  const bg = await button.evaluate((el) => getComputedStyle(el).backgroundColor)
  check(
    padding !== '40px' && bg !== 'rgb(255, 0, 0)',
    `the page’s button styles stay out (padding ${padding})`,
  )

  console.log('Panels')
  await wake()
  await page.getByRole('button', { name: 'Subtitles', exact: true }).click()
  await page.getByRole('menuitemradio', { name: /Look and timing/ }).click()
  const look = page.getByRole('dialog', { name: 'Subtitle look and timing' })
  const lookAt = await look.boundingBox()
  const bar = await look.locator('[data-panel-handle]').boundingBox()
  await page.mouse.move(bar.x + 40, bar.y + 10)
  await page.mouse.down()
  await page.mouse.move(bar.x - 260, bar.y + 10, { steps: 6 })
  await page.mouse.up()
  const after = await look.boundingBox()
  check(Math.abs(after.x - (lookAt.x - 300)) < 2, 'the look panel moves by its title bar')
  await look.locator('[data-panel-handle] h2').dblclick()
  await page.keyboard.press('Escape')

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
  await wake()
  await page.getByRole('button', { name: 'Full screen', exact: true }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Play now' }).click()
  await page.waitForTimeout(500)
  check(await at(1), 'plays the next episode')
  const stillFull = await page.evaluate(
    () => document.fullscreenElement?.classList.contains('mp-root') ?? false,
  )
  check(stillFull, 'stays in full screen into the next episode')
  await page.evaluate(() => document.exitFullscreen())
  await wake()
  await page.getByRole('button', { name: 'Playback settings' }).click()
  await page.getByRole('menuitemradio', { name: /^Browser/ }).click()
  await page.waitForTimeout(1500)
  const kind = await page.evaluate(() => window.player.current.engine?.kind)
  check(kind === 'browser', 'switches to the browser decoder')
  check(await at(2), 'the browser decoder plays')

  console.log('Episodes, Blu-ray subtitles')
  // Back to the built-in decoder, which draws picture subtitles.
  if ((await page.locator('[role="alert"]').count()) > 0)
    await page
      .locator('[role="alert"]')
      .getByRole('button', { name: /built-in/i })
      .click()
  else {
    await wake()
    await page.getByRole('button', { name: 'Playback settings' }).click()
    await page.getByRole('menuitemradio', { name: /^Built-in/ }).click()
  }
  await page.waitForTimeout(1500)
  await wake()
  await page.getByRole('button', { name: 'Episodes', exact: true }).click()
  const list = page.getByRole('dialog', { name: 'Episodes of Northern Lights' })
  const rows = await list.locator('li').count()
  const current = await list.locator('li[data-current]').getAttribute('data-open')
  check(rows === 3 && current === '', 'lists the episodes, the one playing opened up')
  await list.getByRole('button', { name: /The Ridge/ }).click()
  await list.getByRole('button', { name: 'Play episode 3, The Ridge' }).click()
  check(await at(1.5), 'plays the episode chosen there')
  await page.evaluate(() => window.player.current.seekTo(41.5))
  await wake()
  await page.getByRole('button', { name: 'Subtitles', exact: true }).click()
  await page.getByRole('menuitemradio', { name: /Blu-ray/ }).click()
  const drawn = await settle(
    page.waitForFunction(
      () => {
        const canvas = document.querySelector('[data-player-picture-subtitle]')
        if (!canvas || canvas.width !== 1920) return false
        const [r, g, b, a] = canvas.getContext('2d').getImageData(960, 960, 1, 1).data
        return r > 200 && g > 200 && b > 200 && a > 200
      },
      null,
      { timeout: 20_000 },
    ),
  )
  check(drawn, 'draws Blu-ray (PGS) subtitles as pictures')
  await wake()
  await page.getByRole('button', { name: 'Subtitles', exact: true }).click()
  await page.getByRole('menuitemradio', { name: /Look and timing/ }).click()
  const note = await page.locator('[data-subtitle-picture-note]').count()
  check(note === 1, 'the look panel says what a picture subtitle can take')
  await page.keyboard.press('Escape')

  console.log('Paused screen')
  const paused = await browser.newPage({ viewport: { width: 1280, height: 860 } })
  paused.on('pageerror', (error) => errors.push(error.message))
  await paused.goto('http://localhost:5298/?pausedAfter=2')
  await settle(
    paused.waitForFunction(() => (window.player.current?.media?.currentTime ?? 0) >= 2, null, {
      timeout: 60_000,
    }),
  )
  const box = await paused.locator('.mp-root').boundingBox()
  await paused.mouse.move(box.x + 200, box.y + 200)
  await paused.keyboard.press('k')
  const shown = await settle(paused.waitForSelector('[data-paused-info]', { timeout: 6000 }))
  const words = shown ? await paused.locator('[data-paused-info]').innerText() : ''
  check(
    shown && words.includes('Northern Lights') && words.includes('Paused'),
    'left paused, shows what is being watched',
  )
  await paused.mouse.move(box.x + 260, box.y + 240)
  await paused.waitForTimeout(400)
  check((await paused.locator('[data-paused-info]').count()) === 1, 'stays when the pointer moves')
  await paused.keyboard.press(' ')
  await paused.waitForTimeout(400)
  check((await paused.locator('[data-paused-info]').count()) === 0, 'goes when it plays again')
  await paused.close()

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
