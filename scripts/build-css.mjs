// Builds dist/style.css: the player's small reset (src/styles/base.css), then its Tailwind
// utilities and tokens (src/styles/player.css), all prefixed so nothing reaches the page.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

mkdirSync('dist', { recursive: true })
const tmp = 'dist/.utilities.css'
execFileSync(
  process.execPath,
  [
    'node_modules/@tailwindcss/cli/dist/index.mjs',
    '-i',
    'src/styles/player.css',
    '-o',
    tmp,
    '--minify',
  ],
  { stdio: 'inherit' },
)
const banner =
  '/*! @roshan-here/web-media-player | MIT License | Copyright (c) 2026 Roshan-Here | https://github.com/Roshan-Here/Web-Media-Player */\n'
const base = readFileSync('src/styles/base.css', 'utf8')
writeFileSync('dist/style.css', banner + base + '\n' + readFileSync(tmp, 'utf8'))
rmSync(tmp)
console.log(`dist/style.css: ${(readFileSync('dist/style.css').length / 1024).toFixed(1)} KB`)
