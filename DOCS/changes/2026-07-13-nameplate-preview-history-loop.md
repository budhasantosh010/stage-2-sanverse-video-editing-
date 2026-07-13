# Nameplate Preview and Canonical History Loop

Date: 2026-07-13

## Linked requirements and decisions

- REQ-003 — Safe, non-destructive editing
- REQ-004 — AI proposes; deterministic code executes
- REQ-007 — Staged editing primitives
- DEC-003 — AI control plane over a deterministic edit engine
- DEC-005 — Vertical slices before broad primitive coverage

## Observable acceptance criterion

A validated nameplate proposal previews over the video without entering accepted history. Accept records exactly one canonical action, Discard leaves accepted history unchanged, Undo removes the accepted action, and Redo restores it.

## What changed

- Moved the pending proposal and canonical edit history to App-owned state.
- Revalidated every queued proposal before preview and rejected action IDs that had already been issued.
- Added a typed nameplate overlay derived only from the canonical action contract.
- Positioned overlays inside the contain-fitted video content rather than letterboxing and used the half-open interval `[startMs, startMs + durationMs)`.
- Connected Accept, Discard, Undo, and Redo to pure edit-domain transitions.
- Prevented pending proposals from entering accepted history, redo-only actions from rendering, and repeated acceptance from duplicating an action.
- Preserved accepted history when the user retargets while discarding only the stale pending proposal.
- Reset proposal and history when leaving the project or opening another local video.

## Failure and recovery behavior

- Invalid proposals fail visibly and do not preview or mutate history.
- Reused action IDs fail visibly before preview.
- Accept without a proposal and unavailable Undo/Redo operations fail visibly without mutating history.
- Undo/Redo are blocked while a proposal is pending so the user must first Accept or Discard the visible decision.
- Overlay rendering fails closed for non-finite or negative playhead time and never intercepts video controls.

## Evidence

- Focused Task 5 evidence: 54 tests pass across overlay timing/placement, app-state transitions, Studio integration, and App-owned end-to-end state.
- Canonical domain evidence: 34 tests pass.
- Full workspace evidence: 113 web tests plus 34 edit-domain tests pass (147 total); web and edit-domain production builds, both governance checks, and `git diff --check` pass.
- Independent spec review passed. Independent quality review found coarse preview timing, contradictory hardcoded duration copy, a competing fallback clock, an invalid focus token, and stale approval copy; each correction was added through a failing regression test and the final re-review passed.
- Evidence remains E2 automated behavior. No owner usability acceptance is claimed.

## Limitations

- State is in memory only. Back, reload, or opening another project clears it.
- There is no backend, project-owned media copy, database, AI adapter, product renderer integration, or exported MP4.
- Browser automation can inspect the live Home surface but cannot attach the private local fixture through the native file picker; no automated real-media browser walkthrough is claimed.
- **Provisional compatibility assumption — not owner-approved:** The selected normalized point currently represents the nameplate box's top-left anchor because the existing browser/FFmpeg renderer-spike contract interprets bounds `x` and `y` as the top-left position. This preserves current preview/export adapter compatibility but does not prove that the interaction feels correct to the owner. Before Task 7 or schema freeze, the owner must validate the meaning, or the action contract must gain explicit versioned anchor semantics. Previously recorded actions must never be silently reinterpreted.

## Rollback

Revert the single coherent Task 5 commit. The preceding bounded-proposal slice remains usable and no user media, persisted project data, or external state is migrated by this change.
