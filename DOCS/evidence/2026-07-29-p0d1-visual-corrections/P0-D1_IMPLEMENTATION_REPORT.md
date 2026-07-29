# P0-D.1 IMPLEMENTATION REPORT

Branch: `agent/g6-g8-local-alpha`
Start commit: `7e507a53ebeea5873003d703ef37aee0395b70e7`
End commit: the single focused commit containing this report; exact SHA is reported after push because a commit cannot contain its own final hash
Working tree: expected clean after the focused commit and push; reverified at handoff

## Objective

Correct the Home and Assist visual/action-state defects found after P0-D while
preserving one mounted Sanverse editor authority.

## Implemented

- compact three-row Home composer and upload row;
- video-dominant Assist proportions and more readable proposal typography;
- proposal actions only when a proposal exists;
- Add text only after Point produces a valid target;
- accepted `✓`, pending `○`, and blocked `!` non-color markers;
- exact accessible Undo, Redo, and Export disabled reasons;
- restrained 0.98 pressed motion, smaller focus movement, and a 200ms panel token;
- canonical typed issue registry in `DOCS/FAILURE_REGISTRY.md`.

## Not implemented

P0-E, Studio restructuring, TimelineViewModel, Timeline V1, Inspector, media
bin, panel resizing, horizontal composer resizing, new edit operations,
renderer optimization, real AI, and multitrack were not started.

## Files created

- `apps/web/src/editor/ui/DisabledAction.tsx`
- `apps/web/src/editor/ui/DisabledAction.test.tsx`
- `DOCS/plans/SANVERSE_P0D1_ISSUE_REGISTRY_AND_NEXT_BUILD_PLAN.md`
- this P0-D.1 evidence folder and report

## Files modified

- Home screen component, styles, and test
- Editor shell, UI styles/index, and shell test
- App action-state derivation and integration test
- Assist proposal/change-strip components, styles, and tests
- Studio screen contextual composition, motion/layout styles, and tests
- motion tokens
- `DOCS/FAILURE_REGISTRY.md`
- `DOCS/CURRENT_STATE.md`
- `DOCS/HANDOFF.md`

Files deleted: none.

## Home changes

The prompt changed from five rows and 136px minimum height to three rows and
88px minimum height. Card padding, upload-row height, intro spacing, and
interaction movement were reduced together. The prompt remains vertically
resizable up to 180px.

## Assist changes

The workspace now uses a wider video ratio, a bounded 340–420px conversation
column, a 1560px layout cap, and less compressed secondary proposal type.

## Action-state changes

`App` now derives nullable reason strings as the single source of action
availability. `DisabledAction` gives disabled controls a keyboard-focusable
described wrapper while preserving the real disabled button. Empty proposal and
pre-Point Add text controls are not rendered.

## Motion changes

Control press scale is 0.98 instead of 0.94/0.96. Home focus moves 1px.
Back navigation moves 2px without growth. No animation dependency was added.
Reduced-motion rules remain authoritative.

## Issue registry changes

`DOCS/FAILURE_REGISTRY.md` is now the canonical typed issue tracker. It
preserves every old ID, defines status rules, adds an active summary, and adds
complete records for `UX-001` through `UX-006` and `FEATURE-001`.

## Authority invariants

- [x] one `EditorShell`
- [x] one project and revision
- [x] one video and playhead
- [x] one pending proposal
- [x] one accepted history
- [x] one preview path
- [x] one export path
- [x] no new domain operation or renderer path

## Tests

Focused command:

```text
npm test --workspace @sanverse/web -- --run \
  src/screens/home/HomeScreen.test.tsx \
  src/editor/ui/DisabledAction.test.tsx \
  src/editor/EditorShell.test.tsx \
  src/editor/assist/AssistProposalPanel.test.tsx \
  src/editor/assist/AssistChangeStrip.test.tsx \
  src/screens/studio/StudioScreen.test.tsx \
  src/app/App.test.tsx
```

Result: **7 files passed, 78 tests passed, 0 failed.**

The first focused run was intentionally RED. After the patch, two stale
assertions still expected the deliberately removed dead UI. They were updated
to assert absence-before-context and presence-after-context. No product failure
was hidden.

## Build

`npm run build` passed for all workspaces. Vite transformed 104 modules.
The existing runtime font URL warning remained nonblocking.

## Bundle

| Asset | P0-D baseline | P0-D.1 final | Change |
|---|---:|---:|---:|
| Modules | 103 | 104 | +1 |
| JavaScript | 368.35 kB | 369.47 kB | +1.12 kB |
| JavaScript gzip | 105.58 kB | 105.83 kB | +0.25 kB |
| CSS | 41.50 kB | 42.96 kB | +1.46 kB |
| CSS gzip | 7.72 kB | 7.92 kB | +0.20 kB |

The growth is one small accessible wrapper, its tests, and bounded visual rules.
No dependency was added.

## Browser screenshots

Home:

- `home-before-1440x900.png`
- `home-after-1440x900.png`
- `home-after-1280x800.png`
- `home-after-1024x768.png`

Assist:

- `assist-before-1440x900.png`
- `assist-after-1440x900.png`
- `assist-after-1280x800.png`
- `assist-after-1024x768.png`

All final PNG dimensions were verified from disk. Invalid tiled captures from
the in-app viewport backend were rejected and replaced with unscaled exact-size
local Edge/CDP captures. Complete measurements are in `browser-walkthrough.md`.

## Action transitions

Passed: empty → Point → Add text → pending `○` → Accept `✓` → Undo → Redo.
The same browser path also preserved one video and unsent text across
Assist → Studio → Assist.

## Accessibility

The measured Assist page had zero unlabeled buttons and zero unlabeled inputs.
Keyboard Point capture passed. Disabled reason associations and callback
inertness pass focused tests.

## Motion

Motion uses bounded 160–200ms control/panel timing and 0.98 press feedback.
Reduced-motion CSS removes transforms. The machine preference was false during
the walkthrough and is reported as such.

## Console

Zero browser warnings or errors.

## Network

The video reached ready state 4 with no media error, and project action paths
completed. The browser exposed no localhost resource-timing entries, so the
report does not invent per-request status evidence.

## Issues resolved

`UX-001`, `UX-002`, `UX-003`, `UX-004`, and `UX-006`.

## Issues remaining

- `UX-005`: implementation complete, owner visual approval required.
- `FAIL-021`: monitoring at the later E5 benchmark.
- `FEATURE-001`: explicitly deferred until post-P1 evidence.
- `INFRA-001`: resolved screenshot-backend evidence failure.

Open P0/P1 blockers: no technical P0/P1 blocker. `UX-005` is a P1 owner-review
gate and remains open because subjective product taste cannot be self-certified.

## Owner review

Please compare the before/after images and confirm:

1. Home feels compact rather than empty or oversized.
2. The video is clearly dominant in Assist.
3. The side panel text is readable.
4. Empty/pending/accepted states are obvious.
5. The motion feels restrained and continuous.

## Exact next task

After explicit owner approval: **P0-E — Finish Studio workspace structure.**

## Stop confirmation

P0-D.1 is complete. P0-E and every later milestone were not started.
