# T3 Test Results

Starting T2 baseline: **2,292 / 2,292**.

Final T3 repository gate: **2,345 / 2,345**.

- API: 403 / 403
- Web: 1,297 / 1,297
- edit-domain: 500 / 500
- intent-domain: 27 / 27
- render-contract: 118 / 118

The first parallel full-web sweep produced only two 5-second timeout failures under contention (`StudioMediaBinIntegration`, `StudioResponsiveContinuity`) with no assertion failure. Those two passed 10/10 sequentially, then the complete web suite passed 1,297/1,297 using the repository's stable single-fork policy.

Focused gates:
- Trim View + identity + Timeline/edit-point: 46/46
- 60-minute bounds + precision/shuttle/audio/numeric: 65/65
- broad Timeline/Studio T3 integration: 227/227

All-workspace production build: PASS. Web build: 289 modules, CSS about 125.11 kB, JS about 870.66 kB. Existing runtime nameplate-font warning and Vite >500 kB advisory remain non-blocking; T3 added no production dependency.

Ownership checker passed before every T3 commit.
