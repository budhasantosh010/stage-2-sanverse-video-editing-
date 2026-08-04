# Gate D — test results

2026-08-04 · Windows · every suite run sequentially
(`--pool=forks --poolOptions.forks.singleFork=true`)

```
  edit-domain        378
  render-contract     80
  intent-domain       27
  api                341   (268 before this gate → +73)
  web                897   (806 before this gate → +91)
  ─────────────────────────
  TOTAL            1,723   (baseline 1,559 → +164)
```

`npm run build` across all five workspaces: **exit 0**. The build type-checks
test files as well as source, which `vitest` alone does not.

No assertion was weakened. Nothing was skipped. No decoder test was substituted
for a synthetic one.

## What the new tests hold

### Server — 73 tests

| file | holds |
|---|---|
| `analysis-request.test.ts` | every unknown, missing, repeated or out-of-range value is REFUSED, never repaired; asset ids and versions must be exactly what they claim; the moment handed to the decoder is exact rather than rounded; cache filenames are hashes and never contain anything a person typed |
| `analysis-coordinator.test.ts` | at most 2 frames and 1 sound decode at once; the two limits are separate so pictures cannot be starved out; ten requests for one thing become one job; a full queue refuses truthfully; work stops when the last waiter leaves and keeps going while one remains; a stuck decoder is killed; a failed job frees its slot |
| `media-analysis-service.test.ts` | the exact moment, size and argument order handed to FFmpeg; first frame, last frame, past-the-end; unknown file; changed bytes; missing file; wrong kind of preview; no path or command text in any error; second request served from disk; ten simultaneous requests run one decoder; a damaged cached file is remade; a failure is NOT remembered; the original recording is found beside the project under both spellings; silence flat, a bang visible, a bang in one ear at full height, a short final block in the right place; **a mono recording measured at its real height** |
| `media-analysis-routes.test.ts` | bytes and content type; `immutable` caching; each address routes to its own kind; a bad project id is refused without asking the maker; an unknown query name is refused; refusals pass through with their code; no path or command text escapes; a browser that has gone away is told nothing; process counts appear in diagnostics |

### Browser — 91 tests

| file | holds |
|---|---|
| `media-analysis-identity.test.ts` | the version comes from the file's own checksum and is refused if it is not one; different bytes mean a different name; a picture's name has no moment in it; a name read from elsewhere is refused for an unknown kind, an extra field, a missing field, a fractional number, or an older schema; the address contains every part of the name and nothing else; loudness numbers outside 0–1 are refused rather than drawn |
| `media-analysis-controller.test.ts` | at most six at once and the most important first; two clips wanting one thing ask once; nothing already held is asked for again; scrolling away stops work in flight and keeps what is already made; an answer for a project nobody is looking at is ignored; every dropped picture is closed and counted; disposing closes everything and stops everything; missing and failed are different states; a doomed request is not repeated on every scroll; retry works |
| `timeline-derived-media.test.ts` | pictures come from the recording offset by the trim; moving a clip changes nothing; a split reuses everything but at most its new cut point; the same shot used twice costs one decode; a picture never draws past its clip; nothing is asked for when a clip is too narrow or a row too short; per-clip and per-plan ceilings, and both SAY when they bite; the dialogue row takes the same moment of the same file as the picture; typed words and un-accepted proposals get nothing; a sixty-minute project stays bounded |
| `TimelineDecorations.test.tsx` | real pictures drawn on V1 and V2, one picture for a still image, a real waveform on A1 and A2, a muted track still readable, silence flat against a bang; missing and failed states SAID rather than left blank; decorations never take a click, a drag or a trim; trim handles still appear; the header and its row share one height; rows shrink on a small screen but not merely because the timeline pane is narrow; a bounded number of clips mounted on a long project; a selected clip stays mounted off screen; no edit, no revision, no Undo entry |
| `long-form-bounds.test.ts` | unchanged from Gate D part one, extended for the version in the name |

## The test infrastructure fix that came out of this

The web suite had **no global React Testing Library cleanup**. Every test's
screen stayed in the page for the next one, so a query like "find the thing with
the status role" could find three of them and fail — in whichever test happened to
run last, not the one that was broken. That makes the suite depend on the order
it runs in, which is how a real failure gets dismissed as flakiness. It is now in
`apps/web/src/test/setup.ts`.

The same file now provides a recording 2D drawing surface, because jsdom has
none. Without it there would be no way to assert that a real picture reached the
screen — only that an empty element existed, which proves nothing.
