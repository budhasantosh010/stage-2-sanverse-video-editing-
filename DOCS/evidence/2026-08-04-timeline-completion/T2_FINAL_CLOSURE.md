# Gate T2 — final closure

Date: 2026-08-08

Gate T2 is **complete**. Gate T3 was not started.

This file is the final closure evidence for the speed, reverse, freeze, direct-audio, linked-audio, transition and advanced-placement work that began in `T2_SPEED_EVIDENCE.md` and continued through the later T2 evidence files.

## What is now complete

- Constant speed uses an exact rational playback rate, not a canonical float.
- Rate Stretch is a real Timeline end-handle gesture. Pointer movement is detached presentation state; release creates one accepted time-transform change or nothing.
- Reverse is an accepted time transform. Preview requests an exact bounded backwards MP4 for the active source interval; it never lies by showing the original footage forwards. Export uses the same direction through FFmpeg.
- Rate Stretch preserves the clip's existing direction. A reversed clip stays reversed after stretching.
- Freeze Frame is a distinct closed segment/edit, not `0x` speed. Its authored interval is silent and Undo removes the whole hold in one step.
- Direct A1/A2 controls expose gain and fades; A1 also exposes pan. Direct edits still route through the existing canonical audio operation.
- Loudness normalization is based on real local media analysis. Measurement is detached; only explicit Apply creates the audio edit.
- J- and L-cuts keep picture and sound as one clip identity while authoring a separate linked-audio source/composition window.
- The transition chooser exposes the transition styles Preview can truthfully show, duration entry/handle controls and linked-audio fade behavior. Unsupported two-shot-at-once transitions remain deliberately unavailable.
- Replace, Fit source to duration, Place on Top, Ripple Overwrite, Swap and Shuffle have bounded planners rather than Timeline-only policy.
- Project schema is `sanverse.project/v5`; render plan is `sanverse.render-plan/v8` for the new closed freeze/linked-audio/transition shape.
- Preview, accepted history, Undo/Redo, reopen and FFmpeg export share the same project/time authority.

## Final defects found during closure

Two real product defects were found by the final browser workflow and fixed before the gate was closed.

1. **Hold Frame routing.** The More-menu action could be enabled, but `Timeline.runToolbarAction` omitted `freeze` from the panel-opening branch, so pressing the command never opened the Hold Frame panel. `freeze` now follows the same presentation-only panel route as Speed/Transition/J-L. `Timeline.test.tsx` contains the regression: `opens the Hold frame panel from More`.
2. **Rate Stretch removed Reverse.** The Studio adapter passed `direction: 'forward'` to both Rate Stretch preview and commit. Stretching reversed footage therefore silently changed its direction. Both paths now carry `speedSubject.direction`; the final real browser operation remains `reverse` and the visible clip badge reads `1.63x Backwards` after the drag.

## Final automated gate

Command:

```text
npm test -- --run --pool=forks --poolOptions.forks.singleFork=true
```

Result: **2,292 / 2,292 passed**.

- API: 403 / 403
- Web: 1,248 / 1,248
- edit-domain: 496 / 496
- intent-domain: 27 / 27
- render-contract: 118 / 118

The count is one higher than the prior 2,291 baseline because the Hold Frame routing regression was added.

Production build:

```text
npm run build
```

Result: **exit 0** for API, Web, edit-domain, intent-domain and render-contract. Vite produced the normal runtime-resolved nameplate-font warning and the existing >500 kB chunk advisory; there was no build failure.

## Final real Microsoft Edge workflow

Evidence: `t2-master-browser-report.json` and `t2-master-screenshots/`.

Real project/media copy: `project_1ad7b832a52d6faf09da2390e97f729a`.
Browser: Microsoft Edge 151 (`Edg/151.0.0.0`).

The private verification copy began at revision 34 and finished at revision 44:

- 34: Studio opened with exactly one video element.
- 35: 250 ms Dip to White transition accepted.
- 36: Reverse accepted. The app emitted the exact reverse-preview request and the local API returned a bounded `video/mp4`, 114,597 bytes, HTTP 200.
- 37: direct gain keyboard edit accepted at +1 dB.
- 38: direct pan keyboard edit accepted at +1% right (`pan: 100`).
- 39: real local loudness evidence measured `-14.0 LUFS · peak -1.5 dB · use -2.0 dB`; explicit Apply accepted `-2.02 dB`.
- 40: real Rate Stretch handle gesture accepted. The clip is `1.63x Backwards`, proving Reverse was preserved.
- 41: a real 200 ms J-cut was accepted using the available source handle.
- 42: a 0.6 s Freeze Frame was accepted; one active freeze operation existed.
- 43: Undo removed the freeze entirely.
- 44: Redo restored exactly one freeze operation.
- Reopen preserved revision 44, the freeze operation and the one-video authority.

Responsive checks at 1440x900, 1024x768 and 390x844 reported no horizontal overflow. The complete run recorded **zero browser exceptions/console errors and zero failed HTTP responses**.

### Browser-proof limitation stated plainly

The Rate Stretch handle was driven by a synthetic `PointerEvent` inside the real Edge page, not a physical mouse. The actual React pointer path, planner and accepted server operation were used; unit/component coverage separately holds cancellation and bounds.

For Reverse, headless H.264 `currentSrc` timing is not stable enough to use as the primary proof. The closure therefore verifies the exact reverse-preview request emitted by the running app and validates the real returned bounded MP4. The accepted reverse operation and the post-Rate-Stretch `Backwards` state are also verified independently.

## Final real export

The browser started Export from revision 44.

- Job: `job_4b64c5a98804ea82399e36790255276d`
- Export: `export_4cea7bfad614fb71160cc70d2b6cf6c9`
- Attempts: 1
- Status: succeeded
- Render wall time: about 48.3 s
- Width/height: 1920x1080
- Duration: 24.841 s
- Size: 12,548,402 bytes
- SHA-256: `74b87648a971f4f62304ebf1532d761abc95d3a44fceef966725b1d4b90bf4d4`
- Video: H.264 High, 30 fps
- Audio: AAC-LC, stereo, 48 kHz

The SHA recorded by the renderer exactly matches the hash of the MP4 on disk. Start, middle and end frames were decoded and visually inspected. The opening black frame matches the project's existing intentional gap; normal landscape footage decodes in the middle; the portrait source at the end is correctly fitted into the 1920x1080 canvas with side bars.

The MP4 and those extracted inspection frames remain private runtime artifacts under `.sanverse-data` and are not committed.

Machine-readable export facts are in `t2-export-metadata.json`.

## Gate decision

**T2 CLOSED.** The acceptance rule is satisfied across accepted project state, Preview preparation, render contract, FFmpeg export, Undo/Redo, reopen, responsive Studio behavior, automated tests and production builds.

**T3 remains not started.** The separately owned Motion Graphics Library workstream was not integrated or modified by this gate.
