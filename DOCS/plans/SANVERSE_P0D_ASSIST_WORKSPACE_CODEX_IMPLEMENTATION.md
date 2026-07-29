# SANVERSE P0-D — COMPLETE CODEX IMPLEMENTATION CONTRACT

**Active milestone:** P0-D — Finish the Assist workspace

**Required starting branch:** `agent/g6-g8-local-alpha`

**Required starting commit:** `836adb788ad59e9d99bbe5970afba5badfa1ebae`

**Previous completed milestones:** P0-B, P0-C, P0-R

**Production Timeline V1:** Not started

**Real AI provider:** Not connected
**Purpose of this document:** Give Codex the complete, implementation-level contract for P0-D and the exact ordered path after P0-D.

---

# 1. Operating instructions

Read this entire document before changing code.

Do not interpret this as permission to implement every future phase.

The active task is P0-D only.

Work in one focused branch and one focused change set. Stop after P0-D evidence and owner review.

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
start: 836adb788ad59e9d99bbe5970afba5badfa1ebae
working tree: clean
```

If the branch or commit differs:

1. report the difference;
2. inspect whether P0-D was already partially implemented;
3. do not reset or delete newer work;
4. adapt this plan to the actual code;
5. record any authority mismatch.

---

# 2. Product truth

Sanverse has a substantial deterministic editing foundation.

It does not yet have:

- a production professional timeline;
- a completed Inspector;
- a completed media bin;
- complete canvas direct manipulation;
- general multitrack editing;
- real-provider AI editing;
- a finished premium interface.

P0-D does not build those systems.

P0-D makes the existing supported workflow understandable for a normal user.

The desired user flow is:

```text
open video
→ describe desired result
→ point when spatial context is needed
→ see a detached proposal
→ preview it
→ repair it
→ accept or reject
```

Core law:

```text
AI proposes.
Code validates.
Preview shows.
User repairs.
User accepts.
Project records.
```

---

# 3. Current verified architecture

## EditorShell

`apps/web/src/editor/EditorShell.tsx` currently owns presentation of:

- Back;
- Sanverse identity;
- project name;
- Assist/Studio segmented control;
- save state;
- Undo;
- Redo;
- Export.

It receives one child editor session.

## App

`apps/web/src/app/App.tsx` currently owns:

- `AppState`;
- project loading;
- workspace state;
- save state;
- export state;
- proposal requests;
- server-authoritative edits;
- Undo/Redo;
- export;
- one mounted `StudioScreen`.

The current workspace state is:

```ts
const [workspace, setWorkspace] = useState<EditorWorkspace>('assist')
```

The current editor is rendered once and receives:

```tsx
<StudioScreen
  embedded
  workspace={workspace}
  ...
/>
```

This one-mount behavior is critical.

## StudioScreen

`apps/web/src/screens/studio/StudioScreen.tsx` currently owns local editor-session state such as:

- the video ref;
- playhead;
- playback segment state;
- point target;
- point mode;
- pending point movement;
- proposal result focus;
- timeline adjustment form values;
- caption upload state;
- preview projection.

It renders:

- video canvas;
- browser preview overlays;
- point mode;
- nameplate composer;
- conversation;
- proposal;
- repair;
- history;
- export result;
- chat composer;
- simple time strip;
- existing timeline action buttons;
- caption and overlay controls.

It currently changes some headings and CSS by workspace, but Assist is not yet a finished workspace.

## ChatComposer

`ChatComposer` owns its unsent text locally.

Therefore, unmounting/recreating it during a workspace switch may lose the unsent message.

P0-D must preserve:

- one video element;
- current playback position;
- point target;
- point mode state where practical;
- pending proposal;
- proposal repair values;
- conversation state;
- unsent chat text;
- revision;
- accepted history;
- Undo/Redo;
- save state;
- export state.

---

# 4. Non-negotiable architectural decision

Do not create a second editor for Assist.

Forbidden:

```text
AssistScreen with its own video
StudioScreen with another video
```

Forbidden:

```text
Assist project state
Studio project state
```

Forbidden:

```text
Assist preview compiler
Studio preview compiler
```

Required:

```text
one EditorShell
→ one mounted editor session
→ one video element
→ one playhead
→ one project
→ presentation changes by workspace
```

Recommended conceptual structure:

```text
App
└── EditorShell
    └── EditorSession / current StudioScreen
        ├── SharedCanvas                always mounted
        ├── SharedConversationComposer  always mounted
        ├── SharedProposalState         always mounted
        ├── Assist presentation         workspace variant
        └── Studio controls             workspace variant
```

P0-D may keep the component named `StudioScreen` to avoid an unnecessary rename.

A later focused refactor can rename it to `EditorSession` once both workspace structures are stable.

---

# 5. P0-D objective

Transform Assist from a lightly relabelled engineering screen into a focused default experience.

A new user should answer these questions without instruction:

1. Where is my video?
2. Where do I tell Sanverse what I want?
3. How do I point at something?
4. What is Sanverse proposing?
5. Has anything been applied yet?
6. How do I change the proposal?
7. How do I accept or reject it?
8. How do I switch to precise editing?
9. How do I Undo?
10. How do I export?

---

# 6. P0-D visual hierarchy

## Priority order

1. Video canvas.
2. Instruction composer.
3. Pending proposal.
4. Contextual pointing.
5. Compact accepted/proposed changes.
6. Export status.
7. Secondary help.

The accepted-history list must not compete visually with the video.

The transcript and overlay engineering forms must not dominate Assist.

## Desktop target

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Sanverse · Project      [ Assist | Studio ]      ↶  ↷     Export    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                         VIDEO CANVAS                                 │
│                                                                      │
│             [Point]  “Pause, then mark the place”                    │
│                                                                      │
├──────────────────────────────────────────────┬───────────────────────┤
│ Ask Sanverse                                 │ Proposed change       │
│ “Make the opening faster…”                   │ Summary               │
│                                      Send    │ Timing                │
│                                              │ Repair                │
│                                              │ Reject  Accept        │
├──────────────────────────────────────────────┴───────────────────────┤
│ Changes: [Removed pause] [Added captions] [Nameplate · pending]      │
└──────────────────────────────────────────────────────────────────────┘
```

## Laptop target

At approximately 1024–1280 CSS pixels:

```text
top bar
video
point controls
proposal
composer
horizontal changes strip
```

Do not force a narrow side panel that makes text unreadable.

## Narrow fallback

Below the selected laptop breakpoint:

- stack proposal under the canvas;
- keep composer near the proposal;
- make changes strip horizontally scrollable;
- keep primary actions visible;
- do not attempt a professional phone editor.

---

# 7. Assist content rules

## Always visible

- video;
- browser playback controls;
- workspace switch;
- Undo/Redo;
- Export;
- chat composer;
- proposal state or clear empty state;
- compact changes strip;
- point action.

## Contextual

- point guidance;
- proposal repair;
- proposal warnings;
- export result;
- current selection details;
- “Open in Studio.”

## Hidden from Assist by default

- raw timeline adjustment form;
- trim seconds form;
- gain/fade engineering fields;
- overlay administration list;
- transcript JSON picker;
- all detailed history entries;
- technical status language;
- “Simple time strip” terminology;
- any unsupported fake tools.

Those controls remain reachable in Studio until their proper UI is built.

---

# 8. Do not fake unavailable tools

P0-D may expose the existing Point interaction.

Do not show working buttons for:

- Circle;
- Box;
- Arrow;
- Freehand;
- object tracking;
- masks;
- auto reframe;

unless the current branch provides real UI, validation, preview, persistence, and expected behavior.

The interface may use neutral copy such as:

```text
“Point at the video when location matters.”
```

Do not advertise unavailable capabilities.

---

# 9. Recommended file plan

Adapt to repository conventions, but keep responsibilities narrow.

## Create

```text
apps/web/src/editor/assist/
├── AssistChangeStrip.tsx
├── AssistChangeStrip.css
├── AssistChangeStrip.test.tsx
├── AssistProposalPanel.tsx
├── AssistProposalPanel.css
├── AssistProposalPanel.test.tsx
├── assist-change-model.ts
├── assist-change-model.test.ts
├── assist-operation-presentation.ts
├── assist-operation-presentation.test.ts
└── index.ts
```

Optional only if it reduces complexity without remounting the core session:

```text
apps/web/src/editor/assist/AssistWorkspaceLayout.tsx
apps/web/src/editor/assist/AssistWorkspaceLayout.css
```

## Modify

```text
apps/web/src/screens/studio/StudioScreen.tsx
apps/web/src/screens/studio/StudioScreen.css
apps/web/src/app/App.test.tsx
apps/web/src/editor/EditorShell.test.tsx
apps/web/src/styles/tokens.css
```

Potentially modify:

```text
apps/web/src/features/conversation/ChatComposer.tsx
apps/web/src/features/conversation/ChatComposer.css
apps/web/src/features/history/describe-operation.ts
```

Only modify `ChatComposer` when needed to preserve draft state or support a variant cleanly.

## Do not modify unless a genuine blocker is found

```text
packages/edit-domain/
packages/render-contract/
apps/api/src/render/
apps/api/src/projects/
project migrations
FFmpeg behavior
intent provider adapters
```

P0-D is a web presentation milestone.

---

# 10. Assist change model

Create a pure derived model.

Do not persist it.

Suggested type:

```ts
export type AssistChangeStatus = 'accepted' | 'pending' | 'blocked'

export type AssistChangeItem = Readonly<{
  id: string
  changeSetId: string | null
  operationId: string
  status: AssistChangeStatus
  label: string
  detail: string | null
  startTicks: number | null
  durationTicks: number | null
  seekTicks: number | null
  blockedReason: string | null
  operationKind: string
}>
```

Suggested function:

```ts
export function buildAssistChangeItems(input: {
  project: EditProject
  proposal: PendingProposal | null
}): readonly AssistChangeItem[]
```

Rules:

- accepted operations come from accepted change sets;
- pending operation comes from the detached proposal;
- blocked records remain visible but marked;
- do not mutate project/proposal;
- use stable operation/change-set IDs;
- preserve accepted order;
- append pending proposal after accepted work;
- support future multi-operation change sets;
- do not assume every operation has a time range;
- never invent a timestamp;
- unknown timing produces `null`;
- unknown operation kinds use a safe fallback label.

## Timing derivation

Use existing canonical helpers where they exist.

For proposal nameplates, use the existing proposal placement result.

For accepted operations:

- inspect canonical operation fields;
- use composition-aware mapping where required;
- seek to the affected start when trustworthy;
- use the center only when start is unavailable but an interval is reliable;
- do not use source time as composition time without mapping.

Create a helper:

```ts
type OperationPresentation = Readonly<{
  label: string
  detail: string | null
  interval: {
    startTicks: number
    durationTicks: number
  } | null
}>
```

The helper should be exhaustive over currently supported operations where practical.

Fallback:

```text
label: existing describeOperation(operation)
interval: null
```

---

# 11. Assist change strip

The change strip is not Timeline V1.

It is a compact semantic summary.

## Behavior

- horizontal list of chips/cards;
- accepted and pending visually distinct;
- blocked state distinct without color alone;
- current selected change has a clear outline;
- clicking a timed item seeks the shared playhead;
- untimed items are not fake links;
- keyboard Enter/Space activates timed items;
- focused item is visible;
- pending item includes “Pending” text;
- maximum visible density is controlled;
- long history does not create an enormous page.

Suggested display:

```text
Changes
[Cut at 00:12] [Added title] [Nameplate · Pending]
```

For more than a reasonable number:

```text
[Recent change] [Recent change] [+7 earlier]
```

The full history remains available in Studio.

## Props

```ts
export type AssistChangeStripProps = {
  items: readonly AssistChangeItem[]
  selectedId: string | null
  onSelect(id: string): void
  onSeek(ticks: number): void
  onOpenStudio(): void
}
```

## Empty state

```text
“No changes yet. Ask Sanverse for an edit or point at the video.”
```

## Accessibility

- `<section aria-labelledby>`;
- list semantics;
- buttons only when actionable;
- status text included in accessible name;
- do not rely only on color;
- horizontal scroll retains keyboard visibility.

---

# 12. Assist proposal panel

Create one focused proposal panel.

It must not duplicate proposal business state.

It receives the existing proposal and callbacks.

## States

### No proposal

Show:

```text
Tell Sanverse what you want to change.
Pause and point when location matters.
Nothing changes until you accept a proposal.
```

### Sending

Show truthful status:

```text
“Preparing a proposal… Nothing has changed yet.”
```

Do not invent hidden reasoning steps.

### Clarification

Display the current clarification near the composer.

### Pending proposal

Show:

- plain-language title;
- secondary text when present;
- affected start;
- duration;
- origin;
- note/warning;
- operation count;
- detached/pending status;
- repair controls;
- Reject;
- Accept;
- Open in Studio.

## Required actions

### Accept

Calls the existing `onAcceptProposal`.

### Reject

Calls the existing discard callback.

### Refine

For current nameplate proposals:

- focus existing repair controls;
- do not ask the model again;
- keep proposal detached.

Do not present Refine as a working button unless it performs a real action.

### Open in Studio

Switches workspace to Studio while preserving:

- proposal;
- video;
- playhead;
- point;
- repair values.

The panel itself must not own workspace state.

## Confirmation language

Use:

```text
“Pending — preview only”
```

Avoid:

```text
“Applied”
```

until the server accepts the change set.

---

# 13. Conversation composer

## Placement

In Assist, place the composer close to the canvas/proposal.

Do not bury it under history and export.

## Copy

Default placeholder should be broad enough for the current supported capability:

```text
“Describe what you want to change…”
```

Contextual hint:

```text
“Pause and point first when placement matters.”
```

Do not imply that arbitrary editing requests are supported by the current fake provider.

## State continuity

The unsent text must survive Assist ↔ Studio.

Current `ChatComposer` owns local `message`.

Acceptable solutions:

### Preferred minimal solution

Keep the same `ChatComposer` instance mounted and move it through stable CSS layout.

### Alternative

Hoist the unsent message into the shared editor session and make `ChatComposer` controlled.

Do not render one ChatComposer in Assist and another in Studio.

## IDs

The current hard-coded `studio-chat` ID should be reviewed.

Use an ID that remains semantically correct in both workspaces, such as:

```text
editor-chat
```

Only change this if tests and associated CSS are updated.

---

# 14. Shared video canvas

The video canvas remains the main surface.

## Requirements

- exactly one `<video>`;
- same ref through workspace switch;
- same source;
- same playback position;
- same overlay compilation;
- same pending proposal preview;
- same point marker;
- same point interaction;
- same gap/black-frame behavior;
- same reduced-motion behavior;
- no duplicate preview compiler;
- no second set of event listeners;
- no new object URLs.

## Assist presentation

- reduce engineering headings;
- increase visual size;
- keep local-source label subtle;
- place point action adjacent to the canvas;
- show a clear cursor/marker;
- keep instructions short.

## Point mode

Existing keyboard behavior must remain:

- Arrow keys move;
- Enter chooses;
- Escape cancels.

Point mode must pause playback as it does now.

---

# 15. Existing engineering controls

P0-D must not delete working controls.

In Assist:

- hide or collapse engineering-heavy controls.

In Studio:

- preserve current controls until P0-E and Timeline V1 replace them.

Do not remove:

- split;
- remove;
- hide/show;
- trim;
- reorder;
- gain/fades;
- captions;
- overlays;
- export result;
- existing repair.

A P0-D refactor must not break Studio.

---

# 16. Export state

EditorShell already exposes Export.

Assist should show export result contextually:

- rendering;
- failure;
- ready/download.

Avoid presenting a second full Export section when the top bar and status are sufficient.

The existing download link must remain reachable.

Export must remain disabled when:

- no accepted edits;
- proposal is pending;
- export is already running.

Do not change export eligibility rules in P0-D.

---

# 17. History presentation

Assist:

- compact semantic strip;
- recent work only;
- no long numbered engineering history list;
- “Open in Studio” for full history.

Studio:

- preserve current full history until P0-E redesigns it.

Blocked records:

- visible;
- plain language;
- include “Needs attention.”

---

# 18. Styling contract

## Character

- calm;
- precise;
- lightweight;
- neutral;
- footage-first;
- not dashboard-like;
- not filled with cards;
- not glass-heavy.

## Typography

Avoid excessive 0.65rem uppercase labels.

Use readable minimums for important controls.

Suggested hierarchy:

```text
workspace title: 18–22px
panel heading: 14–16px
body: 13–15px
secondary: 12–13px
micro label: 11–12px, sparingly
```

## Spacing

Use the existing token scale.

Prefer a small number of consistent gaps.

## Borders

Do not draw a strong border around every section.

Use:

- surface changes;
- subtle dividers;
- spacing;
- selected outlines.

## Motion

Default:

- 120–180ms;
- opacity/transform;
- interruptible;
- no bounce during precision interactions.

Workspace switching:

- subtle fade/position;
- do not animate the video element out/in;
- respect reduced motion.

## Color

Pending and accepted must differ with:

- text;
- icon/marker;
- border pattern;
- not color alone.

---

# 19. Responsive contract

Test at:

```text
1440 × 900
1280 × 800
1024 × 768
```

At 1440:

- video dominates;
- composer and proposal can share a lower row or side rail;
- change strip remains compact.

At 1280:

- no clipped top bar;
- proposal actions remain visible;
- readable side content.

At 1024:

- stack secondary panels;
- no tiny fixed-width conversation column;
- changes strip scrolls horizontally;
- top bar may compact labels without hiding essential actions.

Do not optimize P0-D for phone editing.

---

# 20. Performance constraints

- one video element;
- one preview compilation path;
- no duplicate overlays;
- no request per timeupdate;
- no full project serialization per playhead update;
- memoize derived change items;
- do not render hundreds of history entries in Assist;
- no new animation dependency;
- no production import of P0-R spike;
- no new large package unless justified and reported.

Record bundle size before and after.

Unexpected bundle growth must be explained.

---

# 21. Accessibility contract

## Keyboard

- workspace switch keyboard works;
- Undo/Redo reachable;
- Export reachable;
- composer reachable;
- proposal actions reachable;
- change items reachable;
- Point mode keyboard works;
- Open in Studio reachable.

## Focus

When proposal arrives:

- proposal panel receives programmatic focus only when useful;
- do not steal focus repeatedly.

After Accept/Reject:

- focus moves to result/status or composer.

When entering Point:

- point layer receives focus.

After choosing/cancelling:

- focus returns to Point button.

## Announcements

Use live regions for:

- sending;
- proposal ready;
- accepted;
- rejected;
- save error;
- export ready/error.

Avoid announcing every playhead update.

## Reduced motion

Existing global reduced-motion behavior must remain.

---

# 22. Error handling

P0-D errors must say:

- what happened;
- what remains safe;
- what the user can do next.

Examples:

```text
“We could not prepare that proposal. Your video and accepted edits were not changed.”
```

```text
“This edit could not be saved locally. It is still open in this session.”
```

Do not show:

- stack traces;
- provider names;
- raw error codes;
- filesystem paths.

Preserve structured error logging internally.

---

# 23. Test plan

## Pure model tests

`assist-change-model.test.ts`

Cover:

1. no accepted changes and no proposal;
2. accepted split;
3. accepted remove;
4. accepted trim;
5. accepted audio change;
6. accepted title/overlay;
7. pending proposal;
8. accepted plus pending;
9. blocked record;
10. unknown operation fallback;
11. operation without reliable timing;
12. stable order;
13. input immutability;
14. future multi-operation change set.

## Change strip tests

Cover:

- empty state;
- accepted label;
- pending label;
- blocked label;
- timed click seeks;
- untimed item does not fake seek;
- keyboard activation;
- selected state;
- long list compaction;
- Open in Studio.

## Proposal panel tests

Cover:

- empty state;
- pending status;
- timing;
- AI origin;
- direct origin;
- notes;
- Accept;
- Reject;
- Refine focus;
- Open in Studio;
- disabled/busy behavior;
- error display.

## App/continuity tests

Cover:

1. Assist opens by default.
2. Switch Assist → Studio → Assist.
3. Exactly one video element.
4. Same video DOM identity when possible.
5. Playback position survives.
6. Project revision survives.
7. History survives.
8. Pending proposal survives.
9. Repair state survives.
10. Point target survives.
11. Undo/Redo availability survives.
12. Save state survives.
13. Export state survives.
14. Unsent chat draft survives.
15. Studio engineering controls remain usable.
16. Assist hides engineering-heavy controls.
17. Accept in Assist follows existing server path.
18. Reject changes no accepted history.
19. Open in Studio preserves proposal.

## Existing regression tests

Run focused existing suites around:

- `EditorShell`;
- `App`;
- `StudioScreen`;
- `ChatComposer`;
- point targeting;
- proposal repair;
- render preview;
- timeline edits.

Do not run unrelated expensive suites unless a changed shared boundary requires them.

## Build

```bash
npm run build --workspace @sanverse/web
```

Also run type checking if separate.

---

# 24. Browser walkthrough

Use a real project such as the known `test-30s.mp4`.

Required steps:

1. Start API.
2. Start web app.
3. Open existing project.
4. Confirm Assist default.
5. Capture 1440×900 Assist screenshot.
6. Capture 1280×800 Assist screenshot.
7. Capture 1024×768 Assist screenshot.
8. Play and seek video.
9. Enter text but do not send.
10. Switch to Studio and back.
11. Confirm unsent text remains.
12. Confirm current playback time remains.
13. Confirm exactly one video element.
14. Create or load a pending proposal.
15. Switch workspaces.
16. Confirm proposal remains.
17. Repair proposal in Assist.
18. Open in Studio.
19. Confirm repaired values remain.
20. Accept proposal.
21. Confirm compact change appears accepted.
22. Undo.
23. Redo.
24. Trigger export when eligible.
25. Verify result/download.
26. Check console.
27. Check failed network requests.
28. Check horizontal overflow.
29. Complete keyboard walkthrough.
30. Test reduced motion.

Screenshots must show the actual running application, not static mockups.

---

# 25. Owner-review questions

Codex must ask the owner to judge:

1. Is the video clearly the main focus?
2. Is the instruction composer obvious?
3. Is “nothing changes until Accept” understandable?
4. Is Point discoverable?
5. Is the proposal panel understandable?
6. Are pending and accepted changes clearly different?
7. Does Assist feel simpler than Studio?
8. Does switching feel continuous?
9. Is any text too small?
10. Is anything visually noisy?
11. Does the layout feel premium rather than like an admin dashboard?
12. Can a normal user tell what to do next?

Do not self-approve visual taste.

---

# 26. P0-D acceptance gate

P0-D is technically complete only when:

```text
[ ] Assist opens by default.
[ ] One shared editor session remains.
[ ] Exactly one video element remains.
[ ] Video is dominant.
[ ] Composer is obvious.
[ ] Point is understandable.
[ ] Proposal is clearly pending.
[ ] Accept/Reject work.
[ ] Existing repair works.
[ ] Open in Studio works.
[ ] Accepted changes are compactly visible.
[ ] Timed changes can seek without guessing.
[ ] Engineering controls are hidden from Assist.
[ ] Studio regression remains functional.
[ ] Workspace continuity tests pass.
[ ] Unsent composer text survives.
[ ] Laptop layouts work.
[ ] Keyboard walkthrough works.
[ ] Reduced motion works.
[ ] Focus behavior works.
[ ] Production build passes.
[ ] Bundle change is reported.
[ ] Browser screenshots exist.
[ ] Failures are recorded.
```

Product approval remains open until the owner reviews the real UI.

---

# 27. P0-D explicit non-goals

Do not implement:

- P0-E Studio structure;
- TimelineViewModel;
- production Timeline V1;
- draggable clips;
- track headers;
- waveforms;
- snapping;
- Inspector;
- media bin;
- canvas resize/rotate handles;
- new domain operations;
- general multitrack;
- real transcription;
- real AI provider;
- motion graphics;
- color grading;
- tracking;
- segmentation;
- MCP;
- SaaS;
- OpenCut production components.

Do not modify renderer or project schemas to make the layout easier.

---

# 28. Failure policy

Record nonblocking failures.

Every record includes:

- What?
- Where?
- When?
- Who is affected?
- Why?
- How reproduced?
- What was tried?
- Evidence?
- Blocking?
- One-line solution?
- Status?

Fix immediately when the failure risks:

- data loss;
- project corruption;
- source mutation;
- broken workspace continuity;
- duplicate video/session;
- incorrect accepted state;
- invalid export;
- security/privacy;
- inaccessible core workflow.

Do not hide a milestone-invalidating defect in the registry.

---

# 29. P0-D atomic implementation order

## P0-D.1 — Baseline

- verify branch/SHA;
- run current focused tests;
- record current bundle;
- capture current Assist screenshots;
- confirm one video.

## P0-D.2 — Pure presentation model

- add operation presentation helper;
- add change model;
- exhaustive focused tests.

## P0-D.3 — Compact change strip

- implement component;
- timed seeking;
- pending/accepted/blocked states;
- accessibility tests.

## P0-D.4 — Proposal panel

- implement empty/pending/error states;
- reuse existing repair;
- actions;
- Open in Studio;
- tests.

## P0-D.5 — Assist layout

- video-first grid;
- composer placement;
- proposal placement;
- point controls;
- hide engineering controls;
- preserve one mounted session.

## P0-D.6 — State continuity

- unsent text continuity;
- video identity/time;
- proposal;
- repair;
- point;
- history;
- save/export.

## P0-D.7 — Responsive/accessibility

- viewports;
- focus;
- keyboard;
- reduced motion;
- live regions.

## P0-D.8 — Verification

- focused tests;
- build;
- browser walkthrough;
- screenshots;
- console/network;
- diff review;
- failure registry;
- report;
- stop.

---

# 30. Required Codex report

```text
P0-D IMPLEMENTATION REPORT

Active branch:
Start commit:
End commit:
Working tree:

Objective:
Implemented:
Not implemented:

Files created:
Files modified:
Files deleted:

Current component tree:
State ownership:
How one video element was preserved:
How unsent chat text was preserved:
How proposal state was preserved:

Assist layout:
Desktop behavior:
Laptop behavior:
Reduced-motion behavior:

Change model:
Operation kinds covered:
Operations without timing:
Fallback behavior:

Proposal behavior:
Accept:
Reject:
Refine:
Open in Studio:

Tests:
- exact command
- result

Build:
- exact command
- result
- baseline bundle
- final bundle
- difference

Browser walkthrough:
- server commands
- project/fixture
- exact steps
- results

Screenshots:
- 1440×900
- 1280×800
- 1024×768

Console errors:
Network errors:
Accessibility findings:
Performance findings:

Blocking failures:
Nonblocking failures:
Failure registry entries:

Acceptance checklist:
Owner review still open:

Exact next task:
Stop confirmation:
```

---

# 31. Stop condition

Stop immediately after:

- P0-D code;
- tests;
- production build;
- real browser walkthrough;
- screenshots;
- report;
- pushed commit.

Do not begin P0-E.

Do not begin Timeline V1.

---

# 32. Exact next task after owner approval

After P0-D is approved:

```text
P0-E — Complete Studio workspace structure
```

P0-E builds the destination layout:

```text
media region
+ central canvas
+ Inspector region
+ timeline region
+ collapsible AI panel
```

P0-E still does not implement deep Timeline V1 behavior.

---

# 33. Ordered implementation after P0-D

This section is context only.

Do not start these tasks during P0-D.

## P0-E — Studio structure

- media region;
- canvas;
- Inspector region;
- timeline region;
- AI drawer;
- resizable/collapsible panels;
- current controls relocated;
- owner layout approval.

## P1-A — Timeline presentation foundation

Create:

```text
apps/web/src/features/timeline/timeline-view-model.ts
apps/web/src/features/timeline/timeline-gesture-adapter.ts
apps/web/src/features/timeline/timeline-viewport-state.ts
```

Rules:

- derived from `EditProject`;
- never persisted;
- no second project model;
- gestures emit Sanverse operations.

## P1-B — Production Timeline V1

Create:

```text
apps/web/src/editor/timeline/Timeline.tsx
apps/web/src/editor/timeline/TimelineRuler.tsx
apps/web/src/editor/timeline/TimelineViewport.tsx
apps/web/src/editor/timeline/TrackRow.tsx
apps/web/src/editor/timeline/ClipBlock.tsx
apps/web/src/editor/timeline/Playhead.tsx
apps/web/src/editor/timeline/timeline-math.ts
apps/web/src/editor/timeline/timeline.css
```

Rows:

```text
V2 overlays/titles/B-roll
V1 primary footage
C1 captions
A1 dialogue
A2 music
```

Features:

- ruler;
- playhead;
- seek;
- scroll;
- zoom;
- selection;
- gaps;
- clip blocks;
- trim;
- split;
- delete;
- ripple;
- reorder;
- hide/show;
- proposal ghosts;
- keyboard;
- Undo/Redo.

## P1-C — Inspector V1

Expose existing engine capabilities:

- timing;
- position;
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

## P1-D — Canvas manipulation

- move;
- resize;
- rotate;
- crop;
- snapping;
- guides;
- keyboard nudge;
- gesture-end commit;
- proposal repair.

## P1-E — Media bin

- project assets;
- thumbnail/icon;
- type;
- duration;
- search;
- add;
- usage;
- missing/offline;
- safe removal.

## P1-F — AI proposal visualization

Show pending operations in:

- timeline;
- canvas;
- Inspector;
- proposal list.

Use ghost styling.

One Accept creates one revision.

One Undo reverses the accepted change set.

## P1-G — Talking-head workflow gate

Real workflow:

```text
upload
→ cuts
→ captions
→ nameplate/title
→ B-roll
→ music
→ punch-in
→ repair
→ accept
→ Undo/Redo
→ export
→ reopen
```

Measure time saved and publishability.

## P2 — General NLE foundation

- multiple video/audio tracks;
- append;
- insert;
- overwrite;
- linked A/V;
- lock/mute/solo;
- sync lock;
- markers;
- snapping;
- overlapping render.

## P2 professional tools

- roll;
- slip;
- slide;
- lift;
- extract;
- source in/out;
- three-point edit;
- match frame;
- replace.

## P3 — Real intelligence

- transcription;
- transcript correction;
- text-based editing;
- provider adapters;
- two-provider corpus;
- compound plans;
- latency/cost/evaluation.

## P4 — Motion graphics

- counters;
- lower thirds;
- title cards;
- highlights;
- arrows;
- chapters;
- quote cards;
- product cards;
- charts;
- diagrams.

## P5 — Audio/color/perspective

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

## P6 — Effects/compositing

- ordered effect stack;
- masks;
- blend modes;
- adjustment layers;
- constrained graph;
- later OpenFX/Natron evaluation.

## P7 — Vision/tracking

- observations;
- target resolution;
- tracking;
- segmentation;
- correction UI;
- text behind subject;
- tracked callouts.

## P8 — API/SDK/MCP

- application services;
- HTTP API;
- SDK;
- MCP adapter;
- project-scoped tools.

## P9 — SaaS

- authentication;
- tenancy;
- storage;
- jobs;
- workers;
- quotas;
- billing;
- monitoring;
- retention;
- recovery.

---

# 34. Complete copy-paste instruction for Codex

```text
ACTIVE TASK: P0-D — FINISH THE ASSIST WORKSPACE

Start from:
branch agent/g6-g8-local-alpha
commit 836adb788ad59e9d99bbe5970afba5badfa1ebae

Read:
- DOCS/plans/SANVERSE_CODEX_MASTER_IMPLEMENTATION_PLAN.md
- this P0-D implementation contract
- DOCS/decisions/P0-R_OPENCUT_TIMELINE_REUSE_DECISION.md
- CLAUDE.md
- DOCS/CURRENT_STATE.md
- DOCS/HANDOFF.md
- DOCS/FAILURE_REGISTRY.md

Verify branch, SHA and clean tree.

Goal:
Turn Assist into a genuinely simple default workspace while preserving the
single mounted Sanverse editor session.

Non-negotiable:
- one EditorShell
- one project
- one revision
- one video element
- one playhead
- one pending proposal
- one history
- one preview/export path

Implement:
1. A video-first Assist layout.
2. A compact semantic change model derived from accepted change sets and the
   pending proposal.
3. A compact changes strip with accepted, pending and blocked states.
4. Honest timed seeking only where canonical timing can be derived.
5. A focused proposal panel with empty, sending, clarification, pending, error,
   accepted and rejected feedback.
6. Reuse existing proposal repair.
7. Accept, Reject, Refine and Open in Studio behavior.
8. Keep the same ChatComposer mounted or hoist its draft so unsent text survives
   workspace switching.
9. Keep the same video element mounted.
10. Keep point mode and its keyboard behavior.
11. Hide engineering-heavy controls from Assist but preserve them in Studio.
12. Preserve project, revision, playhead, point, pending proposal, repair state,
    conversation, history, Undo/Redo, save state and export state.
13. Use existing UI primitives/tokens.
14. Add laptop-responsive behavior.
15. Add focused accessibility and continuity tests.
16. Run the required web build and a real browser walkthrough.
17. Capture screenshots at 1440×900, 1280×800 and 1024×768.
18. Record nonblocking failures.
19. Push one focused commit.
20. Stop before P0-E.

Do not implement:
- P0-E
- TimelineViewModel
- Timeline V1
- draggable clips
- Inspector
- media bin
- new domain operations
- renderer changes
- general multitrack
- real provider
- transcription
- motion graphics
- tracking
- MCP

Required evidence:
- focused tests
- existing continuity tests
- web production build
- baseline/final bundle comparison
- one-video-element assertion
- playback continuity
- unsent composer continuity
- proposal/repair continuity
- Assist→Studio→Assist walkthrough
- screenshots
- console/network findings
- complete implementation report

Stop after the P0-D report and owner-review evidence.
```

---

# 35. Final rule

P0-D is successful when Assist feels like:

```text
video
→ ask
→ point
→ preview
→ refine
→ accept
```

not:

```text
an engineering dashboard with chat added.
```
