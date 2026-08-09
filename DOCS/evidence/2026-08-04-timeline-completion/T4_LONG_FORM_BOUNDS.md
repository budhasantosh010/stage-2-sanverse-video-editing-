# T4 Long-Form Bounds

T4 extends the existing 60-minute reasoning with 250 logical placements and 50 animated targets. Dense tracks cover 2, 8, 32 and the current maximum 64 keyframes.

Bounds:

- Timeline renders animation rows only for the active/expanded target, not all 50 animated targets simultaneously.
- Each active property row projects only keyframes within the current visible Timeline range plus bounded overscan.
- The current per-track domain limit remains 64 keyframes.
- Graph renders exactly one active property and samples the shared evaluator with a hard 48..640 sample bound regardless of project duration or browser width.
- Pure lane/graph projection makes no derived-media request, object URL, AudioContext, video element or accepted-edit request.
- Pointer movement operates on detached track state and calls no server accepted-edit path until release.
- Existing Gate-D filmstrip/waveform media-analysis concurrency/cache bounds remain unchanged; T4 adds no derived-media process.

A focused 60-minute test proves a dense 64-keyframe property mounts only the zero-to-few diamonds that actually fall inside the current visible window plus bounded overscan; it never mounts the whole project's keyframe set. Graph sampling at a 4,000px test width remains at or below the hard 640-sample ceiling.
