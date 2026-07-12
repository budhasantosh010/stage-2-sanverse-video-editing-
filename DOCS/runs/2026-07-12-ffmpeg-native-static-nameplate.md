# Run Evidence: FFmpeg-native static nameplate

- Date: 2026-07-12
- Goal: G1
- Candidate: FFmpeg-native
- Fixture: static-nameplate-01
- Contract: renderer-spike/v1
- Machine context: Windows, Python 3.13.5, FFmpeg N-122089-g37858dc6bd-20251211
- Canvas: 1280 × 720, 30 fps
- Source duration: 5 seconds
- Nameplate interval: 1.000 seconds inclusive through 4.000 seconds exclusive
- Placement: normalized lower-right bounds converted to x=819, y=490, width=358, height=115

## Command

    python -m spikes.renderer.run_ffmpeg_native --request spikes/renderer/fixtures/static-nameplate-v1.json --work-dir spikes/renderer/work/ffmpeg-native-static --font C:/Windows/Fonts/arial.ttf --repeat 3

## Results

- Source-generation runs: 1.1610s, 1.1248s, 1.1029s
- Average source generation: 1.1296s
- Edit-render runs: 0.7040s, 0.7478s, 0.6948s
- Average edit render: 0.7155s
- Output size: 13,515 bytes
- Output SHA-256 on all three runs: c5aba3067b8c4fe5d3178ee19ea87dfd5a6d88e18cf32266a3a4a34ac3584736
- Probe: valid 1280 × 720, 30/1 fps, 5.0-second MP4
- Visual inspection at 2.0 seconds: correct primary/secondary text and lower-right placement

## Evidence statement

The FFmpeg-native adapter is deterministic across three repetitions of this one static synthetic fixture on this machine. This does not prove determinism across other machines, FFmpeg builds, codecs, fonts, animations, audio, long videos, or every editing primitive.

## Limitations

- Synthetic source, not a real talking-head recording
- Static nameplate only
- No audio
- No preview-versus-export pixel comparison yet
- No easing, spring/bounce, transition, or multi-layer test
- Timing includes local process startup but not UI/API orchestration
- Generated media remains ignored and is not repository evidence by itself

## Reproduce

Run the command above, inspect spikes/renderer/work/ffmpeg-native-static/ffmpeg-native-report.json, and compare the output hashes. The committed automated suite also runs real renders, ffprobe validation, hostile-character parsing, fail-closed contract cases, and single-run determinism semantics. A sanitized machine-readable manifest is committed beside this file.
