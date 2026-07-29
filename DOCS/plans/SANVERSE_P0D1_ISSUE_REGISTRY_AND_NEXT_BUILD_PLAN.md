# SANVERSE — P0-D.1 VISUAL CORRECTIONS, INTERNAL ISSUE REGISTRY, AND NEXT BUILD PLAN

**Active branch:** `agent/g6-g8-local-alpha`
**Required starting commit:** `7e507a53ebeea5873003d703ef37aee0395b70e7`
**Current completed milestone:** P0-D technically complete
**Current product gate:** P0-D visual approval withheld pending one bounded correction patch
**Next production milestone after approval:** P0-E — Studio workspace structure
**Production Timeline V1:** Not started
**Real AI provider:** Not connected

---

# 0. Purpose

This document gives Codex the complete implementation contract for:

1. P0-D.1 — owner-requested Home and Assist visual corrections;
2. shared action-state clarity for Undo, Redo, and Export;
3. restrained interaction motion;
4. upgrading `DOCS/FAILURE_REGISTRY.md` into the canonical internal issue tracker;
5. preserving all P0-D authority and continuity guarantees;
6. the exact ordered build plan after P0-D.1.

This is not permission to build P0-E or Timeline V1 in the same task.

The active coding task is P0-D.1 only.

---

# 1. Start-state verification

Before editing:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
git log -1 --oneline
git branch -vv
```

Expected:

```text
branch: agent/g6-g8-local-alpha
commit: 7e507a53ebeea5873003d703ef37aee0395b70e7
working tree: clean
```

If newer work exists:

- do not reset it;
- inspect whether it overlaps P0-D.1;
- adapt this plan to the actual branch;
- report the difference;
- preserve all completed work.

---

# 2. Current verified implementation

P0-D currently provides:

- Assist as the default workspace;
- one mounted `EditorShell`;
- one mounted editor session;
- exactly one video element;
- one playhead;
- one project and revision;
- one pending proposal;
- one accepted history;
- shared Undo/Redo;
- shared save state;
- shared export state;
- proposal repair;
- Point interaction;
- compact semantic change strip;
- real-video proposal → repair → Accept → Undo → Redo → export → MP4 download evidence;
- 67/67 focused tests;
- production build success.

P0-D.1 must preserve all of those.

---

# 3. Owner visual decision

Technical P0-D is approved.

Visual P0-D is not approved yet.

The owner identified:

- Home composer too large;
- Assist side panel too compressed and small;
- disabled action buttons look broken;
- empty proposal state exposes unusable Accept;
- Add text appears before Point context exists;
- desired motion is fluid but restrained;
- Undo/Redo/Export need verification and clearer explanation;
- internal problems need one durable issue tracker.

The screenshots also show:

- Home uses excessive vertical space before recent projects;
- Assist is structurally correct but text hierarchy is too small;
- Assist proposal/empty states look technical;
- Studio remains intentionally unfinished and must wait for P0-E.

---

# 4. Active milestone

```text
P0-D.1 — Owner visual corrections and action-state clarity
```

P0-D.1 is a bounded correction patch.

It must not become:

- a broad redesign;
- Studio restructuring;
- Timeline V1;
- a reusable panel-resize framework;
- a new AI feature;
- a renderer optimization milestone.

---

# 5. Non-negotiable invariants

Keep:

```text
one EditorShell
one editor session
one video DOM node
one playhead
one project
one revision
one proposal
one history
one Undo/Redo system
one preview path
one export path
```

Do not add:

```text
Assist-specific project state
Studio-specific project state
second video
second composer
second proposal store
second history
second preview compiler
```

The workspace switch changes presentation only.

---

# 6. P0-D.1 outcomes

At the end of P0-D.1:

## Home

- composer is compact and proportional;
- prompt is still the primary action;
- upload remains obvious;
- recent projects become visible sooner;
- vertical textarea resize remains;
- horizontal/user panel resizing is deferred.

## Assist

- video remains dominant;
- assistant panel is readable;
- empty proposal state is quiet;
- actions only appear when actionable;
- Point context is clearer;
- pending and accepted changes are unmistakable;
- important text is readable on laptop screens.

## Global actions

- Undo, Redo, and Export retain existing rules;
- disabled state explains why;
- keyboard and screen-reader users can access the reason;
- actual action transitions are proven in tests.

## Motion

- controls feel responsive;
- pressing no longer shrinks aggressively;
- motion remains interruptible;
- reduced-motion support remains.

## Issue tracking

- one canonical internal tracker exists;
- existing history is preserved;
- active issues are easy to scan;
- resolved issues keep evidence;
- no issue becomes “open forever with no target.”

---

# 7. Current code facts Codex must respect

## Home

Current code uses:

```tsx
<textarea rows={5} />
```

Current CSS includes:

```text
intro max width: 880px
composer padding: 30px
textarea min-height: 136px
drop-zone min-height: 104px
drop-zone margin-top: 22px
drop-zone padding: 20px
```

These values make the initial box too tall.

## EditorShell

Current shell receives booleans:

```ts
canUndo
canRedo
canExport
isExporting
```

It currently renders disabled controls without human-readable disabled reasons.

## Export rule

Current `App` enables export only when:

```text
no pending proposal
at least one accepted change set
not rendering
```

Do not change this rule unless a failing test proves a defect.

## Assist proposal panel

Current empty proposal state renders a disabled `Accept proposal` button.

Remove that button in the empty state.

## Point/nameplate

Current `NameplateComposer` is mounted under Point controls even without a selected point.

Change presentation so an unusable “Add text here” action does not appear before a valid point exists.

Do not delete the underlying capability.

## Change strip

Current strip already includes textual status:

```text
Accepted
Pending
Needs attention
```

Preserve these semantics and improve visual distinction.

---

# 8. Recommended file plan

## Modify

```text
apps/web/src/screens/home/HomeScreen.tsx
apps/web/src/screens/home/HomeScreen.css
apps/web/src/screens/home/HomeScreen.test.tsx

apps/web/src/editor/EditorShell.tsx
apps/web/src/editor/EditorShell.css
apps/web/src/editor/EditorShell.test.tsx

apps/web/src/editor/ui/Button.tsx
apps/web/src/editor/ui/IconButton.tsx
apps/web/src/editor/ui/ui.css

apps/web/src/editor/assist/AssistProposalPanel.tsx
apps/web/src/editor/assist/AssistProposalPanel.css
apps/web/src/editor/assist/AssistProposalPanel.test.tsx

apps/web/src/editor/assist/AssistChangeStrip.tsx
apps/web/src/editor/assist/AssistChangeStrip.css
apps/web/src/editor/assist/AssistChangeStrip.test.tsx

apps/web/src/screens/studio/StudioScreen.tsx
apps/web/src/screens/studio/StudioScreen.css
apps/web/src/screens/studio/StudioScreen.test.tsx

apps/web/src/app/App.tsx
apps/web/src/app/App.test.tsx

apps/web/src/styles/tokens.css

DOCS/FAILURE_REGISTRY.md
DOCS/CURRENT_STATE.md
DOCS/HANDOFF.md
```

## Create only if needed

```text
apps/web/src/editor/ui/DisabledAction.tsx
apps/web/src/editor/ui/DisabledAction.test.tsx
apps/web/src/editor/ui/Tooltip.tsx
apps/web/src/editor/ui/Tooltip.test.tsx
```

Prefer one small reusable accessible pattern.

Do not create a large popover system.

## Evidence folder

```text
DOCS/evidence/2026-07-29-p0d1-visual-corrections/
├── P0-D1_IMPLEMENTATION_REPORT.md
├── home-before-1440x900.png
├── home-after-1440x900.png
├── home-after-1280x800.png
├── home-after-1024x768.png
├── assist-before-1440x900.png
├── assist-after-1440x900.png
├── assist-after-1280x800.png
├── assist-after-1024x768.png
└── browser-walkthrough.md
```

Use the actual completion date if different.

---

# 9. Internal issue tracker architecture

Do not create a second competing issue document.

Upgrade:

```text
DOCS/FAILURE_REGISTRY.md
```

into the canonical internal issue tracker.

Keep the filename for continuity.

Its title may become:

```markdown
# Sanverse Internal Issue and Failure Registry
```

---

# 10. Documentation system boundaries

Use:

```text
PLAN_CHECKLIST.md
→ planned milestones and tasks

DOCS/FAILURE_REGISTRY.md
→ defects, risks, UX problems, performance observations,
  environment failures, documentation conflicts, and technical debt

DOCS/decisions/
→ architectural/product decisions and rejected options

DOCS/evidence/
→ screenshots, test logs, reports, walkthroughs, benchmarks
```

Do not mix all four into one giant file.

---

# 11. Issue IDs

Preserve every existing ID:

```text
RISK-001...
FAIL-006...
```

Do not renumber them.

For new issues, use typed categories:

```text
BUG-###       functional bug
UX-###        usability or visual issue
PERF-###      performance issue
A11Y-###      accessibility issue
SEC-###       security or privacy
DATA-###      persistence, migration, integrity
ARCH-###      architectural concern
TEST-###      verification limitation
INFRA-###     tooling or environment
DOC-###       documentation conflict
DEBT-###      technical debt
UPSTREAM-###  third-party dependency
FEATURE-###   deferred but explicitly requested enhancement
```

Start each category at `001`.

Never reuse an ID.

---

# 12. Issue status values

Allowed values:

```text
OPEN
INVESTIGATING
PLANNED
IN_PROGRESS
BLOCKED
MONITORING
RESOLVED
WONT_FIX
DUPLICATE
```

Meanings:

## OPEN

Confirmed issue, not yet scheduled.

## INVESTIGATING

Root cause or correct solution is not yet established.

## PLANNED

Assigned to a milestone but not started.

## IN_PROGRESS

Active work is underway.

## BLOCKED

Cannot proceed until a named dependency changes.

## MONITORING

Observed but requires repeated evidence before optimization/fix.

## RESOLVED

Fixed and proven by evidence.

## WONT_FIX

Deliberately closed with reason.

## DUPLICATE

Covered by another issue ID.

Checkbox rule:

```text
[ ] OPEN / INVESTIGATING / PLANNED / IN_PROGRESS / BLOCKED / MONITORING
[x] RESOLVED / WONT_FIX / DUPLICATE
```

Status text remains authoritative.

---

# 13. Severity

Use:

```text
P0 — Critical
P1 — High
P2 — Medium
P3 — Low
```

## P0

- data loss;
- project corruption;
- source mutation;
- security/privacy exposure;
- unrecoverable project;
- invalid export presented as valid;
- stale revision overwrites accepted work.

## P1

- core workflow broken;
- important action inaccessible;
- major usability confusion;
- severe visual hierarchy problem;
- broken continuity;
- inability to export accepted work.

## P2

- noticeable issue with workaround;
- secondary workflow defect;
- performance observation;
- noncritical accessibility problem;
- visual polish that harms clarity but does not block use.

## P3

- minor polish;
- documentation cleanup;
- developer inconvenience;
- low-impact technical debt.

---

# 14. Active issue summary table

Add near the top:

```markdown
## Active issues

| Done | ID | Severity | Type | One-line issue | Status | Target |
|---|---|---:|---|---|---|---|
| [ ] | UX-001 | P1 | UX | Home composer occupies too much vertical space | IN_PROGRESS | P0-D.1 |
| [ ] | UX-002 | P1 | UX | Disabled Undo, Redo, and Export lack explanations | IN_PROGRESS | P0-D.1 |
| [ ] | UX-003 | P1 | UX | Empty proposal state exposes an unusable Accept action | IN_PROGRESS | P0-D.1 |
| [ ] | UX-004 | P2 | UX | Add-text control appears before a valid point exists | IN_PROGRESS | P0-D.1 |
| [ ] | UX-005 | P1 | UX | Assist side-panel text and hierarchy are too compressed | IN_PROGRESS | P0-D.1 |
| [ ] | UX-006 | P2 | UX | Pending and accepted changes need stronger visual distinction | IN_PROGRESS | P0-D.1 |
| [ ] | FAIL-021 | P2 | Performance | 30-second export crossed the 60-second walkthrough budget | MONITORING | E5 benchmark |
| [ ] | FEATURE-001 | P3 | Deferred UX | Optional desktop composer resize preference | PLANNED | Post-P1 |
```

Do not duplicate `FAIL-021`.

---

# 15. Detailed issue template

Every new issue must use:

```markdown
## UX-001 — Home composer occupies too much vertical space

- **Done:** [ ]
- **Status:** IN_PROGRESS
- **Severity:** P1
- **Type:** UX
- **Found:** 2026-07-29
- **Target milestone:** P0-D.1
- **Owner:** Codex
- **One-line issue:** The new-project composer pushes important content down and feels disproportionate.

### What?

Describe the exact problem.

### Where?

List files, routes, components, and viewports.

### When?

State the state or workflow where it appears.

### Who is affected?

State which users, developers, or systems are affected.

### Why does it matter?

State product, reliability, accessibility, or maintenance impact.

### How is it reproduced?

Give deterministic steps.

### Root cause

State proven cause or `Unknown — investigating`.

### What was tried?

List attempted solutions and outcomes.

### Proposed solution

Describe the intended fix.

### One-line solution

One sentence.

### Acceptance tests

List objective checks.

### Evidence

- Test:
- Screenshot:
- Walkthrough:
- Commit:
- Decision:

### Resolution

Complete only when closed.

### Current status

Repeat status and next action.
```

---

# 16. Issue lifecycle

```text
discover
→ record immediately
→ classify
→ assign severity
→ decide whether it blocks active milestone
→ reproduce
→ investigate
→ fix now or schedule
→ add test/evidence
→ mark resolved
→ preserve forever
```

Do not delete resolved issues.

Do not mark resolved without evidence.

---

# 17. Milestone triage rule

At the end of every milestone:

1. add newly discovered issues;
2. update status for touched issues;
3. link commits, tests, screenshots, and reports;
4. reassess severity;
5. assign every unresolved issue a target;
6. identify open P0/P1 blockers;
7. report whether progression is allowed.

No unresolved issue may remain with:

```text
owner: none
target: someday
status: open forever
```

---

# 18. Immediate issue records

## UX-001 — Home composer occupies too much vertical space

- Severity: P1
- Status: IN_PROGRESS
- Target: P0-D.1

Root causes currently visible:

```text
rows={5}
min-height: 136px
card padding: 30px
drop-zone min-height: 104px
drop-zone margin-top: 22px
intro padding up to 116px top and 88px bottom
```

One-line solution:

```text
Use a 3-row prompt, approximately 84–96px initial height,
20–22px card padding, a 60–68px upload row,
and reduced intro spacing.
```

## UX-002 — Disabled global actions lack explanations

- Severity: P1
- Status: IN_PROGRESS
- Target: P0-D.1

One-line solution:

```text
Add keyboard-accessible disabled-reason wrappers while preserving action rules.
```

## UX-003 — Empty proposal exposes unusable action

- Severity: P1
- Status: IN_PROGRESS
- Target: P0-D.1

One-line solution:

```text
Do not render proposal action buttons until a real proposal exists.
```

## UX-004 — Add-text appears before valid point

- Severity: P2
- Status: IN_PROGRESS
- Target: P0-D.1

One-line solution:

```text
Render the real Add text/nameplate action only after a valid point target exists.
```

## UX-005 — Assist panel hierarchy is too compressed

- Severity: P1
- Status: IN_PROGRESS
- Target: P0-D.1

One-line solution:

```text
Increase readable type sizes, panel width, and spacing without reducing video dominance.
```

## UX-006 — Accepted and pending changes need stronger distinction

- Severity: P2
- Status: IN_PROGRESS
- Target: P0-D.1

One-line solution:

```text
Use explicit status labels, icon/border differences, and stronger selected state.
```

## FAIL-021 — Export exceeded walkthrough wait

Update:

```text
Status: MONITORING
Severity: P2
Target: E5 export performance benchmark
```

Do not optimize during P0-D.1.

## FEATURE-001 — Optional desktop composer resizing

- Severity: P3
- Status: PLANNED
- Target: Post-P1 workflow validation

One-line solution:

```text
Later provide clamped desktop-only resizing with local preference and Reset size.
```

Do not implement it now.

---

# 19. Home composer implementation

## Goal

Match the density of a polished prompt-led application without copying source, assets, or styling.

## Target dimensions

Desktop:

```text
composer max-width: 720–760px
card padding: 20–22px
textarea initial height: 84–96px
textarea max visible height before scroll: ~180px
drop row min-height: 60–68px
prompt/drop gap: 12–14px
intro top padding: approximately 52–72px
intro bottom padding: approximately 52–64px
```

## TSX changes

Change:

```tsx
rows={5}
```

to approximately:

```tsx
rows={3}
```

Keep:

```tsx
value
onChange
placeholder
drag/drop
file validation
Choose video
progress
error
```

## Textarea behavior

Use:

```css
min-height: 84px;
max-height: 180px;
resize: vertical;
overflow-y: auto;
```

Do not allow horizontal resize now.

## Composer width

Either narrow the intro or composer:

```css
.home-screen__composer {
  width: min(100%, 740px);
  margin-inline: auto;
}
```

Do not narrow the title unnecessarily.

## Upload row

Make it visually integrated:

```text
Drop MP4 here
Your video stays on this device
[Choose video]
```

Keep drag feedback.

Do not convert the entire row into a hidden file input unless keyboard semantics remain correct.

## Recent projects

Do not redesign the list in P0-D.1.

Only ensure the reduced composer makes recent projects visible sooner.

---

# 20. Home motion

Current focus motion lifts the full card and scales it.

Keep subtle focus feedback, but reduce exaggerated movement.

Target:

```text
focus-within:
translateY(-1px)
scale: 1.001–1.003 maximum

button hover:
translateY(-1px)

button active:
scale(0.98)
```

Do not use:

```text
scale(0.94)
large spring overshoot
large 24px shadow jumps
```

---

# 21. Disabled action explanation pattern

A native disabled button does not reliably expose hover/focus explanations.

Build a wrapper that remains focusable while the real button remains disabled.

Suggested API:

```tsx
<DisabledAction
  disabled={!canUndo}
  reason="Nothing to undo yet."
>
  <IconButton
    label="Undo edit"
    icon="↶"
    disabled={!canUndo}
    onClick={onUndo}
  />
</DisabledAction>
```

Suggested type:

```ts
export type DisabledActionProps = {
  disabled: boolean
  reason: string | null
  children: ReactElement
}
```

Behavior:

- when enabled, wrapper adds no interaction;
- when disabled, wrapper can receive focus;
- `aria-describedby` connects action to reason;
- reason appears on hover and focus;
- Escape hides visual tooltip when applicable;
- reason remains in DOM for assistive technology;
- no click passes through;
- no fake enabled button.

Alternative:

```text
Use a small inline status next to actions
```

but shared wrapper is preferable for compact top-bar controls.

Do not use only the HTML `title` attribute.

---

# 22. Disabled reason rules

## Undo

```text
Nothing to undo yet.
```

If a proposal blocks Undo:

```text
Accept or reject the pending proposal before undoing accepted edits.
```

Use actual product rule.

## Redo

```text
Nothing to redo yet.
```

If proposal blocks Redo:

```text
Accept or reject the pending proposal before redoing accepted edits.
```

## Export

No accepted changes:

```text
Accept at least one edit before exporting.
```

Pending proposal:

```text
Accept or reject the pending proposal before exporting.
```

Rendering:

```text
Export is already in progress.
```

## Derivation

Do not scatter these conditions across UI components.

In `App`, derive:

```ts
undoDisabledReason
redoDisabledReason
exportDisabledReason
```

Pass them into `EditorShell`.

Suggested props:

```ts
undoDisabledReason: string | null
redoDisabledReason: string | null
exportDisabledReason: string | null
```

Enabled condition:

```text
reason === null
```

Keep boolean props only if needed for compatibility, but avoid contradictory sources of truth.

---

# 23. Verify action logic before changing it

Add tests proving:

## Empty project

```text
Undo disabled
Redo disabled
Export disabled
correct reasons shown
callbacks not called
```

## Pending proposal

```text
Export disabled
correct pending reason
Undo/Redo behavior follows existing policy
```

## Accepted proposal

```text
Undo enabled
Export enabled
```

## After Undo

```text
Redo enabled
Export follows current accepted-history result
```

## After Redo

```text
Undo enabled
Export enabled
```

## Rendering

```text
Export disabled
loading label shown
reason available
```

If all pass, the buttons were not broken; only communication was broken.

---

# 24. Assist layout correction

Current Assist grid already uses:

```text
minmax(0, 1.55fr) minmax(330px, 0.7fr)
max-width: 1400px
```

Correct carefully:

```text
max-width: approximately 1560px
video column: 1.8fr–2fr
assistant column: minmax(340px, 420px)
gap: 18–22px
```

Do not make the right panel too wide.

At 1280:

```text
assistant minimum: approximately 320–340px
```

At 1024:

```text
single column
video first
assistant second
changes third
```

Keep no unexpected horizontal overflow.

---

# 25. Assist typography

Raise important text:

```text
panel body: 13–14px
proposal body: 13–14px
secondary: 12–13px
micro labels: 11px minimum, sparingly
buttons: 12–13px minimum
```

Reduce overuse of:

```text
0.62rem
0.65rem
uppercase
large letter spacing
```

Do not globally enlarge Studio technical density in this patch.

Scope Assist selectors only where possible.

---

# 26. Assist empty proposal state

Current empty state includes:

```text
No pending proposal.
Tell Sanverse what you want to change.
Pause and point when location matters.
Nothing changes until you accept a proposal.
[disabled Accept proposal]
```

Change to:

```text
Tell Sanverse what you want to change.
Pause and point when location matters.

Nothing changes until you accept.
```

Do not render:

- Accept;
- Reject;
- Refine;
- Open proposal in Studio;

until a proposal exists.

---

# 27. Proposal state hierarchy

When proposal exists:

Header:

```text
Proposal
Pending — preview only
```

Body:

```text
primary text
secondary text
start and duration
origin
note/explanation
```

Actions:

```text
Refine
Open in Studio
Reject
Accept
```

Hierarchy:

- Accept is primary;
- Reject is secondary/destructive-neutral;
- Refine and Open in Studio are lower emphasis;
- no raw JSON;
- no “applied” wording.

Make:

```text
Nothing changes until you accept.
```

visible near the status, not hidden in fine print.

---

# 28. Add text/nameplate contextual presentation

Current `NameplateComposer` receives a nullable target.

Do not remove the component’s defensive behavior.

Presentation rule:

## No point selected

Show:

```text
[Point]
Pause anywhere, then choose Point to mark an exact place.
```

Do not show:

```text
disabled Add text here
```

## Point selected

Show:

```text
Here · 00:05.000
[Add text here]
```

## Point mode active

Show existing keyboard instructions.

## Proposal pending

Do not allow starting another incompatible text proposal.

Preserve existing one-proposal-at-a-time rule.

Preferred implementation:

```tsx
{pointTarget ? (
  <NameplateComposer ... />
) : null}
```

unless current tests or focus behavior require the component to remain mounted.

---

# 29. Change strip visual distinction

Keep statuses:

```text
Accepted
Pending
Needs attention
```

Add non-color differences:

## Accepted

- solid subtle border;
- check icon or accepted marker;
- normal surface;
- label `Accepted`.

## Pending

- dashed border;
- hollow/preview marker;
- label `Pending`;
- slightly elevated surface.

## Needs attention

- warning icon;
- label `Needs attention`;
- warning border;
- no color-only meaning.

## Selected

- strong focus/selection outline;
- `aria-current`;
- do not rely on background alone.

Keep strip semantic.

Do not add:

- tracks;
- trim handles;
- draggable clips;
- timeline ruler.

---

# 30. Shared motion system

Use existing tokens.

Suggested:

```css
--motion-duration-control: 160ms;
--motion-duration-panel: 200ms;
```

Controls:

```text
hover: translateY(-1px)
active: scale(0.98)
```

Workspace/panel:

```text
opacity + translateY(2–4px)
180–220ms
```

Do not animate:

- video remount;
- playhead continuously through CSS;
- layout width during precision editing;
- large height auto transitions.

Reduced motion:

```text
duration near zero
no transform
no essential information conveyed by motion
```

---

# 31. Exact motion corrections

Inspect:

```text
.home-screen__choose-button:active
.studio-screen button:active:not(:disabled)
.sv-button:active:not(:disabled)
.sv-segmented__option:active
.studio-screen__back:hover
```

Target:

```text
active scale: 0.98
back hover translation: -1px or -2px maximum
no 0.94 global shrink
```

Do not make every button bounce.

---

# 32. P0-D.1 test plan

## HomeScreen tests

1. compact default structure;
2. drag/drop;
3. file picker;
4. invalid MP4 error;
5. progress;
6. recent project open;
7. disabled import state;
8. keyboard labels.

Use browser evidence for dimensions.

## DisabledAction tests

1. enabled child works;
2. disabled callback not called;
3. focus reveals reason;
4. hover reveals reason;
5. `aria-describedby`;
6. reason accessible;
7. Escape behavior if applicable;
8. unique IDs.

## EditorShell tests

1. Undo reason;
2. Redo reason;
3. Export no-edit reason;
4. Export pending reason;
5. Export rendering state;
6. enabled callbacks;
7. workspace switch;
8. save state.

## AssistProposalPanel tests

1. no proposal has no actions;
2. empty copy includes Accept rule;
3. busy state;
4. pending state;
5. Accept;
6. Reject;
7. Refine focus;
8. Open in Studio;
9. error ownership;
10. no duplicate alert.

## StudioScreen tests

1. no point means no Add text;
2. Point reveals Add text;
3. keyboard Point;
4. proposal continuity;
5. Assist hides Studio controls;
6. Studio controls remain;
7. one video;
8. same video identity.

## Change strip tests

1. Accepted;
2. Pending;
3. Needs attention;
4. status class;
5. selected state;
6. timed seek;
7. untimed fail-closed;
8. compaction.

## App tests

Full transition:

```text
empty
→ pending
→ accepted
→ Undo
→ Redo
→ export
```

---

# 33. Build verification

Run focused web tests, then:

```bash
npm run build
```

Report:

- modules;
- JS raw/gzip;
- CSS raw/gzip;
- dependency changes;
- bundle growth explanation.

No new package dependency should be necessary.

---

# 34. Browser walkthrough

Use real media.

## Home viewports

```text
1440×900
1280×800
1024×768
```

Verify compact composer, no overflow, drag state, focus, vertical resize.

## Assist viewports

Same sizes.

Verify:

- video dominant;
- readable panel;
- no empty proposal actions;
- no Add text before Point;
- Point reveals Add text;
- pending state clear;
- Accept rule clear;
- change distinction;
- one video;
- playback/draft continuity.

## Action transitions

```text
new project:
Undo reason
Redo reason
Export reason

pending proposal:
Export pending reason

accepted:
Undo enabled
Export enabled

Undo:
Redo enabled

Redo:
Undo and Export enabled
```

## Motion

Check hover, press, workspace switch, reduced motion.

## Console/network

Report errors, warnings, failed requests, and known HMR issue separately.

---

# 35. Visual acceptance criteria

## Home

```text
[ ] Composer no longer dominates.
[ ] Prompt remains obvious.
[ ] Upload remains obvious.
[ ] Recent projects appear sooner.
[ ] Vertical resize works.
[ ] No horizontal resize.
[ ] No overflow.
```

## Assist

```text
[ ] Video remains primary.
[ ] Panel is readable.
[ ] Empty state is calm.
[ ] Proposal actions only when real.
[ ] Add text only after Point.
[ ] Accept rule obvious.
[ ] Pending/accepted differ without color alone.
[ ] Studio controls preserved.
```

## Actions

```text
[ ] Undo reason works.
[ ] Redo reason works.
[ ] Export reason works.
[ ] Enabled actions execute.
[ ] Disabled actions do not.
[ ] Keyboard users can access reasons.
```

## Motion

```text
[ ] Press feedback restrained.
[ ] Motion interruptible.
[ ] Reduced motion removes transforms.
[ ] No video remount.
```

## Registry

```text
[ ] Existing issues preserved.
[ ] Active summary exists.
[ ] New UX issues recorded.
[ ] FAIL-021 assigned to benchmark.
[ ] Resolved issues link evidence.
[ ] No open P0/P1 blocker remains.
```

---

# 36. Resolution rules

Mark each UX issue resolved only with relevant tests and screenshots.

Keep `FAIL-021` MONITORING.

Keep `FEATURE-001` PLANNED.

Owner visual approval remains required for `UX-005`.

---

# 37. P0-D.1 report format

```text
P0-D.1 IMPLEMENTATION REPORT

Branch:
Start commit:
End commit:
Working tree:

Objective:
Implemented:
Not implemented:

Files created:
Files modified:
Files deleted:

Home changes:
Assist changes:
Action-state changes:
Motion changes:
Issue registry changes:

Authority invariants:

Tests:
Build:
Bundle:

Browser screenshots:
Action transitions:
Accessibility:
Motion:
Console:
Network:

Issues resolved:
Issues remaining:
Open P0/P1 blockers:

Owner review:
Exact next task:
Stop confirmation:
```

---

# 38. Stop condition

Stop after:

- patch;
- registry upgrade;
- tests;
- build;
- browser walkthrough;
- screenshots;
- report;
- pushed commit;
- owner review request.

Do not start P0-E.

---

# 39. Exact Codex prompt

```text
ACTIVE TASK: P0-D.1 — OWNER VISUAL CORRECTIONS, ACTION-STATE CLARITY,
AND INTERNAL ISSUE REGISTRY

Start from:
branch agent/g6-g8-local-alpha
commit 7e507a53ebeea5873003d703ef37aee0395b70e7

Read this contract and all current authority documents.

Implement:

A. Compact Home composer
B. Readable Assist hierarchy
C. Contextual proposal and Add-text actions
D. Stronger accepted/pending change strip
E. Accessible disabled reasons for Undo/Redo/Export
F. Restrained shared motion
G. Canonical internal issue registry in DOCS/FAILURE_REGISTRY.md

Preserve:
one EditorShell
one project
one revision
one video
one playhead
one proposal
one history
one preview/export path

Do not start:
P0-E
TimelineViewModel
Timeline V1
Inspector
media bin
panel resizing
horizontal composer resizing
new edit operations
renderer work
export optimization
real AI
multitrack

Run focused tests, full build, real browser walkthrough, required screenshots,
bundle comparison, issue triage, and report.

Push one focused commit and stop.
```

---

# 40. Next build phase after approval

```text
P0-E — Complete Studio workspace structure
```

Target:

```text
media region
+ central canvas
+ Inspector region
+ timeline region
+ collapsible AI panel
```

No deep timeline yet.

---

# 41. P0-E deliverables

- media placeholder using current assets;
- central canvas;
- Inspector placeholder;
- timeline region containing existing controls;
- collapsible AI/activity panel;
- collapsible side regions;
- responsive laptop structure;
- current controls relocated, not deleted;
- one video;
- no new edit operations.

---

# 42. P1-A — Timeline presentation foundation

Create:

```text
timeline-view-model.ts
timeline-gesture-adapter.ts
timeline-viewport-state.ts
and focused tests
```

Rules:

- derived from `EditProject`;
- never persisted;
- gestures emit typed operations;
- no second project model.

---

# 43. P1-B — Production Timeline V1

Initial rows:

```text
V2 overlays/titles/B-roll
V1 primary footage
C1 captions
A1 dialogue
A2 music
```

Features:

- ruler;
- click seek;
- draggable playhead;
- zoom;
- scroll;
- track headers;
- item blocks;
- gaps;
- selection;
- range selection;
- split;
- trim;
- ripple delete;
- remove keeping gap;
- reorder;
- enable/disable;
- caption/title/music items;
- proposal ghosts;
- keyboard;
- context menu;
- Undo/Redo.

Non-goals:

- roll;
- slip;
- slide;
- three-point editing;
- multicam;
- nested sequences;
- curve editor.

---

# 44. P1-C — Inspector V1

Expose existing:

- timing;
- X/Y;
- scale;
- rotation;
- opacity;
- crop;
- layer;
- masks;
- effects;
- gain;
- fades;
- text;
- captions;
- keyframe presets.

---

# 45. P1-D — Canvas direct manipulation

- selection;
- bounding box;
- move;
- resize;
- rotate;
- crop;
- mask overlay;
- guides;
- safe margins;
- snapping;
- keyboard nudge;
- gesture-end commit.

Use local preview during gesture, one change set on completion.

---

# 46. P1-E — Media bin

- assets;
- thumbnails/icons;
- type;
- duration;
- search;
- filter;
- add;
- usage count;
- missing/offline;
- safe removal;
- upload.

No raw filesystem paths.

---

# 47. P1-F — AI proposal visualization

Show pending operations in:

- timeline;
- canvas;
- Inspector;
- proposal list.

Accept = one change set/revision/Undo.

Reject = remove ghosts, accepted state unchanged.

---

# 48. P1-G — Talking-head workflow gate

Validate:

```text
upload
→ cuts
→ captions
→ title/nameplate
→ B-roll
→ music
→ punch-in
→ repair
→ accept
→ Undo/Redo
→ export
→ reopen
```

Measure time saved, corrections, latency, failures, publishability.

---

# 49. P2 — General multitrack

- create/reorder tracks;
- multiple video/audio;
- append;
- insert;
- overwrite;
- linked A/V;
- unlink;
- lock;
- mute;
- solo;
- sync lock;
- markers;
- overlap rendering;
- audio mixing.

---

# 50. P2 professional tools

- roll;
- slip;
- slide;
- lift;
- extract;
- source in/out;
- three-point editing;
- match frame;
- replace;
- multiple sequences later.

Every tool requires typed operation, validation, manual UI, preview, export, Undo, tests.

---

# 51. P3 — Real transcription and AI

- transcript timing/confidence/provenance;
- correction UI;
- searchable transcript;
- provider-independent adapters;
- provider/model/prompt logging;
- two-provider corpus;
- compound multi-operation plans.

---

# 52. P4 — Motion graphics

Batches:

1. counter, lower third, title card, highlight, arrow;
2. quote, chapter, feature, comparison, CTA;
3. charts, diagrams, product callouts, dynamic layouts.

Versioned schemas, renderer contracts, tests, migrations, AI skills.

---

# 53. P5 — Audio, color, perspective

Audio:

- waveforms;
- gain;
- fades;
- mute/solo;
- automation;
- ducking;
- normalization;
- cleanup.

Color:

- exposure;
- contrast;
- saturation;
- temperature;
- tint;
- highlights/shadows;
- LUT.

Perspective:

- corner pin;
- four-point transform;
- keyframes;
- later planar tracking.

---

# 54. P6 — Effects/compositing

- ordered effect stack;
- masks;
- blend modes;
- adjustment layers;
- constrained graph;
- later OpenFX/MLT/Natron evaluation.

---

# 55. P7 — Vision/tracking

- observations;
- target candidates;
- confidence;
- clarification;
- stable target IDs;
- tracking;
- segmentation;
- correction UI;
- text behind subject;
- tracked callouts.

---

# 56. P8 — API/SDK/MCP

Order:

1. application services;
2. HTTP API;
3. TypeScript SDK;
4. Python SDK;
5. MCP adapter.

Use project-level tools, not one tool per coordinate.

---

# 57. P9 — SaaS

Only after local value:

- auth;
- tenancy;
- storage;
- queues;
- workers;
- quotas;
- billing;
- monitoring;
- backups;
- retention;
- deletion;
- audit;
- recovery.

---

# 58. Roadmap checkpoint

```text
P0-B UI kernel                  complete
P0-C persistent shell          complete
P0-R reuse decision            complete
P0-D Assist technical          complete
P0-D.1 visual/issue patch      active
P0-E Studio structure          next
P1-A timeline model            after P0-E
P1-B Timeline V1               after P1-A
P1-C Inspector                 next
P1-D canvas controls           next
P1-E media bin                 next
P1-F AI ghosts                 next
P1-G workflow validation       gate
P2 multitrack                  later
P3 real AI                     later
P4 motion graphics             later
P5 audio/color/perspective     later
P6 compositing                 later
P7 tracking                    later
P8 API/SDK/MCP                 later
P9 SaaS                        later
```

---

# 59. Final operating rule

Every capability follows:

```text
deterministic operation
→ validation
→ manual UI
→ preview/export
→ repair
→ Undo
→ AI mapping
→ evaluation
```

Sanverse target:

```text
Assist makes editing understandable.
Studio makes editing precise.
AI and humans use the same operations.
The interface visibly proves what changed.
```
