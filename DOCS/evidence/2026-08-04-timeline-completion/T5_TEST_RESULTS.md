# Gate T5 — Advanced Track Controls — Test Results

Date: 2026-08-10
Branch: `timeline-t5-advanced-tracks`

## Final automated gate

**2,501 / 2,501 tests passed.**

- API: **405 / 405**
- Web: **1,365 / 1,365**
- edit-domain: **562 / 562**
- intent-domain: **27 / 27**
- render-contract: **142 / 142**

All-workspace production build: **PASS**.

The full Web suite was run with two bounded forks and a 20-second per-test ceiling because the repository's heaviest Studio files can exhaust the default 5-second test timeout when accumulated in one Windows process. The complete run passed 134/134 files and 1,365/1,365 assertions. The one T4 pointer test that failed only in a long single-fork sweep passed 6/6 in its own file; with two bounded forks the complete Web suite passed with no assertion failures.

## T5-specific closure coverage

The T5 suites prove stable typed video/audio/caption track identities and deterministic legacy migration; add/rename/reorder/assign/delete/Place On Top operations; independent Lock, Sync Lock, Targeting and Output semantics; source-anchored and composition-anchored ripple behavior; static audio mute/solo/gain/pan; track-order render stacking; independent caption-track output; T4 animation identity preservation; truthful Combined vs Separate L/R waveform presentation; migration/replay goldens; and the required **20 video + 24 audio + 8 caption track** stress shape.

## Late regression fixes

Late T5 closure found and fixed two product issues rather than weakening tests:

1. Timeline lane bodies used reconciled stable track presentation while headers still read raw pre-T5 presentation. Header and body now share the same reconciled stable presentation authority.
2. A lock message exposed the internal stable `track_...` identity. User-facing messages now use the visible row label such as `V1`, while callbacks and domain operations keep stable IDs.

Focused legacy/T5 regression after those fixes: **40 / 40**.
