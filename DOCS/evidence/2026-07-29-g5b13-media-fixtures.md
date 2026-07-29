# G5B-13 — frame-rate, audio, and boundary fixtures

Date: 2026-07-29

Three real H.264 MP4 fixtures were generated in the system temporary directory,
passed through the same trim, timestamp reset, frame-rate conform, pixel-format,
audio-trim, resample, and channel-layout stages used by the FFmpeg adapter, then
probed with frame counting enabled.

| Fixture | Source | Conformed result |
|---|---|---|
| Rational rate with audio | 30000/1001, 59 frames, 2.000 s, AAC audio | 30000/1001, 59 frames, 2.000 s, audio present |
| True VFR with audio | 90 frames over 2.000 s; reported `r_frame_rate=60/1`, `avg_frame_rate=2700/61` | explicitly conformed to 60/1, 120 frames, 2.000 s, audio present |
| Boundary and silent input | 30000/1001, exactly 3 frames, 0.100 s, no audio | 30000/1001, exactly 3 frames, 0.100 s, no audio |

The VFR policy is explicit conform, not guessed preservation: source timestamps
select the requested temporal span, then the graph's `fps=<nominal-rate>` stage
creates a constant-rate output. Audio is independently trimmed and resampled to
48 kHz stereo before joining the result.

This is focused renderer-boundary evidence. It is not a browser walkthrough and
does not replace the owner pacing gate in G5B-14.
