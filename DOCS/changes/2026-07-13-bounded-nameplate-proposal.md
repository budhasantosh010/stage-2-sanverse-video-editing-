# Bounded Nameplate Proposal

Date: 2026-07-13

## Linked requirements and decisions

- REQ-003 — Safe, non-destructive editing
- REQ-004 — AI proposes; deterministic code executes
- REQ-012 — Calm landing before the editing Studio
- DEC-003 — AI control plane over a deterministic edit engine
- DEC-005 — Vertical slices before broad primitive coverage

## Observable acceptance criterion

After capturing a point, the user can enter required main text and optional smaller text to create one canonically validated five-second proposal. The proposal is visible but does not enter accepted history or affect the video.

## What changed

- Added a bounded `NameplateComposer` that remains unavailable until a point target exists.
- Translated the captured target into the exact versioned edit-domain contract.
- Kept proposal state ephemeral in Studio; canonical acceptance and history remain Task 5 work.
- Made cancellation, Escape, blank text, invalid canonical input, and unavailable action-ID generation fail safely.
- Made retargeting invalidate the old unaccepted proposal and reset an open composer, preventing marker/proposal drift.
- Focused the proposal summary after successful creation so the result is announced and inspectable.

## Evidence and limits

- Focused automated evidence: 10 composer tests plus 18 Studio tests.
- Full automated evidence: 87 web tests plus 34 edit-domain tests (121 total), both production builds, governance and governance-scope checks, and `git diff --check`.
- Independent spec review passed. Independent code-quality review initially rejected stale-target and ID-failure behavior; the RED/GREEN corrections passed re-review.
- No live owner acceptance is claimed.
- No nameplate preview, accepted history, render, export, persistence, backend, or AI behavior was added.
