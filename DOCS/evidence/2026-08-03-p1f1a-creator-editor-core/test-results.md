# Test and build results — Gate A

Run sequentially on Windows on 2026-08-03, one workspace at a time.

```
                   before (0d21bc8)   after Gate A
  web                       515            571     (+56)
  api                       239            241      (+2)
  edit-domain               299            299
  render-contract            65             65
  intent-domain              27             27
  ─────────────────────────────────────────────────
  total                   1,176          1,203     (+27 net of moved fixtures)
```

Program floor was 1,176. Final inventory is **1,203**. No assertion was
weakened; the four fixture changes below all made a fixture *more* realistic.

All-workspace production build passes. Web bundle: `603.12 kB`
(gzip `169.01 kB`), CSS `101.27 kB` (gzip `17.62 kB`). The Gate A additions are
three small pure modules plus one React status component; the pre-existing
500 kB chunk-size warning is unchanged and not introduced here.

## New focused tests

| File | Tests | Covers |
|---|---|---|
| `apps/web/src/editor/monitor/monitor-base-frame.test.ts` | 11 | state precedence, gap only for a canonical gap, error outranks gap, seek retains, messages |
| `apps/web/src/screens/studio/StudioPreviewReliability.test.tsx` | 6 | loading→ready, metadata-without-frame is loading, seek retains, overlay + base video together, ten play/pause/seek/resize cycles, media error explained, one video and same DOM node |
| `apps/web/src/features/render-plan/footage-motion-preview.test.ts` | +4 (3→7) | canvas never revealed without a real frame, retain on readiness dip, no cross-source retention, draw/retain/hide decision |
| `apps/web/src/features/project-export/project-export.test.ts` | +4 (3→7) | bounded timeout, no DELETE on timeout, real phase sequence, phase required in the response, phase sentences and elapsed formatting |
| `apps/api/src/jobs/local-export-job-store.contract.test.ts` | +2 (1→3) | phase derived from real milestones, public job states its phase and leaks neither snapshot nor key |

## Fixture corrections (strengthening, not weakening)

1. `footage-motion-preview.test.ts` — the fake video now declares `readyState`
   and `currentSrc`. jsdom leaves `readyState` at `HAVE_NOTHING`, and a fixture
   reporting a size with no decodable frame is precisely the state that used to
   reveal an empty black canvas. Every original assertion is unchanged.
2. `StudioScreen.test.tsx` — the `rendering` export fixture now carries
   `phase`, `jobId`, and `startedAt`, and additionally asserts an elapsed clock
   is on screen.
3. `App.test.tsx` — the export job fixture now carries `phase` (a response
   without one is refused), and the status assertion accepts the real phase
   sentence plus asserts the elapsed clock.
4. `apps/api/src/server.test.ts` — the in-memory job-store double now derives
   `phase` exactly as the real store does.

## Guard proof

Reverting the readiness check in `hasDecodableFrame` to the old
`videoWidth > 0` test makes **4 tests fail**:

```
  × never reveals a canvas it has not drawn a real frame onto
  × retains the last valid frame instead of blanking when readiness dips mid-seek
  × does not retain another source last frame after the video source changes
  × decides draw, retain, or hide from readiness alone
```

The check was restored immediately and the suite re-run green. This follows the
existing project rule that a guard must be shown to fail when the defect is
reintroduced, or it is not a guard.
