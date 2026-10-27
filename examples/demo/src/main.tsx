import { StrictMode, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Player,
  createStillWatching,
  type PlayerHandle,
  type PlayerSource,
  type SubtitleFile,
  type UpNext,
} from '@roshan-here/web-media-player'
import '@roshan-here/web-media-player/style.css'
import './demo.css'

const stillWatching = createStillWatching()

interface Episode {
  source: PlayerSource
  title: string
  line: string
}

const EPISODES: Episode[] = [
  {
    source: { url: '/media/northern-lights.mkv', key: 'northern-lights-1' },
    title: 'Northern Lights',
    line: 'Episode 1 · HEVC with AC-3 and AAC, two subtitle tracks, chapters',
  },
  {
    source: { url: '/media/northern-lights.mp4', key: 'northern-lights-2' },
    title: 'Northern Lights',
    line: 'Episode 2 · H.264 and AAC in MP4',
  },
]

const SUBTITLES: SubtitleFile[] = [{ label: 'Français', language: 'fr', src: '/media/fr.vtt' }]

const ACCENTS = ['#f2b33d', '#4cc9f0', '#80ed99', '#ff6b9a', '#b392f0']

function Demo() {
  const [episode, setEpisode] = useState(0)
  const [custom, setCustom] = useState<Episode | null>(null)
  const [mini, setMini] = useState(false)
  const [accent, setAccent] = useState(ACCENTS[0]!)
  const [url, setUrl] = useState('')
  const player = useRef<PlayerHandle>(null)
  Object.assign(window, { player })

  const current = custom ?? EPISODES[episode]!
  const next = custom ? undefined : EPISODES[episode + 1]
  const upNext = useMemo<UpNext | null>(
    () =>
      next
        ? {
            title: next.title,
            label: next.line.split(' · ')[0]!,
            play: (auto) => {
              if (auto) stillWatching.autoplayed()
              setEpisode((n) => n + 1)
            },
            shouldAsk: stillWatching.shouldAsk,
          }
        : null,
    [next],
  )

  return (
    <div className="page">
      <header className="masthead">
        <h1>Web-Media-Player</h1>
        <p>
          A complete video player for the web, built for React. It plays MKV, HEVC, AC-3, DTS, every
          audio track and the subtitles inside the file, right in the browser.
        </p>
      </header>

      <section className={mini ? 'stage stage-docked' : 'stage'} data-dock={mini ? 'mini' : 'page'}>
        {mini ? (
          <div className="docked-note">
            <strong>Playing in the miniplayer.</strong> The rest of the page is yours to browse: the
            video carries on in the corner. Press I, or the expand button, to bring it back.
          </div>
        ) : null}
        <div className="player-frame">
          <Player
            ref={player}
            source={current.source}
            title={current.title}
            subtitles={custom ? undefined : SUBTITLES}
            upNext={upNext}
            accentColor={accent}
            layout={mini ? 'mini' : 'page'}
            onToggleMiniplayer={() => setMini((m) => !m)}
            onClose={() => setMini(false)}
            keyboard="global"
            loader={
              custom
                ? { title: current.title }
                : {
                    title: current.title,
                    line: current.line,
                    overview:
                      'A night on the northern coast, when the sky starts to move. A short film made entirely in ffmpeg to show what the player can do.',
                    backdrop: '/media/backdrop.jpg',
                    poster: '/media/poster.jpg',
                  }
            }
            renderMiniBar={({ paused, togglePlay }) => (
              <div className="mini-bar">
                <button type="button" onClick={togglePlay}>
                  {paused ? 'Play' : 'Pause'}
                </button>
                <span>{current.title}</span>
              </div>
            )}
          />
        </div>
      </section>

      <section className="panel">
        <div className="row">
          <label className="file">
            Play a file from your computer
            <input
              type="file"
              accept="video/*,.mkv,.avi,.ts,.m2ts"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) setCustom({ source: { file }, title: file.name, line: '' })
              }}
            />
          </label>
          <form
            className="url"
            onSubmit={(event) => {
              event.preventDefault()
              if (url.trim())
                setCustom({ source: { url: url.trim() }, title: url.trim(), line: '' })
            }}
          >
            <input
              type="url"
              placeholder="…or a video URL (the server must answer Range requests)"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            <button type="submit">Play URL</button>
          </form>
        </div>
        <div className="row">
          <span>Accent</span>
          {ACCENTS.map((colour) => (
            <button
              key={colour}
              type="button"
              className="swatch"
              aria-label={`Accent ${colour}`}
              aria-pressed={colour === accent}
              style={{ background: colour }}
              onClick={() => setAccent(colour)}
            />
          ))}
          <span className="spacer" />
          <button type="button" onClick={() => setMini((m) => !m)}>
            {mini ? 'Back to the page player' : 'Dock as miniplayer'}
          </button>
          {custom ? (
            <button type="button" onClick={() => setCustom(null)}>
              Back to the demo film
            </button>
          ) : null}
        </div>
      </section>

      <section className="keys">
        <h2>Keyboard</h2>
        <dl>
          {[
            ['Space / K', 'Play or pause'],
            ['J / L, ← / →', 'Back or forward 10 seconds'],
            ['Shift + ← / →', 'Previous or next chapter'],
            ['↑ / ↓, M', 'Volume, mute'],
            ['C', 'Subtitles on or off'],
            ['+ / −', 'Subtitle size'],
            ['Z / X', 'Subtitles earlier or later'],
            ['S', 'Skip intro or credits'],
            ['F', 'Full screen'],
            ['I / P', 'Miniplayer, picture in picture'],
            ['0–9', 'Jump to 0%–90%'],
          ].map(([key, what]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer>
        MIT licence · by <a href="https://github.com/Roshan-Here">Roshan-Here</a> · decoding by{' '}
        <a href="https://github.com/Roshan-Here/Web-Buildin-decoder">Web-Buildin-decoder</a>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
)
