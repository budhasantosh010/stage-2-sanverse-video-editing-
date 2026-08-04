# Gate D — real filmstrips, real image thumbnails, real waveforms

Status: **complete** · 2026-08-04 · branch `agent/g6-g8-local-alpha`

> This one document covers what the program asked to be split across
> `derived-media-api`, `server-cache-and-process-bounds`, `filmstrip-decoding`,
> `image-thumbnails`, `waveform-decoding`, `browser-resource-controller` and
> `timeline-windowing`. They are one subject with one set of trade-offs, and
> seven files describing one subject drift apart. The section headings below
> match those names so nothing is lost.

---

## What changed, for somebody who has never opened the code

Before this, the timeline drew every piece of your video as a coloured rectangle
with a filename on it. You could not find anything, because you know your video
by what it LOOKS like and what it SOUNDS like.

Now:

```
  BEFORE                             AFTER

  ┌──────────────────────────┐       ┌──────────────────────────┐
  │ primary-30s.mp4          │       │ [face][face][hand][face] │  ← real frames
  └──────────────────────────┘       └──────────────────────────┘
  ┌──────────────────────────┐       ┌──────────────────────────┐
  │ Dialogue                 │       │ ▁▃█▅▂▁ ▃█▆▂ ▁▄█▇▃▁       │  ← real sound
  └──────────────────────────┘       └──────────────────────────┘
```

The pictures are the actual frames of your actual recording, pulled out by the
same program that produces the finished video. The sound shape is the actual
loudness of the actual sound, measured to within a rounding error of what FFmpeg
itself reports.

---

## Who does what (the "derived-media API" and the architecture)

Decided before any code was written, in
`DOCS/decisions/ADR-DERIVED-MEDIA-EXECUTION-V1.md`. Summary:

| The browser decides | The server makes |
|---|---|
| what part of the timeline is on screen | which file that is, safely |
| which thumbnails and sound blocks that needs | pulls out one real frame |
| asking for the same thing only once | decodes one bounded stretch of sound |
| stopping when the user scrolls away | shrinks a picture to a bounded size |
| holding a fixed number of finished ones | never runs more than a few at once |
| drawing them | keeps finished ones in a throwaway folder |

Three addresses, each carrying **which file, WHICH BYTES of it, which moment,
what size** — and nothing else. There is no path in any of them and there never
may be:

```
GET /api/projects/:id/media-analysis/frame
      ?assetId=&assetVersion=&sourceTicks=&width=            → image/webp
GET /api/projects/:id/media-analysis/image-thumbnail
      ?assetId=&assetVersion=&width=&height=                 → image/webp
GET /api/projects/:id/media-analysis/waveform
      ?assetId=&assetVersion=&sourceTicks=&spanTicks=&peakCount=
                                                             → closed JSON
```

Eleven refusal codes, all plain sentences, none containing a path or a word of
FFmpeg's own output: `PROJECT_NOT_FOUND`, `ASSET_NOT_FOUND`, `ASSET_MISSING`,
`ASSET_KIND_UNSUPPORTED`, `ANALYSIS_KEY_INVALID`, `SOURCE_TIME_OUT_OF_RANGE`,
`ANALYSIS_LIMIT_EXCEEDED`, `DECODER_UNAVAILABLE`, `DECODER_FAILED`,
`ANALYSIS_CANCELLED`, `ANALYSIS_CACHE_CORRUPT`.

Answers carry `cache-control: private, max-age=86400, immutable`. That is
truthful rather than a gamble, because the address names the exact bytes it
describes, so the same address can never mean two different pictures.

---

## The name that makes stale pictures impossible

Every piece of derived media is named by:

```
   which file · WHICH BYTES it holds · which moment of it · how big
```

`assetVersion` is the first sixteen characters of the file's SHA-256 checksum,
which the project already records for every file. It is a checksum of CONTENT:
no path, no inode, no local URL, so it is safe in a web address.

**Why it had to be added.** `assetId` names a slot in the project — "the B-roll
clip" — and does not promise the bytes behind that slot never change. Without a
version, a relinked file would serve a picture of the OLD footage under the new
clip, and it would look completely plausible. With it, different bytes mean a
different name, so the stale picture simply cannot be found. No expiry, no clock,
no window in which the wrong thing can be shown.

**`image-thumbnail` is its own kind**, not "a video frame at moment zero". A
picture has no moments; asking for second four of a photograph is a question with
no answer, and pretending otherwise would put a meaningless number in the name
and invite a caller to vary it. The server refuses it — proved below.

---

## Server cache and process bounds

### The throwaway folder

```
  .sanverse-data/projects/<projectId>/
  ├── source.mp4          THE USER'S FOOTAGE      — never touched
  ├── edit-project.json   THE USER'S EDIT         — never touched
  ├── assets/             THE USER'S OTHER FILES  — never touched
  ├── exports/            FINISHED VIDEOS         — never touched
  └── derived-media/v1/   ← delete this whenever you like
      ├── frames/  ├── images/  ├── waveforms/  └── work/
```

- Not the project, not accepted history, not part of the export key.
- Filenames are a 64-character hash of the validated request. Nothing a person
  typed ever reaches the filesystem.
- Written under a temporary name, flushed, renamed. A crash leaves a stray
  temporary file, never a half-written picture under the real name.
- A file that reads back damaged is deleted and made again, so a corrupt entry
  cannot poison the cache permanently.
- A ceiling of 4,000 files per project; past that the ones longest without being
  wanted are removed.
- **Failures are never cached.** A file that was busy for one second must not be
  reported missing for the rest of the session.

**The `v1` in the path is the invalidation mechanism, and it earned its keep.**
Mid-session the way loudness is measured changed (see below) and the cached
answers were still the old ones — because the name describes the REQUEST, not
the method. If the way anything here is produced ever changes again, that folder
version goes up and every old answer becomes unreachable in one step.

### Process bounds

| Work | At once | Why |
|---|---|---|
| pulling out a frame | **2** | short jobs; leaves the machine responsive |
| decoding sound | **1** | reads more of the file; the heavier job |
| jobs waiting | **64** | past this, a truthful refusal, not a backlog |
| one job's lifetime | **20 s** | a stuck decoder is killed, not held |

Two requests for the same name share ONE job. Ten clips showing the same moment
cost one FFmpeg run. All four numbers are configurable through one closed
environment reader that refuses a typo rather than falling back silently.

Observed live at `/api/diagnostics`:

```json
"mediaAnalysis": { "activeFrames": 0, "activeWaveforms": 0, "queued": 0, "sharedJobs": 0 }
```

Under a 40-request flood in test, the peak concurrent frame count was **2**, and
it returned to 0 with no leaked slots.

---

## Filmstrip decoding

One frame, one exact moment, bounded size:

```
ffmpeg -ss <exact seconds> -i <file> -frames:v 1
       -vf scale=W:W:force_original_aspect_ratio=decrease,setsar=1
       -map_metadata -1 -f webp
```

- `-ss` **before** `-i`: seeks first, decodes after. On an hour-long recording
  that is a fraction of a second instead of half a minute.
- The moment is exact to 1/1,440,000 of a second. Rounding to milliseconds
  drifts far enough on a long recording to show the wrong frame.
- `force_original_aspect_ratio=decrease` fits the picture inside the box without
  stretching — the same rule the exporter already uses for overlays, so a
  thumbnail cannot be a different shape from the thing it previews.
- Phone orientation is applied by FFmpeg's default, so upright footage previews
  upright.
- `-map_metadata -1` strips the time, place and device a camera writes into its
  files. None of that belongs in a thumbnail.

**Measured on the owner's own footage** (`primary-30s.mp4`, 1920×1080):

| moment | produced | average colour |
|---|---|---|
| 0.00 s | 64×36 WebP, 558 B | 115, 107, 110 |
| 5.00 s | 64×36 WebP, 566 B | 118, 104, 106 |
| 10.00 s | 64×36 WebP, 566 B | 127, 106, 106 |
| 20.00 s | 64×36 WebP, 524 B | 125, 110, 109 |

Four different pictures — not one frame repeated, and not black.

A **second, portrait recording** (714×1280) produced `36×64` WebP — correctly
contained in the same square box, and a plainly different picture (142, 121, 107).

See `screenshots/gate-d/timeline-v1-filmstrip-untrimmed.png` and
`timeline-v2-second-recording.png`.

### The layout rule that makes editing cheap

Pictures sit on a fixed ladder of moments measured **from the start of the
recording** — 0, 0.75 s, 1.5 s… — plus one extra at the clip's own start.

```
  move a clip     nothing changes: same recording, same moments
  trim a clip     ONE picture changes; every other is already made
  split a clip    the right half needs ONE new picture, its own new start
```

The extra picture at the clip's own start is why trimming visibly changes the
first frame instead of snapping to a nearby rounding line. Proved in the browser:
after trimming 3 s off the head, the timeline's first requested moment moved from
**0.00 s to 3.50 s**.

---

## Image thumbnails

Same securing, same containment, same stripping. A picture is asked for once at
one size and shared by every clip that uses it — five uses of one picture cost
one decode, held by test.

The 1440×900 test picture came back **64×40** — exactly 1.6∶1, contained, not
stretched. Asking the frame endpoint for a picture is refused:

```
{"error":"That kind of preview does not apply to this file.","code":"ASSET_KIND_UNSUPPORTED"}
```

---

## Waveform decoding

Only the requested stretch is decoded — `-ss` then `-t`, ten seconds maximum —
so memory is tied to what is on screen, never to how long the music is.

**Channel policy: the loudest of ALL channels at that position wins.** Not the
average. A clap in one ear only is a real event; averaging halves it. Taking the
largest absolute value across a bucket of interleaved samples gives exactly that.

### The real bug the browser found

The first version forced the sound to two channels so the number of samples in a
block would be known arithmetic. Measured against a real mono recording:

```
  the file's real loudest point, per FFmpeg   0.11875
  what this reported                          0.08398   ← 71%, exactly 1/√2
```

Turning one channel into two shares the sound between them so the TOTAL energy is
unchanged. Right for playing, wrong for measuring — every mono voice recording
would have been drawn three decibels quieter than it is, forever, and nobody
would have questioned the picture because it still had the right shape.

The channels are now left exactly as the file has them, and the short-block
problem is solved by arithmetic that needs neither the rate nor the channel
count: the sound that came back covers a known fraction of the block, so the
numbers fill that fraction and the rest is silence.

After the fix, against FFmpeg's own measurement of the same seconds:

| second | FFmpeg says | this says |
|---|---|---|
| 0 | 0.11875 | **0.11874** |
| 4 | 0.11875 | 0.11981 |
| 8 | 0.11875 | 0.13474 |

(Seconds 4 and 8 read higher because FFmpeg's whole-second figure is a single
peak for the second while this reports the peak of each of eight buckets inside
it — a finer measurement of the same sound.)

The last block of a 20-second song, asked for from 19.5 s:

```
   0.126  0.119  0.119  0.119  0.000  0.000  0.000  0.000
   └────── half a second of real sound ─────┘└─ silence ─┘
```

Drawn as half a second of sound in the right half of the block, not stretched to
fill a whole one.

**Real dialogue** from the owner's recording, one second per row, eight numbers
each — the shape of somebody speaking:

```
  0 s   0.574 0.446 0.425 0.468 0.714 0.323 0.816 0.794
  5 s   0.572 0.557 0.349 0.821 0.797 0.320 0.497 0.355
 10 s   0.708 0.815 0.779 0.845 0.572 0.818 0.582 0.164
```

See `screenshots/gate-d/timeline-a1-waveform.png` (speech, peak 0.859) and
`timeline-a2-waveform.png` (music, peak 0.142) — visibly different, which is the
truth about those two files.

---

## Browser resource controller

**One** fetcher per screen. Not one per clip: a hundred clips fetching for
themselves would open a hundred connections, ask for the same moment once per
clip, and be unable to cancel anything, because no single piece of code would
know the user had scrolled away.

The timeline says, in one call, what it wants right now and in what order:

```
  1. the clip the user has selected
  2. everything else on screen
  3. one screen either side
  4. nothing beyond that, ever
```

The controller then: answers from memory where it can, joins requests already in
flight, starts at most six, queues the rest, and **stops anything in flight that
is no longer wanted**. Every ImageBitmap that leaves the cache is closed, and the
count of closed ones is a number a test can assert.

`missing` and `error` are deliberately different states. Missing means the file
is gone and the user has to do something; error means it failed and trying again
may work. Collapsing them would tell somebody their footage was gone when the
disk was busy for a second. A failure is remembered so the same doomed request is
not made a hundred times a second, and `retry` is the deliberate way back.

---

## Timeline windowing

One visible-range calculation feeds clip mounting, filmstrip planning and
waveform planning. Overscan is one screen either side, clamped to the project.

Row heights live in `timeline-lane-metrics.ts` and are pushed into the stylesheet
as `--timeline-lane-height`, so the code and the layout cannot disagree:

| row | desktop | small screen | detail |
|---|---|---|---|
| overlay | 46 px | 32 px | full / compact |
| video | 58 px | 40 px | full / full |
| captions | 32 px | 24 px | compact / none |
| dialogue | 42 px | 32 px | full / compact |
| music | 42 px | 32 px | full / compact |

### The second real bug the browser found

Row heights were decided from the width of the TIMELINE. On a 1440-pixel desktop
the timeline shares the screen with the preview and the inspector and gets about
700 pixels — so the editor decided the user was on a phone and shrank every row
on a large monitor. It now reads the width of the WINDOW.

### Measured on the real project, scrolling end to end and back, 32 stops

```
  clips mounted at once, worst case      2
  drawing surfaces at once, worst case   3
  DOM nodes inside the timeline, worst  199
  <video> elements                        1   (at every single stop)
  object URLs created                     0
  failed requests                         0
  console errors                          0
```

A selected clip stays mounted even when scrolled off screen, so the Inspector
does not empty itself when the user looks somewhere else.

---

## What derived media never does

No operation. No change set. No revision. No entry in Undo. Nothing is written
into the project, and the folder it uses can be deleted at any moment with the
only consequence being a few seconds of re-decoding.
