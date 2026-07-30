# P1-A performance observation

Date: 2026-07-30

The representative fixture contains:

- 50 effective video clips;
- 100 caption cues;
- 20 overlay placements;
- 1 music placement.

The focused test proves deterministic output, stable and unique IDs, correct ordering, exact item counts, and no input mutation.

Observed local test duration for the complete view-model test file was roughly 440–475 ms across runs. The large-fixture test itself was roughly 363–384 ms as reported by Vitest. This includes fixture construction, acceptance/replay, two projections, deep comparisons, ID checks, and mutation checks—not only projection time.

No hard wall-clock CI assertion was added. One Windows development machine cannot justify a universal performance guarantee.

One high-impact optimization was made before completion: the builder evaluates accepted project history once, then assembles effective composition, folded captions, folded overlays, traces, and blocked records from that one result. It does not replay the project separately for every lane.

P1-B should measure real render frequency and memoization needs after production integration rather than adding speculative caches in P1-A.