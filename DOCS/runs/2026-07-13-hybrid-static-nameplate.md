# Run Evidence: Hybrid static nameplate

- Date: 2026-07-13
- Goal: G1
- Candidate: hybrid browser preview plus FFmpeg-native export
- Fixture: `static-nameplate-01`
- Contract: `renderer-spike/v1`
- Machine context: Windows, Python 3.13.5, FFmpeg N-122089-g37858dc6bd-20251211
- Canvas: 1280 x 720, 30 fps
- Source duration: 5 seconds
- Nameplate interval: 1.000 seconds inclusive through 4.000 seconds exclusive

## Test-first evidence

Expected RED:

    python -m pytest spikes/renderer/tests/test_hybrid_candidate.py -q

The focused run failed because `spikes.renderer.hybrid_candidate` did not
exist. The sandbox also denied pytest's default Windows temporary directory;
this was an environment failure separate from the expected missing-adapter
failure.

GREEN runs used an explicit ignored project-local pytest directory:

    python -m pytest spikes/renderer/tests/test_hybrid_candidate.py -q --basetemp spikes/renderer/work/task1-pytest-temp -p no:cacheprovider
    python -m pytest spikes/renderer/tests -q --basetemp spikes/renderer/work/task1-all-pytest-temp -p no:cacheprovider

Results: 3 focused tests passed; 37 renderer tests passed.

## Measured results

The project-owned measurement loaded the validated fixture once, generated a
synthetic source through the existing safe FFmpeg helper, then performed three
preview generations and three exports. Commands were argument lists passed to
`subprocess.run`; no shell string or `shell=True` was used.

- Preview-document generation: 0.0015254s, 0.0016815s, 0.0014983s
- Average preview-document generation: 0.0015684s
- Preview SHA-256 on all three runs: `5592078341e50260927c64a070d3522573080e683ecdce0e6d1fea86025293f8`
- FFmpeg export: 0.8844302s, 0.9174272s, 0.9501123s
- Average FFmpeg export: 0.9173232s
- Export SHA-256 on all three runs: `c5aba3067b8c4fe5d3178ee19ea87dfd5a6d88e18cf32266a3a4a34ac3584736`
- Output size: 13,515 bytes
- Probe: valid 1280 x 720, 30/1 fps, 5.0-second MP4
- Source SHA-256 before and after: `7c7c7d8091e326a2e3f821aa7b0cf9a05873ea8834ca2a42fa3a960619d437a3`

## Evidence statement

Verified fact: for this one static synthetic fixture on this Windows machine,
the adapter maps one validated request to repeatable browser markup and
repeatable FFmpeg output while leaving source bytes unchanged.

Verified fact: preview markup and export arguments preserve the same requested
text, normalized placement, and time window at the contract level.

Unknown: preview-to-export pixel fidelity. No pixel comparison was run.

Unknown: HyperFrames runtime behavior. HyperFrames was not installed or
executed in this run.

## Limitations

- Synthetic source, not an owner video
- Static nameplate only
- No audio in the synthetic source or export
- No browser playback, seek, or interaction timing measurement in this run
- No preview-versus-export screenshot or pixel comparison
- No easing, spring/bounce, transition, tracking, or multi-layer evidence
- Same-machine repeatability does not prove cross-machine reproducibility
- Deployment cost is an architecture estimate, not a deployed benchmark
- Generated artifacts remain ignored and are not repository evidence by themselves
