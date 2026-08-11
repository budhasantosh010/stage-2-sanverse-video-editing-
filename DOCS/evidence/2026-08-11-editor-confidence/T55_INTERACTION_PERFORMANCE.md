# T5.5 Interaction Performance

## Machine evidence

- full regression: **2,510/2,510 PASS**;
- long-form bounds and Timeline virtualization suites PASS;
- representative Timeline view-model/decoration tests remain bounded;
- one-video Preview/Canvas suites PASS;
- all-workspace production build PASS.

T5.5 pointer changes remain presentation/draft work and do not introduce full-project serialization, export-plan compilation, whole-media decoding or FFmpeg execution during ordinary pointer movement.

## Real-browser observation

Microsoft Edge 151 completed the real Razor/select/Escape workflow, Inspector draft/reset workflow and sustained playback without runtime/console/HTTP failures. Playback advanced normally with one native video and no revision churn from presentation-only Inspector work.

The responsive evidence pass also installed a `PerformanceObserver` for `longtask`. It intentionally triggered full-app device-metric changes and screenshot captures and therefore recorded long tasks up to 839 ms. **Those samples are resize/capture workload and are not pointer-latency measurements.** They are retained in `t55-browser/t55-responsive-report.json` for honesty, not presented as edit latency.

The browser harness used here does not provide a trustworthy end-to-end pointer-event timestamp → painted-frame p50/p95 measurement. T5.5 therefore records bounded architecture/tests and direct real-browser interaction success instead of inventing p50/p95 values.
