# ADR-DERIVED-MEDIA-EXECUTION-V1 — who actually decodes the pictures and the sound

Status: accepted · 2026-08-04 · supersedes nothing · Gate P1-F.1A D

---

## The plain-language problem

The timeline currently draws every piece of footage as a coloured rectangle with
a name on it. A person editing their own video cannot find anything that way.
They know their video by what it LOOKS like — "the bit where I hold up the
book" — and by what it SOUNDS like — "the gap before I start talking again".

So two things have to appear inside each rectangle:

```
  a piece of video  →  a row of small pictures taken from the video itself
                       (an editor calls this a FILMSTRIP)

  a piece of sound  →  a shape showing where it is loud and where it is quiet
                       (an editor calls this a WAVEFORM)
```

Both are DERIVED MEDIA: they are made from the user's files, they are not facts
the user typed, and they can always be made again. That single sentence decides
almost everything below.

The question this document answers is only: **which half of the program does the
actual work of making them — the web page, or the local server?**

---

## The decision

A **hybrid**. The browser decides *what is needed*; the server *makes it*.

```
 ┌──────────────────────── THE BROWSER (apps/web) ─────────────────────────┐
 │                                                                          │
 │  what part of the timeline is on screen right now                        │
 │  which thumbnails that stretch needs   (planFilmstrip)                   │
 │  which blocks of sound that stretch needs (planWaveformBlocks)           │
 │  asking for the same thing only once   (deduplication)                   │
 │  stopping asking when the user scrolls away (cancellation)               │
 │  holding a fixed number of finished ones (bounded cache)                 │
 │  drawing them                                                            │
 │  throwing them away properly                                             │
 └──────────────────────────────────────────────────────────────────────────┘
                                    │
                        one ordinary web request per item
                                    │
                                    ▼
 ┌───────────────────── THE LOCAL SERVER (apps/api) ───────────────────────┐
 │                                                                          │
 │  working out which file on disk that is, safely                          │
 │  pulling out ONE real frame at ONE exact moment (FFmpeg)                 │
 │  decoding ONE bounded stretch of sound and measuring it (FFmpeg)         │
 │  shrinking a picture to a bounded size (FFmpeg)                          │
 │  never running more than a few of those at once                          │
 │  keeping finished ones in a throwaway folder                             │
 └──────────────────────────────────────────────────────────────────────────┘
```

### Why the split falls exactly there

The browser is the only place that KNOWS what is on screen. Scroll position,
zoom, and lane height live in the page and nowhere else. Sending that to the
server so the server could decide would be sending a fast-changing fact across a
boundary many times a second, and the answer would already be stale on arrival.

The server is the only place that CAN decode reliably. It already has FFmpeg —
the same program that produces the final exported video — and FFmpeg can seek to
one exact moment of any file the user is likely to own, including the formats a
browser refuses to play. If the browser decoded instead, the filmstrip would be
missing for exactly the files a browser cannot open, and the user would be told
their footage was broken when the export would have handled it fine.

**The trade-off being accepted:** every thumbnail costs a round trip to the local
server and one short FFmpeg run. That is slower per item than decoding in the
page would be. It is paid for by correctness (every format works), by bounds (a
few processes, never hundreds of decoders), and by reuse (the folder on disk
survives a page reload, so a project opened twice decodes once).

---

## The five alternatives that were rejected, and what each would have cost

### A. One `<video>` element per thumbnail — REJECTED

The obvious approach: put a hidden video player behind each thumbnail, seek it,
draw the frame.

A sixty-minute project with 250 pieces of footage needs a few hundred thumbnails
on screen at once. Each `<video>` element is a real hardware decoder. Browsers
allow a small number of those — commonly under twenty — and past that they fail
silently or evict each other. So most thumbnails would simply never appear, on
the longest projects, which is where they matter most.

It would also fight the one real player: the preview. Two hundred decoders
competing with the one the user is watching means dropped frames in playback.

### B. Seeking the main preview video to grab frames — REJECTED

Reuse the player the user is already watching: jump it to each moment, draw the
frame, jump back.

This breaks the single rule that makes playback trustworthy — **one playback
authority**. The picture the user is watching would jump around while the
timeline filled in. Pausing to build a filmstrip is the program taking the
user's video away from them to do its own housekeeping.

### C. Decoding the whole audio file with `AudioContext` — REJECTED

`decodeAudioData` needs the ENTIRE file in memory, decompressed. One hour of
stereo CD-quality sound is about 635 megabytes once decompressed
(2 channels × 48,000 samples × 4 bytes × 3,600 seconds ≈ 1.4 GB at 32-bit float;
≈ 635 MB at 16-bit). The timeline might be showing twelve seconds of it.

Memory would therefore be tied to how long the user's music is, not to how much
of it is on screen — the exact opposite of a bound. Long projects would kill the
tab.

### D. Saving thumbnails and waveforms into the project — REJECTED

Derived media can always be made again from the file. Putting it in the project
would:

- grow the saved project by megabytes without adding one fact;
- make every scroll a change to the project, so every scroll would take a
  revision number and a slot in Undo — the user would press Undo expecting to
  take back an edit and instead take back a thumbnail;
- let a thumbnail outlive the file it came from, so a replaced clip could keep
  showing the old picture.

**Derived media creates no operation, no change set, no revision, and no history
entry. Ever.** That is the hard rule this ADR exists to fix in place.

### E. Making everything up front — REJECTED

Decode the whole project the moment it opens.

A sixty-minute project is roughly 14,400 possible quarter-second thumbnails and
3,600 blocks of sound. That is minutes of work and gigabytes of memory before the
user can touch anything, almost all of it for parts of the timeline they will
never scroll to in that session. Work is done for what is on screen, plus a
margin either side, and no more.

---

## Cache ownership and invalidation

Two caches, each owned by exactly one side:

| Where | Holds | Limit | Emptied when |
|---|---|---|---|
| browser memory | decoded pictures, peak numbers | a fixed COUNT of entries | evicted least-recently-used; whole cache dropped when the project changes |
| server disk | the produced picture files and peak files | a per-project entry budget | oldest-access entries removed; whole folder safe to delete at any time |

**Invalidation is solved by naming, not by expiry.** Every piece of derived media
is named by an immutable fingerprint of the FILE'S BYTES (the first sixteen
characters of its SHA-256 checksum) as well as by which moment and what size. If
a file is ever replaced with different bytes, its fingerprint changes, so the new
request has a NEW name and cannot collide with the old one. There is no window
during which a stale thumbnail can be served.

The fingerprint deliberately carries no filesystem path, no inode, no local URL
and no server path. It is a checksum of content and nothing else, so it can
safely be part of a web address.

---

## Process limits

| Kind of work | At once | Why that number |
|---|---|---|
| pulling out a video frame | 2 | Two keeps a modest machine responsive while the user is also playing back video. Each run is short — a seek plus one frame. |
| decoding a stretch of sound | 1 | Sound decoding reads more of the file than a frame seek does, so it is the heavier job. One at a time. |
| queue of jobs waiting | 64 | Past this the answer is a truthful refusal (`ANALYSIS_LIMIT_EXCEEDED`) rather than an unbounded backlog. |
| time one job may take | 20 seconds | A stuck FFmpeg is killed rather than held forever. |

Two requests for the SAME name share one job. Ten clips showing the same moment
of the same recording cause one FFmpeg run, not ten.

All four numbers live in one configuration object so they can be raised on a
strong machine without hunting through the code.

---

## Security

Everything here reuses the rules the exporter already lives under:

- The project must own the asset. The project's own saved state is consulted;
  a file left on disk by a failed upload can never be reached.
- No filesystem path ever comes from the browser. The browser sends an asset ID
  and a fingerprint; the server resolves the path itself.
- Paths are checked against symbolic links and hard links, exactly as
  `resolveAssetPath` already does for playback and export.
- Cache filenames are hashes of the validated request. A name a user typed never
  appears in a path.
- FFmpeg is run with no shell, so nothing that came from a user can be read as a
  command.
- Refusals never contain a path or any FFmpeg command text.

## Consequences on a local desktop

This is the situation today: the server is on the same machine, over the loopback
address. The cost of a request is a few milliseconds; the real cost is the FFmpeg
run, which the browser could not have avoided anyway. Disk use is bounded per
project and the whole folder can be deleted with no effect on the user's work.

## Consequences if this is ever hosted on the web

Stated plainly because it is a real future cost: every thumbnail becomes a
billable server CPU-second and a byte of egress. A hosted version would want the
cache moved to shared storage and the per-project budget raised, and would likely
want the browser to do the work itself where the format allows it (see below).
Nothing in this design blocks that — the browser already owns planning, and the
place work is produced is a single interface.

## Cleanup and failure states

- A produced file is written under a temporary name and renamed into place, so a
  crash leaves a stray temporary file, never a half-written thumbnail.
- A file that fails to read back is deleted and made again, so a corrupt entry
  cannot poison the cache permanently.
- A failure is NOT cached. A file that was locked for one second must not be
  reported missing for the rest of the session.
- A dropped web request cancels its job if nothing else is waiting on it.
- Nothing is ever left running detached.

Every failure is one of a closed list of refusal codes, and every one of them
leaves the timeline fully editable. Derived media failing is a decoration
missing, never a project that will not open.

## The future alternative, named so it is not re-litigated

Browsers are gaining `WebCodecs`, which can decode one frame at a time in the
page without a `<video>` element and without the decoder limit that killed option
A. When it is available for the formats users actually bring, it becomes a
legitimate second producer behind the same interface: the browser would keep
planning exactly as it does now and simply satisfy some names locally.

That is an optimisation, not a redesign, and it is deliberately not being done
now — it would be a second way of producing the same picture, and two producers
that can disagree is how a filmstrip starts showing a different frame from the
one the export contains.

## What this does NOT touch

Derived media has no effect on the project, on the preview, or on the exported
file. The exported video is byte-for-byte what it would have been with no
filmstrips at all. That is asserted by test and probed on a real export.
