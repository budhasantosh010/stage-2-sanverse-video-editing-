# T2 Bounded Reverse Preview and Export Evidence

Date: 2026-08-07
Branch: `agent/g6-g8-local-alpha`
Parent commit: `31614907198e52b98de8b4e93ae1e68a22ff7e7a`

## Implemented authority

- Reverse remains the existing canonical `set-clip-time-transform` operation with `direction: reverse`.
- The shared product/resource boundary is thirty seconds of source footage per reverse clip.
- The Speed panel sends forward/reverse through the same planner. A bounded reverse creates one operation and one Undo step; a longer clip is refused with a split-first recovery message.
- Preview never uses negative playback rate and never shows the original footage forwards. It requests one exact prepared reverse proxy for the active reverse segment, pauses with an explicit status until ready, then plays that proxy forwards through the one existing video element.
- The canonical render plan is not replaced or mutated. A browser-only playback projection swaps the targeted reverse segment to a synthetic prepared asset beginning at source tick zero.
- Export reads the canonical reverse direction and uses FFmpeg `reverse` and `areverse`. The exporter enforces the same thirty-second bound before command creation.

## Derived-media security and resource bounds

The reverse request is closed and contains only:

- validated project route identity;
- immutable asset ID;
- checksum-derived asset version;
- exact source start and end ticks.

It contains no path, filename, URL, codec string, or user-supplied command argument. Its cache identity includes exact bytes, exact interval, and `ffmpeg-reverse-preview-v1`.

Prepared video jobs run in a separate coordinator lane with `maxConcurrentVideos: 1`, so a reverse encode cannot starve bounded frame and waveform work. The source interval is capped at thirty seconds, the generated proxy is capped at four MiB, and the cache remains LRU-bounded and disposable.

The proxy is H.264/AAC MP4 with:

- 854×480 fixed canvas;
- aspect-preserving scale;
- even dimensions enforced before H.264;
- centered padding;
- `yuv420p`;
- bounded 700 kb/s video rate and 64 kb/s audio;
- `+faststart`;
- metadata stripped.

Object URLs are revoked and in-flight requests are aborted when the active segment changes or Studio unmounts.

## Automated verification

### Focused API/render matrix

Result: **6 files, 129 tests passed**.

Coverage includes closed request parsing, minimum/maximum intervals, exact cache identity, one-at-a-time video execution, frame/waveform independence, audio/no-audio FFmpeg construction, source-bound refusal, cache reuse, route mapping, reverse/areverse export filters, and over-thirty-second export refusal.

### Focused web matrix

Result: **5 files, 152 tests passed**.

Coverage includes bounded reverse planning, enabled Speed-panel control, prepared playback projection, wrong-media refusal, active-segment preparation, no forward fallback, explicit preparation/error states, one real video element, and object-URL cleanup.

### Complete suites

- Edit domain: **34 files, 488 tests passed**.
- Render contract: **10 files, 119 tests passed**.
- API: **31 files, 403 tests passed**.
- Web, stable single-fork policy: **115 files, 1,231 tests passed**.
- All-workspace production build: **passed**.

## Real FFmpeg proof

A real three-second source was generated as:

1. one second red;
2. one second green;
3. one second blue;
4. continuous 440 Hz audio.

The production-equivalent reverse proxy command was run against the full exact interval. The first and last decoded proxy frames were reduced to one RGB pixel:

| Measurement | RGB |
|---|---|
| First reverse frame | `(0, 0, 255)` — blue |
| Last reverse frame | `(255, 0, 0)` — red |

`ffprobe` reported:

- duration: `3.000000` seconds;
- video: 854×480;
- audio stream: present;
- file size: 42,240 bytes.

This proves actual frame order reversal, retained duration, retained audio, bounded dimensions, and a proxy far below the four-MiB ceiling.

## Defect found by real-media verification

The first real run revealed that aspect-ratio decrease alone could produce an odd 853-pixel width, which `libx264` refused. The production filter now uses `force_divisible_by=2` and pads into a fixed 854×480 canvas. The exact condition is covered by the service test and the successful real-media rerun above.

## Remaining program-level proof

The final T2 master browser workflow will repeat reverse selection, preparation, sustained playback, reopen, Undo/Redo, and real export together with Freeze, J/L cuts, transitions, and placement planners. This document records the completed focused reverse implementation and media proof.
