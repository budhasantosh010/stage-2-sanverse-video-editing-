# Evidence — titles, callouts, B-roll, pictures and music, burned into real exports (G5-C)

Date: 2026-07-29
Evidence level: **E4** — real media, real uploads, real cut, two real exports,
exported frames and exported audio inspected. Not E5: one recording, one frame
rate, synthetic B-roll and music, no owner run.

Decisions: `DOCS/adr/ADR-007-many-kinds-of-media.md`.

Ran on scratch project `project_6f5264a7eaea3801c76a6f9482df0d53`
(`test-30s.mp4`, 30.033 s, 1920x1080, 30 fps), never on the owner's own project.

## TWO REAL DEFECTS THAT 741 PASSING TESTS DID NOT CATCH

This is the third time the real loop has found what tests could not, and both
of these are worth recording in full.

### 1. `overlay:x=` instead of `overlay=x=` — the export failed outright

FFmpeg joins a filter's FIRST option to its name with `=`; only later options
use `:`. The graph read correctly to a human and was rejected with
`No option name near '77+(806-overlay_w)/2:…'`.

Every existing test asserted that PIECES of the string were present
(`toContain("x='64+(512-overlay_w)/2'")`) and every one passed while the whole
thing was unparseable. **Asserting on substrings of a generated language is not
the same as asserting it parses.**

Guard added: a test that walks every filter in the graph and demands the part
before the first separator is a plain filter name whose first option is attached
with `=`. Reverting the fix makes 5 tests fail with
`filter "overlay" attaches its first option with ":" instead of "="`.

### 2. B-roll and pictures did not appear, and nothing said so

`setpts=PTS-STARTPTS` puts a trimmed clip at time 0. A four-second clip then
exists only from 0 s to 4 s — so an overlay enabled at 11 s **had nothing to
composite**. The export succeeded, the file was exactly the right length, the
audio was right, and the B-roll was simply absent.

This is the worst class of failure this product can have: a silent wrong answer.
Fixed with `setpts=PTS-STARTPTS+<start>/TB`, which moves the clip onto the
moment it belongs to. Guard added asserting the shift is present.

## What was verified by running it

### 1. Three real files were classified by looking at their bytes

```
picture.png   201  image  800x600      no length      2,812 bytes
music.mp3     201  audio  no picture   20.000 s     321,035 bytes
broll.mp4     201  video  1280x720     10.000 s     150,982 bytes
```

The rule held on real files: ffprobe reports no `format.duration` for a PNG,
and no video stream for an MP3. No file extension was consulted.

**Uploading created no change set.** Revision moved 4 → 5 → 6 → 7 across the
three uploads while `changeSets.length` stayed at 2 throughout.

### 2. Five edits accepted, none blocked

title, callout, B-roll clip, still picture, music — revisions 8 through 12,
every `blockedReason` null.

### 3. First export — everything drawn, in the file

```
duration   30.033008 s      video h264 1920x1080 30/1
audio      aac 48000 Hz 2 channels
```

Frames pulled straight out of the exported MP4:

| Moment | What the frame contains |
|---|---|
| 2.5 s | Title "How we edit" over subhead "in under a minute", centred, dark plate |
| 7.0 s | Yellow callout rectangle with a labelled "look here" plate above it, plus the existing nameplate |
| 13.0 s | B-roll test pattern in the top-left, letterboxed inside its box, not stretched |
| 18.5 s | The blue picture in the lower right at 0.9 opacity — the chair behind it is faintly visible |
| 27.0 s | Nothing drawn |

### 4. The music is really there, and really stops

A narrow 220 Hz band measurement was **not sensitive enough** to prove this: the
music at -18 dB measures -39.6 dB in that band while the speech measures -32.7,
so adding it moves the reading by 0.7 dB. That is exactly what "quiet enough to
talk over" means, and it is why the first measurement looked like a failure.

The definitive test subtracts the original audio from the exported audio:

```
  5 s  (song playing)   export minus original   -42.5 dB   ← 25.7 dB of signal
 23 s  (song finished)  export minus original   -68.2 dB   ← nothing but codec noise
```

The song is 20 s and the video is 30 s. The music stops when the song runs out
and is **not looped**, exactly as ADR-007 states.

### 5. A cut, and what each family did

Cut at 5.0 s, then removed the opening.

```
  title      source 1-4 s     footage deleted   → BLOCKED, SOURCE_SPAN_REMOVED
  callout    source 6-9 s     survived          → moved to 1-4 s of the cut
  B-roll     source 11-15 s   survived          → moved to 6-10 s
  picture    source 17-20 s   survived          → moved to 12-15 s
  nameplates survived
  MUSIC      not anchored to footage            → NOT BLOCKED
```

**The music was the only overlay a cut could not touch.** That is the whole
reason it is anchored to the finished video, and it held.

### 6. Second export, after the cut

```
duration   25.033 s        (30.033 - the 5.000 removed, exactly)
```

Frames from the cut export:

- **2.0 s** — the callout, which was at source 6 s. 6 - 5 = 1 s, and it is on
  screen through 4 s. Correct.
- **8.0 s** — the B-roll, which was at source 11 s. 11 - 5 = 6 s. Correct.

Music after the cut, measured the same way, against the original offset by the
5 s that was removed:

```
  export  1 s  vs original  6 s    -42.4 dB   ← music playing
  export 18 s  vs original 23 s    -50.1 dB   ← song has ended
```

## Test and build state

```
  edit-domain      236
  render-contract   48
  intent-domain     27
  api              228   (was 220)
  web              210
  ------------------------
  total            749 passing; all five workspace builds clean
```

## Limitations — what this does NOT prove

- **The B-roll and the music were synthetic** — an FFmpeg test pattern and a
  220 Hz sine. A real phone clip and a real song have not been through this.
- **The owner has not run it.** G5C-01, G5C-10, and G5C-11 remain open.
- **The on-screen controls were not driven by hand.** The Add panel, the upload
  route, and the preview layers are built and type-checked, and the API path
  behind them was exercised directly. Clicking through them in the browser is
  not done.
- **A callout cannot be moved or resized on screen.** It appears in a fixed
  sensible place.
- **One frame rate, one resolution, one language.**
- **No repair panel** for any of the four new families: an edit can be created
  and undone, but not adjusted in place.

## Side effect on stored projects, stated

Every saved project was upgraded from schema v3 to v4 on open, stamping
`mediaKind: 'video'` on each asset. That is a restatement of a fact — v3 could
hold nothing else — and no timing, edit, or pixel changed. Projects were
verified to reopen normally afterwards.
