# T2 Rate Stretch, Direct Audio, and Real Normalization Evidence

Date: 2026-08-07
Branch: `agent/g6-g8-local-alpha`
Parent commit: `2ba778cdb0fd404bb680544626fe6ca11a859b2a`

## Implemented authority

- Rate Stretch is a Timeline gesture over the existing `set-clip-time-transform` operation.
- The dragged duration is converted to the same reduced rational playback rate used by the Speed panel.
- Pointer movement is detached presentation state. Pointer release creates one operation and one Undo step. Escape and pointer cancellation create no operation.
- Direct A1 controls edit gain, fade-in, fade-out, and pan through the existing full-state `set-clip-audio` operation.
- Direct A2 controls edit gain and both fades through the existing `set-music` operation. A2 does not invent a pan field.
- Every direct audio commit carries untouched fields forward. Changing gain does not reset fades or pan; changing a fade does not reset gain.
- Loudness analysis is derived media, not an edit. Analyze and Cancel do not change the project. Only explicit Apply sends the existing audio operation.

## Normalization contract

The server accepts a closed `audio-normalization` request containing:

- immutable asset ID and asset-version checksum prefix;
- exact source start and end ticks;
- a minimum 0.4-second interval;
- a bounded maximum interval;
- no path, URL, filename, or caller-selected command arguments.

The cache key includes the exact source bytes, exact source interval, and analysis version `ffmpeg-loudnorm-v1`. JSON evidence is stored in the existing bounded derived-media cache under `analysis/` and is safe to delete and regenerate.

FFmpeg runs `loudnorm` with the creator target:

- integrated loudness: `-16 LUFS`;
- true-peak ceiling: `-1 dB`;
- loudness range target: `11 LU`.

The recommended gain is the smaller of the loudness-target gain and the true-peak-safe gain, then clamped to the existing clip gain bounds. Silence or malformed loudness output is refused with `AUDIO_SILENT`; no guessed gain is produced.

## Automated verification

### Focused web matrix

Command:

```text
npm test --workspace @sanverse/web -- --run src/features/timeline/timeline-speed-plan.test.ts src/editor/timeline/TimelineRateStretchHandle.test.tsx src/editor/timeline/TimelineAudioDirectControls.test.tsx src/features/timeline/timeline-item-operations.test.ts src/features/timeline/timeline-gesture-adapter.test.ts src/features/media-analysis/media-analysis-identity.test.ts
```

Result: **6 files, 110 tests passed**.

This covers rational rate derivation, preview/commit equality, unsupported duration refusal, detached pointer drafts, one release/one edit, Escape/cancel, A1 pan preservation, A2 full-state music edits, source-versioned normalization evidence, Analyze-before-Apply, and cancellation.

### Focused API matrix

Command:

```text
npm test --workspace @sanverse/api -- --run src/media-analysis/analysis-request.test.ts src/media-analysis/media-analysis-service.test.ts src/media-analysis/media-analysis-routes.test.ts
```

Result: **3 files, 70 tests passed**.

This covers closed query parsing, interval bounds, hashed cache identity, JSON cache integrity, real loudnorm argument construction, true-peak protection, silence refusal, cancellation, caching, route headers, and no path/command leakage.

### Complete web suite

Command:

```text
npm test --workspace @sanverse/web -- --run --pool=forks --poolOptions.forks.singleFork=true
```

Result: **115 files, 1,222 tests passed**.

### Complete API suite

Command:

```text
npm test --workspace @sanverse/api -- --run
```

Result: **31 files, 396 tests passed**.

## Real FFmpeg pitch proof

A six-second, 48 kHz, mono 440 Hz PCM source was generated with FFmpeg. The two 2x paths used the same filters emitted by the render adapter:

- pitch kept: `atempo=2`;
- pitch deliberately changed: `asetrate=96000,aresample=48000`.

Measured from decoded PCM with a Hann-windowed FFT after removing 100 ms from both ends:

| Artifact | Duration | Dominant frequency |
|---|---:|---:|
| Source | 6.000000 s | 440.000 Hz |
| 2x, pitch kept | 2.997271 s | 440.072 Hz |
| 2x, pitch off | 3.000000 s | 880.000 Hz |

This proves the two controls are materially different: the maintained-pitch path keeps the tone at approximately 440 Hz, while the deliberate tape-speed path raises it by one octave.

## Real FFmpeg loudness proof

The same real source was measured with the production loudnorm settings. FFmpeg reported:

- integrated loudness: `-21.75 LUFS`;
- true peak: `-18.06 dB`;
- loudness range: `0.00 LU`.

The loudness target permits `+5.75 dB`, while the true-peak ceiling permits `+17.06 dB`; therefore the safe recommendation is `+5.75 dB`. The server uses the smaller value, exactly as required.

## Remaining program-level proof

The final T2 master browser workflow will repeat Rate Stretch, direct audio, normalization review/apply, sustained playback, Undo/Redo, reopen, and MP4 export in the real browser together with the later T2 features. This file records the completed implementation and automated/real-media proof for this focused slice; it does not substitute for that final integrated walkthrough.
