// Checks that every `mp:` class in the components has a rule in the built stylesheet, so a
// typo in a class name (which Tailwind skips without a word) fails the build instead.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(process.argv[2] ?? 'dist/style.css', 'utf8')
const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (/\.tsx?$/.test(entry.name)) files.push(path)
  }
}
walk('src')
// Tailwind escapes every character outside [a-zA-Z0-9_-] in a class selector.
const escape = (cls) => cls.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
// Classes that only name something for others to refer to (groups, containers), with no rule.
const markers = /^mp:(group(\/\w+)?)$/
const missing = new Set()
for (const file of files) {
  for (const cls of readFileSync(file, 'utf8').match(/mp:[^\s'"`]+/g) ?? []) {
    if (markers.test(cls)) continue
    if (!css.includes(`.${escape(cls)}`)) missing.add(`${cls}  (${file})`)
  }
}
if (missing.size) {
  console.error(`No CSS rule for ${missing.size} class(es):\n  ${[...missing].join('\n  ')}`)
  process.exit(1)
}
console.log('Every class has a rule.')
