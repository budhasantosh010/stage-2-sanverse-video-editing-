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

Initial results: 3 focused tests passed; 37 renderer tests passed.

Spec-review RED added structural-output inspection and local deployment
measurement requirements. The focused run then failed with two missing
attributes: `inspect_structural_fidelity` and `measure_local_deployment`.
After the minimum implementation, 5 focused tests passed. The final complete
renderer suite at that review point passed 39 tests.

Quality-review RED then added valid adversarial text plus output-collision and
workspace-boundary cases. Five tests failed: one exposed truncation at an
escaped apostrophe and four exposed missing canonical path protections. After
escape-aware inspection and bounded export validation, 10 focused tests and
all 44 renderer tests passed.

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
text and time window. This is structural fidelity measured by parsing both
generated outputs, not an inference from their shared request:

- Preview text: `Santosh`, `Founder`
- Export text: `Santosh`, `Founder`
- Preview time window: 1.0 through 4.0 seconds
- Export time window: 1.0 through 4.0 seconds
- Preview normalized bounds: 0.64, 0.68, 0.28, 0.16
- Export normalized bounds: 0.63984375, 0.68055556, 0.2796875, 0.15972222
- Maximum normalized placement delta: 0.00055556
- Allowed pixel-rounding tolerance: 0.00069444 (half a pixel at 720 pixels)
- Structural-equivalence result: true
- Adversarial structural text: exact round-trip verified for apostrophes,
  commas, colons, backslashes, and HTML-like characters

Unknown: preview-to-export pixel fidelity. No pixel comparison was run.

Unknown: HyperFrames runtime behavior. HyperFrames was not installed or
executed in this run.

## Local deployment measurements

These are file and startup facts measured on this machine. They are not a
deployed bundle benchmark and must not be added together as if each existing
runtime would be newly shipped.

| Field | Measured value |
|---|---:|
| Hybrid project-owned adapter source | 13,660 bytes |
| Browser-composition adapter source | 3,983 bytes |
| FFmpeg adapter source | 5,099 bytes |
| Generated preview document | 1,864 bytes |
| Existing Chrome executable | `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe` |
| Existing Chrome executable file size | 3,985,048 bytes |
| Existing FFmpeg executable | `C:\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffmpeg.exe` |
| Existing FFmpeg executable file size | 540,672 bytes |
| FFmpeg version | N-122089-g37858dc6bd-20251211 |
| FFmpeg `-version` startup | 0.0734585s, 0.0719573s, 0.0804442s |
| Existing Node executable | `C:\\Program Files\\nodejs\\node.exe` |
| Existing Node executable file size | 91,426,304 bytes |
| Node version | v24.14.1 |
| HyperFrames runtime executed | no |
| HyperFrames package archive size | not measured; no archive is present in the tracked project |

Candidate comparison from these measurements:

- FFmpeg-native export requires the existing FFmpeg runtime. Its project-owned
  adapter is 5,099 bytes; the latest executable startup measurement averaged
  0.0752867 seconds.
- Browser preview uses the existing product browser. The generated fixture
  document is 1,864 bytes; browser startup and deployed bundle size were not
  measured.
- The selected hybrid combines those already-required preview/export surfaces.
  No additional third-party runtime was installed for this spike.
- Static HyperFrames metadata says it requires Node 22+, a browser, and
  FFmpeg. Compatible local runtimes exist, but HyperFrames archive size,
  installed dependency size, startup, rendering, and deployment cost were not
  measured because the runtime was neither installed nor executed.

Estimate, not measurement: avoiding another runtime is likely the lower-cost
first-loop integration. A real deployment benchmark is still required before
making a production infrastructure claim.

## Export safety boundary

- Output must resolve inside the explicit trusted renderer work directory.
- Canonically equal input/output paths, relative aliases, and existing hard
  links identifying the same file fail before a command is returned.
- The default trusted root is `spikes/renderer/work`; tests may inject a
  temporary trusted root owned by the test.
- FFmpeg resolves to an existing executable path from trusted application
  configuration or the local executable search path.
- Metadata subprocesses use argument arrays, no shell, and a five-second
  timeout. The generated export command is returned for a trusted caller to
  execute; the spike does not accept executable paths or commands from AI.

## Limitations

- Synthetic source, not an owner video
- Static nameplate only
- No audio in the synthetic source or export
- No browser playback, seek, or interaction timing measurement in this run
- No preview-versus-export screenshot or pixel comparison
- No easing, spring/bounce, transition, tracking, or multi-layer evidence
- Same-machine repeatability does not prove cross-machine reproducibility
- Local executable/source sizes are measured; deployed bundle and operational
  costs remain unmeasured
- Generated artifacts remain ignored and are not repository evidence by themselves
