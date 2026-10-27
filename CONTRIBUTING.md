# Contributing

Thank you for helping. Bug reports, fixes, translations and new features are all welcome.

## Setting up

```sh
npm install
npm run check          # types, class prefixes, formatting, unit tests and the build
```

To work on the player in a browser:

```sh
npm run fixtures       # makes the demo film (needs ffmpeg with libx265)
npm run demo           # the demo page, on the package's own source
```

And to run the browser checks headless (once, `npx playwright install chromium`):

```sh
npm run test:browser
```

### Before Web-Buildin-decoder is on npm

The player depends on [Web-Buildin-decoder](https://github.com/Roshan-Here/Web-Buildin-decoder).
Until it is published, install it from a copy next to this one (and keep that change out of
commits):

```sh
(cd ../Web-Buildin-decoder && npm install && npm run build)
npm install ../Web-Buildin-decoder
```

## Styling

The components use Tailwind CSS classes with the `mp:` prefix (`mp:flex`, `mp:hover:bg-ink/12`),
so the built stylesheet never touches the page around the player. Write classes inside
`className` or `cx(...)`. If you write them without the prefix, `npm run prefix` adds it;
`npm run check` fails on any class that is missing it, and `npm run build:css` fails on any
class that produced no CSS (usually a typo).

## Screenshots

The README's images come from `npm run screenshots`. Run it again when a change alters how the
player looks, and commit the updated `docs/images`.

## Pull requests

- Keep changes focused, and add or update tests in `test/` for behaviour you change.
- Run `npm run check` (and `npm run test:browser` for player changes) before opening one.
- Describe what changed and why; link the issue if there is one.
- By contributing you agree that your contribution is licensed under the MIT License of
  this project.

## Reporting a bug

Please include the browser and system, the file's container and codecs (`ffprobe` output is
ideal), and the diagnostics the error panel's **Copy details** button copies (or
`ref.current.diagnostics()`).

## Releasing

Releases are published to npm by GitHub Actions (`.github/workflows/release.yml`) when a GitHub
Release is published, through npm trusted publishing: no npm token is stored anywhere.

1. Add the changes under a new version heading in `CHANGELOG.md`.
2. Bump the version, which commits and tags it (`patch` for fixes, `minor` for new features,
   `major` for breaking changes), and push:

   ```sh
   npm version patch
   git push --follow-tags
   ```

3. On GitHub, open **Releases → Draft a new release**, choose the new tag (`v0.1.1`), paste the
   changelog entry and press **Publish release**. The workflow checks that the tag matches
   `package.json`, runs the full check and publishes.
