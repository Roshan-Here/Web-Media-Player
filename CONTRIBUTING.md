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

### Working on the decoder at the same time

The player depends on [Web-Buildin-decoder](https://github.com/Roshan-Here/Web-Buildin-decoder).
To try a change in it before it is released, install it from a copy next to this one (and keep
that change out of commits):

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

Releasing is a version bump pushed to `master`; GitHub Actions does the rest. When CI passes on
a push and `package.json` holds a version that is not on npm yet, `.github/workflows/release.yml`
publishes it (npm trusted publishing: no npm token is stored anywhere, and npm adds a provenance
statement), tags the commit `v<version>`, and makes the GitHub Release from that version's
`CHANGELOG.md` entry. A push that leaves the version alone publishes nothing.

1. Add the changes under a new version heading in `CHANGELOG.md` (`## [0.2.1] - date`, and its
   link at the bottom).
2. Bump the version without a local tag (the workflow makes the tag; `patch` for fixes,
   `minor` for new features, `major` for breaking changes), commit and push:

   ```sh
   npm version patch --no-git-tag-version
   git commit -am "Release 0.2.1"
   git push
   ```

3. Watch **Actions**: CI runs, then Release publishes. To retry a failed release, open
   **Actions → Release → Run workflow**.

Don't publish from your own computer: the version would be on npm without its tag, GitHub
Release or the message to the projects built on it, and the workflow would then skip it.

One-time setup on npmjs.com, already done: the package's **Settings → Trusted publishing**
names this repository and the workflow file `release.yml`.

### Telling the projects built on it

After publishing, the release workflow tells the projects built on this package that a new
version is out, and each opens its own update: TMPlayer-web moves to it (its "Update player
libraries" workflow). They also look once a day on their own, so this only makes it immediate.
It needs one secret here, under **Settings → Secrets and variables → Actions**:
`DISPATCH_TOKEN`, a fine-grained personal access token with **Contents: read and write** on
Roshan-Here/Tmplayer-web. Without it the step only notes that no one was told.

### New decoder releases

`.github/workflows/update-decoder.yml` moves the player to each new Web-Buildin-decoder release:
it opens a pull request, runs the full check and the browser check, and merges it when they
pass. A decoder the player's range already accepts (0.2.0 to 0.2.1) changes only the lockfile,
since apps get it through the range. One outside it (0.2 to 0.3) needs a player release before
apps using both can take it, so the update also bumps the player's patch version with a
CHANGELOG entry and starts Release once it is merged. It needs, once, under **Settings →
Actions → General**: "Read and write permissions" and "Allow GitHub Actions to create and
approve pull requests".
