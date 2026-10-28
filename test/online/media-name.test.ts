import { describe, expect, it } from 'vitest'
import {
  cleanCaption,
  episodeCode,
  episodeName,
  isGenericName,
  isSeriesName,
  looseEpisode,
  nameLanguages,
  nameQuery,
  parseMediaName,
  pieceOf,
  qualityTags,
  tileTitle,
  type ExtraKind,
} from '../../src/online/media-name.js'

// Pinned rather than read off the clock, so a test that passes today still passes in 2030.
const parse = (name: string, caption?: string | null) => parseMediaName(name, caption, 2027)

/** TMPlayer's shared corpus (core/src/jvmTest/.../NameCorpus.kt), every title invented. */
const CORPUS: {
  fileName: string
  title: string
  year?: number
  season?: number
  episode?: number
  part?: number
  extra?: ExtraKind
  airDate?: string
}[] = [
  // A channel handle run into the name with underscores.
  {
    fileName: '@HarbourMob_LinkZz_Night_Lantern_2022_Tamil_Proper_HQ_HDRip_700MB_x264_AAC.mkv',
    title: 'Night Lantern',
    year: 2022,
  },
  { fileName: '@HEVC_Mob_Night_Lantern_2022_Tamil_720p.mkv', title: 'Night Lantern', year: 2022 },
  {
    fileName: '@TG_Clips4u -Night Lantern (2024) Tamil 720p.mkv',
    title: 'Night Lantern',
    year: 2024,
  },
  { fileName: 'Paper_Kite_2005_Tamil_DVDRip_XviD_2.avi', title: 'Paper Kite', year: 2005 },
  { fileName: 'Paper Kite (2009) Tamil HDRip 720p x264.mkv', title: 'Paper Kite', year: 2009 },
  {
    fileName: 'www.filmsite.xyz - Paper Kite (2024) 1080p WEB-DL.mkv',
    title: 'Paper Kite',
    year: 2024,
  },
  { fileName: 'Paper Kite Tamil Hd.mp4', title: 'Paper Kite' },
  { fileName: 'Paper Kite Full Movie HD | Arun Devan.mp4', title: 'Paper Kite' },
  { fileName: 'Velvet Hour [ Arun Devan, Mira Joshi ].mp4', title: 'Velvet Hour' },
  // Numbers that are not episodes.
  { fileName: 'Siren Patrol 100.mp4', title: 'Siren Patrol 100' },
  { fileName: 'Harbour Lights Part 2 (2019) 720p.mkv', title: 'Harbour Lights Part 2', year: 2019 },
  {
    fileName: 'Harbour Lights Chapter 3 (2021) 1080p.mkv',
    title: 'Harbour Lights Chapter 3',
    year: 2021,
  },
  { fileName: 'Coast Run 2 2014 720p HDRip.mkv', title: 'Coast Run 2', year: 2014 },
  { fileName: '1944.1080p.BluRay.mkv', title: '1944' },
  { fileName: '1944 (2015) 1080p.mkv', title: '1944', year: 2015 },
  { fileName: 'Tide 1080.mkv', title: 'Tide 1080' },
  // Tag words inside a title, before its year.
  { fileName: 'The Italian Garden 2003 1080p BluRay.mkv', title: 'The Italian Garden', year: 2003 },
  { fileName: 'A Complete Stranger (2024) 720p.mkv', title: 'A Complete Stranger', year: 2024 },
  { fileName: 'The Final Cut 2004 720p.mkv', title: 'The Final Cut', year: 2004 },
  { fileName: 'Into the Web 2020 HDRip.mkv', title: 'Into the Web', year: 2020 },
  { fileName: 'Harbour Notes Tamil 2022 HDRip.mkv', title: 'Harbour Notes', year: 2022 },
  { fileName: 'Learn_Tamil_Fast.mp4', title: 'Learn Tamil Fast' },
  // Split films.
  { fileName: 'Coast Run 2014 720p CD1.avi', title: 'Coast Run', year: 2014, part: 1 },
  { fileName: 'Coast.Run.2014.720p.CD2.avi', title: 'Coast Run', year: 2014, part: 2 },
  { fileName: 'Coast.Run.2014.Part2.mkv', title: 'Coast Run', year: 2014, part: 2 },
  { fileName: 'Coast Run Pt1.mkv', title: 'Coast Run', part: 1 },
  // Extras.
  {
    fileName: 'Coast Run (2014) Official Trailer.mp4',
    title: 'Coast Run',
    year: 2014,
    extra: 'Trailer',
  },
  { fileName: 'Trailer - Coast Run (2014).mp4', title: 'Coast Run', year: 2014, extra: 'Trailer' },
  {
    fileName: 'Coast Run 2014 Teaser 2 1080p.mp4',
    title: 'Coast Run',
    year: 2014,
    extra: 'Teaser',
  },
  { fileName: 'The Sample Room (2020) 720p.mkv', title: 'The Sample Room', year: 2020 },
  { fileName: 'Sample Room Tales.mkv', title: 'Sample Room Tales' },
  // Episodes, and episodes by air date.
  {
    fileName: 'Harbour.Notes.S01E02.1080p.WEB-DL.mkv',
    title: 'Harbour Notes',
    season: 1,
    episode: 2,
  },
  {
    fileName: 'Morning Desk 2024.10.14 720p.mp4',
    title: 'Morning Desk',
    year: 2024,
    airDate: '2024-10-14',
  },
  {
    fileName: 'Morning Desk 14-10-2024.mp4',
    title: 'Morning Desk',
    year: 2024,
    airDate: '2024-10-14',
  },
  // Other scripts and decorations.
  { fileName: 'இரவு நிலா (2023) 720p.mkv', title: 'இரவு நிலா', year: 2023 },
  { fileName: 'ليلة القمر (2021) 1080p.mkv', title: 'ليلة القمر', year: 2021 },
  { fileName: '🎬🔥 Night Lantern (2022) 🔥.mkv', title: 'Night Lantern', year: 2022 },
]

describe('parseMediaName: the shared corpus', () => {
  it.each(CORPUS)('$fileName', (c) => {
    const got = parse(c.fileName)
    expect({
      title: got.title,
      year: got.year,
      season: got.season,
      episode: got.episode,
      part: got.part,
      extra: got.extra,
      airDate: got.airDate,
    }).toEqual({
      title: c.title,
      year: c.year ?? null,
      season: c.season ?? null,
      episode: c.episode ?? null,
      part: c.part ?? null,
      extra: c.extra ?? null,
      airDate: c.airDate ?? null,
    })
  })
})

describe('parseMediaName: films and years', () => {
  it('reads a descriptive creator upload', () => {
    const p = parse('Harbour Notes (2026) Malayalam (1080p WEB-Rip E-AC3).mkv')
    expect([p.title, p.year, p.episode]).toEqual(['Harbour Notes', 2026, null])
  })

  it('treats dots and underscores as spaces', () => {
    expect(parse('City.Archive.1999.1080p.BluRay.x264-GROUP.mkv')).toMatchObject({
      title: 'City Archive',
      year: 1999,
    })
    expect(parse('Weekend_Sketchbook_2001_720p_BRRip.mkv')).toMatchObject({
      title: 'Weekend Sketchbook',
      year: 2001,
    })
  })

  it('keeps a year beyond next year in the title, and a real year after it wins', () => {
    expect(parse('Studio Log 4021 1080p BluRay x265.mkv')).toMatchObject({
      title: 'Studio Log 4021',
      year: null,
    })
    expect(parse('Studio Log 4021 2017 2160p UHD BluRay REMUX HDR.mkv')).toMatchObject({
      title: 'Studio Log 4021',
      year: 2017,
    })
  })

  it('lets a bracketed year beat a bare one', () => {
    expect(parse('1984 (1956) 720p WEB-DL.mkv')).toMatchObject({ title: '1984', year: 1956 })
  })

  it('stops at the technical block when there is no year', () => {
    expect(parse('Design Tutorial Part Two 2160p WEB-DL DDP5 1 Atmos HDR HEVC.mkv')).toMatchObject({
      title: 'Design Tutorial Part Two',
      year: null,
    })
  })

  it('strips brackets left dangling by the cut', () => {
    expect(parse('Garden Notes [2014] [1080p] [BluRay].mkv')).toMatchObject({
      title: 'Garden Notes',
      year: 2014,
    })
  })

  it('keeps a number that is part of the title, and a short name is not an extension', () => {
    expect(parse('Workshop 2 (2018) 1080p.mkv')).toMatchObject({ title: 'Workshop 2', year: 2018 })
    expect(parse('Workshop 2').title).toBe('Workshop 2')
    expect(parse('Kitchen Journal.mkv')).toMatchObject({ title: 'Kitchen Journal', year: null })
  })

  it('survives names that are only markers, or nothing', () => {
    const markers = parse('1080p.x264.mkv')
    expect(markers.year).toBeNull()
    expect(markers.title).not.toContain('(')
    expect(parse('')).toMatchObject({ title: '', year: null })
  })

  it('reads a year that opens the name as the title', () => {
    expect(parse('1944.mkv')).toMatchObject({ title: '1944', year: null })
    expect(parse('2019 Highlights.mp4')).toMatchObject({ title: '2019 Highlights', year: null })
    expect(parse('[2014] Garden Notes 1080p.mkv').year).toBe(2014)
    expect(parse('[2014] Garden Notes 1080p.mkv').title).toContain('Garden Notes')
  })

  it('keeps the year in the search query', () => {
    expect(nameQuery(parse('City.Archive.1999.1080p.mkv'))).toBe('City Archive 1999')
    expect(nameQuery(parse('Kitchen Journal.mkv'))).toBe('Kitchen Journal')
  })
})

describe('parseMediaName: decoration and tags', () => {
  it('drops a channel signature', () => {
    const p = parse('🅂🅂_Harbour_Notes_2025_Tamil_HQ_HDRip_1080p_HEVC_x265_DD5_1_192Kbps_and.mkv')
    expect([p.title, p.year, p.episode]).toEqual(['Harbour Notes', 2025, null])
  })

  it('drops handles and tracker domains', () => {
    expect(parse('@CreatorClips - Workshop (2022) 1080p.mkv').title).toBe('Workshop')
    expect(parse('www.creatorfiles.org - Workshop 2022 1080p.mkv').title).toBe('Workshop')
  })

  it('reads a language after the title as a marker, and one that opens it as the title', () => {
    expect(parse('Harbour Notes Tamil HQ HDRip 1080p.mkv')).toMatchObject({
      title: 'Harbour Notes',
      year: null,
    })
    expect(parse('Tamil Lessons (2010) 720p BluRay.mkv')).toMatchObject({
      title: 'Tamil Lessons',
      year: 2010,
    })
  })

  it('keeps a title in its own script', () => {
    expect(parse('മരയ്ക്കാർ 2021 1080p.mkv').title).toBe('മരയ്ക്കാർ')
  })
})

describe('parseMediaName: episodes', () => {
  it('reads a television episode', () => {
    const p = parse('Studio.Sessions.S02E05.1080p.WEB-DL.mkv')
    expect([p.title, p.season, p.episode]).toEqual(['Studio Sessions', 2, 5])
    expect(isSeriesName(p)).toBe(true)
    expect(episodeCode(p)).toBe('S02E05')
  })

  it('knows the last episode of a file of two', () => {
    for (const name of [
      'Harbour.Notes.S01E01E02.1080p.mkv',
      'Harbour.Notes.S01E01-E02.1080p.mkv',
    ]) {
      expect(parse(name)).toMatchObject({
        title: 'Harbour Notes',
        season: 1,
        episode: 1,
        lastEpisode: 2,
      })
    }
    expect(parse('Harbour.Notes.S01E03.1080p.mkv').lastEpisode).toBeNull()
  })

  it.each([
    'Creative Course 2x04 1080p.mkv',
    'Creative Course Season 2 Episode 4 1080p.mkv',
    'Creative Course S02 EP04 1080p.mkv',
    'Creative Course.S02.E04.1080p.mkv',
    'Creative Course S02E04-E05 1080p.mkv',
    'Creative.Course.S02E04.1080p.10bit.WEBRip.6CH.x265.HEVC-PS.mkv',
  ])('reads %s as S02E04', (name) => {
    expect(parse(name)).toMatchObject({ title: 'Creative Course', season: 2, episode: 4 })
  })

  it.each([
    ['Harbour.Notes.1x02.720p.HDTV.x264-GROUP.mkv', 1, 2],
    ['Harbour Notes 3x11 Return 1080p WEB-DL.mkv', 3, 11],
    ['Harbour_Notes_2x05_hdtv.mp4', 2, 5],
  ])('reads the season by episode form in %s', (name, season, episode) => {
    expect(parse(name)).toMatchObject({ title: 'Harbour Notes', season, episode })
  })

  it('reads a whole season as television without an episode', () => {
    const p = parse('Creative Course Season 2 Complete 1080p.mkv')
    expect(p).toMatchObject({ title: 'Creative Course', season: 2, episode: null })
    expect(isSeriesName(p)).toBe(true)
    expect(episodeCode(p)).toBeNull()
  })

  it('never mistakes a resolution for a season and episode', () => {
    expect(parse('Studio Recording 1920x1080 BluRay.mkv')).toMatchObject({
      season: null,
      episode: null,
    })
  })

  it.each([
    'Kitchen Journal Ep 02 1080p.mp4',
    'Kitchen.Journal.Ep02.720p.mkv',
    'Kitchen Journal EP.02 (2024).mkv',
    'Kitchen Journal Episode 2 Malayalam 720p.mkv',
    'Kitchen Journal Ep-02.mkv',
  ])('reads an episode with no season in %s', (name) => {
    const p = parse(name)
    expect(p).toMatchObject({ title: 'Kitchen Journal', season: null, episode: 2 })
    expect(episodeCode(p)).toBe('E02')
  })

  it.each([
    ['[SubsPlease] Sky Garden - 02 (1080p) [A1B2C3D4].mkv', 2],
    ['[Erai-raws] Sky Garden - 12 [1080p][Multiple Subtitle].mkv', 12],
    ['Sky Garden - 1071 [720p].mkv', 1071],
    ['[Group] Sky Garden - 05v2 (1080p).mkv', 5],
    ['Sky Garden - 07.mkv', 7],
  ])('reads the fansub dash form in %s', (name, episode) => {
    expect(parse(name)).toMatchObject({ title: 'Sky Garden', season: null, episode })
  })

  it('takes a season written beside the dash form', () => {
    expect(parse('[SubsPlease] Sky Garden S2 - 03 (1080p).mkv')).toMatchObject({
      title: 'Sky Garden',
      season: 2,
      episode: 3,
    })
  })

  it.each([
    'City Archive - 2019 1080p BluRay.mkv',
    'City Archive - 1080p WEB-DL.mkv',
    'City Archive - 720p.mkv',
    'Workshop - 2 (2018).mkv',
    'City Archive - Directors Cut 2160p.mkv',
  ])('reads no episode in %s', (name) => {
    expect(parse(name).episode).toBeNull()
  })

  it('reads the year after a dash', () => {
    expect(parse('City Archive - 2019 1080p BluRay.mkv').year).toBe(2019)
  })

  it.each([
    'City.Archive.2016.1080p.BluRay.x265.10bit.mkv',
    'City Archive 2016 2160p HDR x264 DDP5 1.mkv',
    'City Archive 720p 1280x720 H 265.mkv',
    'City Archive 720p HEVC AAC2 0.mkv',
    'City Archive (2016) 4K 60fps.mkv',
  ])('never reads codecs or channels as episodes in %s', (name) => {
    expect(parse(name)).toMatchObject({ title: 'City Archive', season: null, episode: null })
  })

  it.each([
    'Siren Patrol 100.mp4',
    'Harbour Lights Part 2 (2019).mkv',
    'Harbour Lights Chapter 3 (2021).mkv',
    'Coast Run 2 2014 720p.mkv',
    'Tide 1080.mkv',
    '1944.1080p.mkv',
  ])('never makes a numbered film an episode: %s', (name) => {
    const p = parse(name)
    expect(isSeriesName(p)).toBe(false)
  })

  it('makes an air date an episode, never a film', () => {
    const p = parse('Morning Desk 2024.10.14 720p.mp4')
    expect(isSeriesName(p)).toBe(true)
    expect(p.airDate).toBe('2024-10-14')
  })
})

describe('parseMediaName: the caption as a second source', () => {
  it('gives the episode when the file name has none', () => {
    expect(
      parse('harbour_notes_720p.mkv', '🎬 Harbour Notes S02E04\n\nJoin @CreatorClips for more'),
    ).toMatchObject({ title: 'Harbour Notes', season: 2, episode: 4 })
  })

  it("keeps the file's title when the caption names only the episode", () => {
    expect(parse('Harbour Notes 1080p WEB-DL.mkv', 'Episode 4')).toMatchObject({
      title: 'Harbour Notes',
      season: null,
      episode: 4,
    })
  })

  it('lets the file name win when both carry an episode', () => {
    expect(parse('Harbour.Notes.S01E03.1080p.mkv', 'Harbour Notes S01E09 out now').episode).toBe(3)
  })

  it('changes nothing for a caption with no episode', () => {
    const plain = parse('City.Archive.1999.1080p.mkv')
    expect(parse('City.Archive.1999.1080p.mkv', 'Watch in HD, link in bio')).toEqual(plain)
    expect(parse('City.Archive.1999.1080p.mkv', null)).toEqual(plain)
    expect(parse('City.Archive.1999.1080p.mkv', '  \n ')).toEqual(plain)
  })

  it('reads a caption alone', () => {
    expect(parse('', 'Sky Garden Ep 3')).toMatchObject({ title: 'Sky Garden', episode: 3 })
  })

  it.each([
    'Studio.Sessions.S01E02.1080p.WEB-DL.mkv',
    'Studio Sessions s01e02 720p.mkv',
    'Studio Sessions S01.E02.mkv',
    'Studio Sessions S1E2 (2024).mkv',
    'Studio Sessions Season 1 Episode 2.mkv',
  ])('ignores a contradicting caption for %s', (name) => {
    expect(parse(name, 'something else entirely S09E09')).toMatchObject({
      title: 'Studio Sessions',
      season: 1,
      episode: 2,
    })
  })
})

describe('parts and extras', () => {
  it("tells a sequel's Part 2 from a split file's", () => {
    expect(parse('Harbour Lights Part 2 (2019).mkv').part).toBeNull()
    expect(parse('Harbour Lights (2019) 720p Part 2.mkv')).toMatchObject({
      title: 'Harbour Lights',
      part: 2,
    })
    expect(parse('Harbour.Lights.2019.Disc.1.mkv').part).toBe(1)
    expect(parse('Harbour Notes S01E02 Part 2.mkv').part).toBeNull()
    expect(parse('Workshop CD20.mkv').part).toBeNull()
  })

  it('needs the extra word to end the title', () => {
    expect(parse('Coast Run Promo.mp4').extra).toBe('Promo')
    expect(parse('Coast.Run.2014.1080p.Sample.mkv').extra).toBe('Sample')
    expect(parse('The Sample Room (2020).mkv').extra).toBeNull()
    expect(parse('Promo Nights Live.mp4').extra).toBeNull()
    expect(parse('Coast Run (2014) ட்ரெய்லர்.mp4').extra).toBe('Trailer')
  })
})

describe('the other readings', () => {
  it('reads a bare E number only the lenient way', () => {
    const name = 'Family Full House With Rohit Sharma — E5. Vlog.mp4'
    expect(parse(name).episode).toBeNull()
    expect(looseEpisode(name, 2027)).toMatchObject({
      title: 'Family Full House With Rohit Sharma',
      episode: 5,
      season: null,
    })
    expect(looseEpisode('E05.mkv', 2027)).toBeNull()
    expect(looseEpisode('City.Archive.1999.1080p.mkv', 2027)).toBeNull()
  })

  it("reads an episode's own name", () => {
    expect(episodeName('Harbour.Notes.S01E04.The.Lighthouse.1080p.mkv')).toBe('The Lighthouse')
    expect(episodeName('Show, E5. Vlog')).toBe('Vlog')
    expect(episodeName('Harbour.Notes.S01E04.1080p.mkv')).toBeNull()
  })

  it('reads the languages after the title', () => {
    expect(nameLanguages('Coast Run 2014 Tamil Hindi 720p.mkv')).toEqual(['ta', 'hi'])
    expect(nameLanguages('Coast_Run_(2014)_Malayalam_Dubbed.mkv')).toEqual(['ml'])
    expect(nameLanguages('Coast Run 2014 [Tam + Tel + Hin] 720p.mkv')).toEqual(['ta', 'te', 'hi'])
    expect(nameLanguages('Tamil Lessons 01.mp4')).toEqual([])
  })
})

describe('tileTitle', () => {
  const tile = (name: string, caption?: string) => tileTitle(name, caption, 2027)

  it('cleans release names and keeps the year or the code', () => {
    expect(tile('Gladiator.II.2024.1080p.WEB-DL.x265.mkv')).toBe('Gladiator II (2024)')
    expect(tile('Night Train (2019) 1080p x265.mkv')).toBe('Night Train (2019)')
    expect(tile('Harbour.Notes.S01E03.720p.mkv')).toBe('Harbour Notes S01E03')
    expect(tile('harbour_notes_720p.mkv', 'Harbour Notes S02E04')).toBe('Harbour Notes S02E04')
  })

  it('only tidies a plain name', () => {
    expect(tile('Episode 1.mkv')).toBe('Episode 1')
    expect(tile('Lecture_07_-_Limits.mp4')).toBe('Lecture 07 - Limits')
    expect(tile('Learn.Tamil.Fast.mp4')).toBe('Learn Tamil Fast')
    expect(tile('Coast walk, day 2.mp4')).toBe('Coast walk, day 2')
  })

  it('cuts a channel handle and trailing tags', () => {
    expect(
      tile('@HarbourMob_LinkZz_Night_Train_2022_Tamil_Proper_HQ_HDRip_700MB_x264_AAC.mkv'),
    ).toBe('Night Train (2022)')
    expect(tile('@TG_Clips4u -Night Train (2024) Tamil 720p.mkv')).toBe('Night Train (2024)')
    expect(tile('@Creator_Clips_Daily Workshop.mp4')).toBe('Workshop')
    expect(tile('Harbour Lights Tamil Hd.mp4')).toBe('Harbour Lights')
    expect(tile('Coast_Walk_Tamil.mkv')).toBe('Coast Walk')
    expect(tile('Paper Moons Full Movie HD.mp4')).toBe('Paper Moons')
    expect(tile('Learn_Tamil_Fast.mp4')).toBe('Learn Tamil Fast')
    expect(tile('Velvet Hour [ Arun Devan, Mira Joshi ].mp4')).toBe('Velvet Hour')
    expect(tile('Workshop [Part 1].mp4')?.startsWith('Workshop [Part 1')).toBe(true)
  })

  it('returns null for nothing', () => {
    expect(tile('')).toBeNull()
  })
})

describe('names, badges and captions', () => {
  it('tells camera names from release names', () => {
    expect(isGenericName('VID_20241013_120000.mp4')).toBe(true)
    expect(isGenericName('video.mp4')).toBe(true)
    expect(isGenericName('IMG_1234.MOV')).toBe(true)
    expect(isGenericName('1917.2019.1080p.mkv')).toBe(false)
  })

  it('reads the quality badge', () => {
    expect(qualityTags('Harbour.Notes.2021.2160p.UHD.HDR.DV.mkv')).toEqual(['4K'])
    expect(qualityTags('Creative.Course.S02E04.1080p.10bit.WEBRip.x265.HEVC-PS.mkv')).toEqual([
      '1080p',
    ])
    expect(qualityTags('Kitchen.Journal.720p.WEB-DL.mkv')).toEqual(['720p'])
    expect(qualityTags('Old.Video.480p.mkv')).toEqual(['SD'])
    expect(qualityTags('Film 2026 HDRip - 1080.mkv')).toEqual(['1080p'])
    expect(qualityTags('One Piece - 1080.mkv')).toEqual([])
    expect(qualityTags('Birthday Wishes.mkv')).toEqual([])
    expect(qualityTags(null)).toEqual([])
  })

  it("drops a channel's advertising lines from a caption", () => {
    expect(cleanCaption('Harbour Notes S01E02\n\nJoin @CreatorClips\nhttps://t.me/creator')).toBe(
      'Harbour Notes S01E02',
    )
    expect(cleanCaption('Watch at https://example.com tonight')).toBe(
      'Watch at https://example.com tonight',
    )
  })

  it('recognises byte pieces of a cut video', () => {
    expect(pieceOf('Night.Train.2019.mkv.001')).toEqual({
      base: 'Night.Train.2019.mkv',
      number: 1,
      certain: true,
    })
    expect(pieceOf('Night.Train.part007')).toMatchObject({ base: 'Night.Train', number: 7 })
    expect(pieceOf('Night_Train_Part_2')).toBeNull()
    expect(pieceOf('Movie.720')).toBeNull()
    expect(pieceOf('Backup.7z.001')).toBeNull()
    expect(parse('Night.Train.2019.1080p.mkv.002')).toMatchObject({
      title: 'Night Train',
      year: 2019,
    })
  })
})
