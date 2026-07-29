# SANVERSE — CODEX MASTER IMPLEMENTATION PLAN

**Version:** 2026-07-29  
**Repository:** `budhasantosh010/stage-2-sanverse-video-editing-`  
**Current implementation branch reported by Codex:** `agent/g6-g8-local-alpha`  
**Current verified P0 shell commit:** `993a73d06a07cf79e57fd132b21fed0291b38c2b`

---

## 0. Read this first

This document is the durable implementation contract for Sanverse.

It is not permission to build everything in one task.

Every phase below must be handled as a small, reviewable, reversible milestone with:

- explicit scope;
- explicit non-goals;
- tests;
- browser evidence;
- failure recording;
- an exit gate;
- an exact stopping point.

The highest-impact objective is:

> Turn the existing deterministic editing foundation into one coherent product where Assist, Studio, manual controls, AI planning, pointing, preview, correction, history, and export all use the same project and operation system.

---

# 1. Repository-state gate

Before working, Codex must verify the actual source state.

Run:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
git log -1 --oneline
git branch -vv
```

Expected P0 shell commit:

```text
993a73d06a07cf79e57fd132b21fed0291b38c2b
```

The uploaded ZIP supplied to GPT was not this state. It was an older July 26 snapshot. It lacked:

```text
apps/web/src/editor/EditorShell.tsx
apps/web/src/editor/EditorShell.css
apps/web/src/editor/EditorShell.test.tsx
apps/web/src/editor/ui/Button.tsx
apps/web/src/editor/ui/IconButton.tsx
apps/web/src/editor/ui/SegmentedControl.tsx
apps/web/src/editor/ui/Panel.tsx
apps/web/src/editor/ui/Tabs.tsx
```

Do not use the old archive as current authority.

Current truth must come from:

1. checked-out branch and SHA;
2. current code;
3. current tests;
4. current runtime;
5. then current documentation.

When documents contradict code, record the contradiction and use code/runtime evidence for the active task.

---

# 2. Truthful feature-status vocabulary

Never mark something “complete” merely because a type, schema, validator, renderer node, test fixture, hidden API, or checklist entry exists.

Use these status levels:

## FOUNDATION

A type, schema, algorithm, adapter boundary, or renderer primitive exists.

## ENGINE-READY

A deterministic operation can be validated, persisted, previewed, exported, and undone.

## UI-EXPOSED

A human can directly use it through a coherent interface.

## AI-EXPOSED

The capability registry permits AI to propose it through validated structured output.

## PRODUCT-READY

The capability has:

```text
domain operation
+ application service/API
+ manual UI
+ AI mapping when applicable
+ browser preview
+ final export
+ direct repair
+ persistence
+ Undo/Redo
+ migration compatibility
+ automated evidence
+ human usability evidence
```

## PRODUCTION-READY

The capability also passes:

- security;
- privacy;
- performance;
- recovery;
- observability;
- operational reliability;
- multi-user isolation where applicable.

Use a capability matrix with columns:

```text
Capability
Domain
API
Manual UI
AI
Preview
Export
Repair
Undo
Persistence
Tests
Human evidence
Status
```

---

# 3. Current verified product state

Commit `993a73d` added P0-B and P0-C only.

## Added

```text
apps/web/src/editor/EditorShell.tsx
apps/web/src/editor/EditorShell.css
apps/web/src/editor/EditorShell.test.tsx

apps/web/src/editor/ui/Button.tsx
apps/web/src/editor/ui/IconButton.tsx
apps/web/src/editor/ui/Panel.tsx
apps/web/src/editor/ui/SegmentedControl.tsx
apps/web/src/editor/ui/Tabs.tsx
apps/web/src/editor/ui/index.ts
apps/web/src/editor/ui/ui.css
```

## Modified

```text
apps/web/src/app/App.tsx
apps/web/src/app/App.test.tsx
apps/web/src/screens/studio/StudioScreen.tsx
apps/web/src/screens/studio/StudioScreen.css
apps/web/src/styles/tokens.css
```

## Current shell behavior

The EditorShell provides:

- project identity;
- save status;
- Assist/Studio selector;
- Undo;
- Redo;
- Export;
- one shared child editor session.

The current App keeps the same StudioScreen/editor session mounted and passes a workspace value into it. This is good for continuity, but it means Assist and Studio are not yet fully separated, polished workspace implementations.

Current verified continuity:

- same project;
- same revision;
- same mounted video;
- same playback position;
- same pending proposal;
- same history;
- same Undo/Redo;
- same save state;
- same export state.

Current test evidence reported by Codex:

- 12 focused tests passed;
- web production build passed;
- browser walkthrough passed;
- nine history entries survived switching;
- exactly one video element remained mounted.

## Current known failures

### FAIL-017

Older authority documents describe obsolete pre-G4 state.

### FAIL-018

Vite HMR WebSocket hostname mismatch. The app loads, but development hot reload is unreliable.

These are nonblocking for product implementation unless they interfere with the active task.

---

# 4. Product architecture

Sanverse is not:

- a chat box that emits FFmpeg commands;
- a second AI-only editor beside a manual editor;
- a fork where another editor owns project state;
- a frontend that lets AI click buttons;
- a template generator that loses editability after rendering.

Sanverse is:

```text
user intent
+ direct manipulation
+ pointing/drawing
+ video observations
        ↓
validated typed operations
        ↓
detached proposal
        ↓
visible preview on canvas/timeline/inspector
        ↓
human correction
        ↓
accept or reject
        ↓
canonical project revision
        ↓
browser preview and deterministic export
```

Core law:

```text
AI proposes.
Code validates.
Renderer previews.
User corrects.
User accepts.
Project records.
Exporter executes.
```

Manual and AI actions share one path:

```text
manual UI gesture ─┐
                   ├──> typed operation/change set
AI proposal ───────┘               ↓
                              project service
                                   ↓
                         canonical project state
                                   ↓
                        preview and final export
```

AI must never:

- click frontend controls through automation;
- mutate project files directly;
- invoke FFmpeg directly;
- bypass validation;
- bypass stale-revision checks;
- accept its own work;
- use a second project format;
- use a second history system;
- use a separate renderer.

---

# 5. One engine, two workspaces

## Shared engine

Assist and Studio share:

- project;
- project revision;
- assets;
- composition;
- clip instances;
- tracks;
- playhead;
- selected range;
- selected item;
- selected annotation;
- pending proposal;
- proposed operations;
- accepted change sets;
- Undo/Redo;
- browser preview;
- export job;
- save state;
- render contract.

## Assist

Assist is default.

Assist is optimized for:

- non-editors;
- natural language;
- pointing/drawing;
- proposal review;
- lightweight correction;
- progressive disclosure.

Assist is not a crippled Premiere clone.

## Studio

Studio exposes precision:

- media bin;
- program canvas;
- inspector;
- timeline;
- track controls;
- canvas manipulation;
- effects;
- keyframes;
- audio;
- future color;
- AI activity panel.

Switching workspaces must never convert or reload the project.

---

# 6. What Sanverse must own

These are the moat and control plane.

Do not surrender them to an imported editor:

```text
canonical project/edit graph
stable entity identities
exact time model
asset/clip-instance model
typed operations
capability registry
project revisions
change sets
Undo/Redo semantics
AI proposal contract
detached preview state
validation pipeline
accept/reject workflow
repair workflow
spatial annotations
semantic anchors
component contracts
Assist/Studio continuity
AI-operation visualization
audit/evaluation traces
user correction and preference data
```

An external timeline may display these objects, but it must not become their authority.

---

# 7. What should be borrowed

Potential reuse targets:

```text
timeline ruler and scrolling
timeline zoom
timeline virtualization
clip dragging
trim handles
snapping
waveform drawing
thumbnail generation
media decode/encode
multitrack rendering
timeline interchange
audio DSP
color management
effect standards
tracking models
segmentation models
professional-editor integration
```

Adopt only through clean boundaries.

---

# 8. Open-source decision matrix

## OpenCut

**Best candidate for selective timeline UI reuse.**

Investigate:

- ruler;
- zoom;
- horizontal scrolling;
- clip blocks;
- selection;
- trim handles;
- drag behavior;
- snapping;
- waveform rendering;
- virtualization;
- number-field interaction;
- keyboard behavior.

Do not automatically adopt:

- project schema;
- global store;
- renderer;
- export;
- database;
- authentication;
- authoritative Undo;
- entire shell.

Required boundary:

```text
OpenCut-derived UI
→ emits Sanverse gestures/commands
→ Sanverse builds typed operation
→ server validates and applies
→ Sanverse project remains authoritative
```

## OpenTimelineIO

Use for:

- rational-time ideas;
- clips;
- tracks;
- gaps;
- transitions;
- markers;
- nested compositions;
- future interchange.

Do not expect:

- browser UI;
- renderer;
- effects;
- AI state;
- Sanverse proposal state.

Build an adapter later:

```text
Sanverse project ↔ OTIO
```

## MLT

Future render-engine spike only.

Do not replace current FFmpeg pipeline before evidence.

Spike:

```text
two video tracks
+ two audio tracks
+ title
+ transform
+ transition
+ export
```

Compare:

- code complexity;
- speed;
- deployment;
- fidelity;
- licensing configuration;
- preview compatibility.

## Kdenlive

Study:

- clip lifecycle;
- ripple semantics;
- bins;
- proxies;
- groups;
- relinking;
- transitions;
- sequence handling;
- waveform caching;
- Undo commands.

Do not directly copy GPL desktop code into a proprietary web frontend without legal review.

## Natron

Study:

- compositing graph;
- masks;
- rotoscoping;
- OpenFX;
- caching;
- tracking;
- color pipeline.

Do not treat Natron as the timeline or Assist foundation.

## Premiere Pro / DaVinci Resolve

Future integration and finishing targets.

Use official APIs, scripts, plugins, or interchange.

Their source is not available for direct reuse.

## CapCut / ChatCut / hosted editors

UX references unless an explicit licensed repository or API exists.

Do not copy proprietary source, assets, templates, internal APIs, or reverse-engineered formats.

---

# 9. Third-party governance

Before vendoring code, create:

```text
THIRD_PARTY_NOTICES.md
third_party/manifest.json
```

Each record:

```json
{
  "name": "adopted module",
  "repository": "upstream repository",
  "commit": "exact SHA",
  "license": "exact license",
  "files": [],
  "modifications": [],
  "reason": "why adopted",
  "maintainer": "Sanverse owner",
  "upgradePolicy": "manual review",
  "lastReviewed": "ISO date"
}
```

No untracked copy/paste.

---

# 10. Core project invariants

## Stable IDs

Use stable IDs for:

- project;
- asset;
- composition;
- sequence;
- track;
- clip instance;
- operation;
- change set;
- annotation;
- component;
- render job;
- proposal;
- observation.

Array positions are not identities.

## Time spaces

Distinguish:

- source time;
- clip-local time;
- composition time;
- duration;
- audio sample time where necessary.

Use the repository’s exact/rational-time contract.

Do not add canonical floating-point seconds.

## Coordinate spaces

Distinguish:

- browser screen;
- source-normalized;
- clip-normalized;
- composition-normalized;
- object-local.

Every spatial edit declares its coordinate space.

## Temporal anchors

Future anchor families:

- clip-local;
- composition;
- transition;
- semantic;
- object-track.

No unexplained timestamps.

## Revision pinning

Every proposal and render job pins:

- project revision;
- capability registry version;
- render contract version;
- relevant observation revision.

Stale work fails closed.

## Transactions

One natural-language request creates one pending change set.

A change set can contain multiple operations later.

Accept/reject/Undo operate on the change set.

---

# 11. Capability registry

Every human- or AI-operable tool must register a capability.

Example:

```json
{
  "capabilityId": "set_visual_properties",
  "version": "1.0.0",
  "description": "Change position, scale, rotation and opacity.",
  "inputSchema": {},
  "supportedTargets": ["clip", "overlay", "title", "nameplate"],
  "validators": [],
  "manualUI": {
    "inspector": true,
    "canvas": true,
    "timeline": true
  },
  "previewSupport": "exact",
  "exportSupport": "exact",
  "repairModes": ["inspector", "canvas"],
  "undoPolicy": "change-set"
}
```

Every capability answers:

- which targets;
- required inputs;
- defaults;
- validators;
- manual UI;
- AI availability;
- preview support;
- export support;
- repair behavior;
- visualization behavior;
- Undo behavior;
- required renderer version.

AI only sees capabilities available in the current environment.

---

# 12. Operation visualization contract

Every operation needs:

- plain-language label;
- icon;
- affected IDs;
- affected track;
- affected time range;
- timeline representation;
- canvas representation;
- inspector representation;
- proposed styling;
- accepted styling;
- blocked/error styling;
- history description;
- Undo behavior.

Examples:

## Split

```text
Timeline: proposed split line / accepted boundary
History: “Split section at 00:14.2”
```

## Remove range

```text
Timeline: translucent removed interval
Summary: “Remove 2.8 seconds”
```

## Add title

```text
Timeline: overlay block
Canvas: ghost title
Inspector: title properties
```

## Zoom

```text
Timeline: transform interval/keyframes
Canvas: target region and resulting crop
Inspector: scale, position, easing
```

## Audio gain

```text
Timeline: gain badge/curve
Inspector: decibel value and fades
```

---

# 13. Premium UI foundation

Target premium behavior, not copied Apple decoration.

Principles:

- immediate feedback;
- restrained motion;
- precise spacing;
- excellent hierarchy;
- predictable behavior;
- direct manipulation;
- low perceived latency;
- strong focus and accessibility;
- no visible technical clutter.

Avoid:

- glass everywhere;
- expensive live blur;
- bouncing every control;
- long transitions;
- decorative progress;
- huge animation dependencies;
- spring lag during dragging.

Prefer:

- `transform`;
- `opacity`;
- short interruptible transitions;
- reduced-motion variants.

---

# 14. UI kernel expansion

Current primitives:

```text
Button
IconButton
SegmentedControl
Panel
Tabs
```

Add only when required.

## Foundation

```text
Tooltip
Popover
Menu
ContextMenu
Divider
Toolbar
ScrollArea
ResizablePanel
SplitPane
```

## Inputs

```text
TextField
TextArea
SearchField
NumberField
ScrubbableNumberField
Slider
Toggle
Checkbox
Select
```

## Feedback

```text
Progress
Spinner
Toast
InlineNotice
EmptyState
Dialog
Sheet
```

## Editor primitives

```text
InspectorSection
InspectorRow
KeyframeToggle
TimelineToolbar
TimelineRuler
TrackHeader
TrackRow
ClipBlock
CaptionBlock
TransitionBlock
Playhead
RangeSelection
Marker
Waveform
ProposalGhost
BoundingBox
CanvasHandles
CropOverlay
MaskOverlay
JobProgress
```

Do not build the whole library before it is needed.

---

# 15. Assist specification

## Layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ Sanverse Project [Assist | Studio] Undo Redo          Export      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│                       LARGE VIDEO CANVAS                           │
│                                                                    │
│        contextual point / circle / box / arrow tools               │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ COMPACT CHANGES STRIP                                              │
│ cut · captions · title · zoom · B-roll · audio                     │
├──────────────────────────────────────────────┬─────────────────────┤
│ Ask Sanverse…                                │ Proposal            │
│                                              │ Refine / Accept     │
└──────────────────────────────────────────────┴─────────────────────┘
```

## Always visible

- video;
- play/pause;
- scrub;
- instruction composer;
- Send;
- proposal status;
- Undo;
- Export;
- workspace switch.

## Contextual

- Point;
- Circle;
- Box;
- Arrow;
- Freehand;
- select range;
- move proposal;
- resize;
- retime;
- change text;
- one or two important controls;
- Open in Studio.

## Proposal summary

Show:

- plain-language summary;
- operation count;
- affected ranges;
- warnings;
- clarification;
- preview status;
- Refine;
- Accept;
- Reject;
- Open in Studio.

Do not show raw JSON by default.

---

# 16. Studio specification

## Layout

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Sanverse Project [Assist | Studio] Undo Redo Save Export              │
├───────────────┬────────────────────────────────────┬───────────────────┤
│ MEDIA BIN     │ PROGRAM CANVAS                     │ INSPECTOR         │
│ Video         │                                    │ Transform         │
│ Audio         │             VIDEO                  │ Crop              │
│ Images        │                                    │ Opacity           │
│ Titles        │                                    │ Mask              │
│ Components    │                                    │ Effects           │
│               │                                    │ Audio             │
├───────────────┴────────────────────────────────────┴───────────────────┤
│ Select | Blade | Trim | Hand | Text | Draw                           │
├────────────────────────────────────────────────────────────────────────┤
│ V2 [title]               [B-roll]                                     │
│ V1 [camera 1][camera 2]              [camera 3]                       │
│ C1 [captions...................................]                      │
│ A1 [dialogue........................................................] │
│ A2          [music..................................................] │
│                         ▲ playhead                                    │
└────────────────────────────────────────────────────────────────────────┘
```

AI panel is collapsible.

Do not overwhelm:

- show selected-item properties only;
- collapse advanced sections;
- keep canvas central;
- keep timeline readable;
- avoid displaying every control at once.

---

# 17. Complete implementation order

---

## P0-R — Open-source timeline reuse audit

**Do this before production Timeline V1.**

### Goal

Decide whether to:

- adopt selected OpenCut modules;
- vendor and adapt them;
- study them and build focused Sanverse code;
- reconsider a larger fork.

### Compatibility matrix

Evaluate:

1. license;
2. exact upstream commit;
3. React/framework compatibility;
4. state-store dependencies;
5. project-model dependencies;
6. renderer dependencies;
7. export dependencies;
8. Undo/history dependencies;
9. playhead;
10. selection;
11. zoom;
12. scrolling;
13. trim;
14. snapping;
15. waveform;
16. virtualization;
17. accessibility;
18. bundle impact;
19. memory impact;
20. upstream stability;
21. adaptation cost;
22. maintenance cost.

### Disposable sandbox

```text
Sanverse fixture
→ timeline adapter
→ OpenCut-derived view
→ playhead, selection, zoom, scroll
→ one split or trim gesture
→ Sanverse typed operation
```

Fixture:

- one primary video clip;
- one title;
- one caption range;
- one music item.

### Hard constraints

- no second project model;
- no OpenCut renderer;
- no OpenCut export;
- no OpenCut database;
- no OpenCut authentication;
- no replacement Undo;
- no production route replacement;
- no real AI provider;
- no broad multitrack implementation.

### Exit

Written adoption decision and exact production file plan.

---

## P0-D — Complete Assist structure

Tasks:

- improve hierarchy;
- prioritize canvas;
- integrate existing chat;
- integrate point mode;
- compact proposal summary;
- compact changes strip;
- contextual repair;
- remove engineering language;
- Open in Studio;
- responsive layout.

Exit:

A non-editor completes the current supported flow without professional terminology.

---

## P0-E — Complete Studio structure

Tasks:

- media-bin region;
- canvas region;
- inspector region;
- timeline region;
- collapsible AI panel;
- resizable/collapsible panels;
- relocate current engineering controls;
- approve hierarchy and density.

No deep Timeline V1 behavior yet.

---

## P1-A — Timeline view model

Build a derived UI model:

```text
EditProject → TimelineViewModel
TimelineGesture → typed operation/change set
```

Timeline view model fields:

- track ID;
- track kind;
- item ID;
- item kind;
- start;
- duration;
- source reference;
- enabled;
- selected;
- proposed;
- warnings;
- thumbnail/waveform references.

Do not persist the view model as a second project format.

---

## P1-B — Timeline V1

Initial rows:

```text
V2 overlays/titles/B-roll
V1 primary footage
C1 captions
A1 source/dialogue audio
A2 music
```

Features:

- ruler;
- playhead;
- click-to-seek;
- scroll;
- zoom;
- virtualization;
- track headers;
- proportional clips;
- gaps;
- selection;
- selected range;
- caption blocks;
- overlay blocks;
- audio blocks;
- hidden clips;
- proposal ghosts;
- split;
- trim;
- ripple delete;
- remove keeping gap;
- reorder;
- enable/disable;
- keyboard delete;
- snapping;
- Undo/Redo;
- context menu.

Non-goals:

- roll;
- slip;
- slide;
- three-point editing;
- multicam;
- nested sequences;
- professional routing;
- full shortcut editor.

Exit:

Every currently supported editorial operation can be manually performed and visually understood.

---

## P1-C — Inspector V1

### Clip inspector

- source summary;
- timing;
- enabled;
- position;
- scale;
- rotation;
- crop;
- opacity;
- layer;
- mask;
- effects;
- gain;
- fades;
- transition.

### Text inspector

- text;
- subtitle;
- style;
- typography;
- alignment;
- transform;
- opacity;
- timing;
- entrance/exit;
- layer;
- mask;
- effects.

### Caption inspector

- text;
- start/end;
- style;
- placement;
- line width;
- safe margins;
- grouping.

### Media overlay inspector

- asset;
- transform;
- crop;
- opacity;
- layer;
- mask;
- entrance/exit;
- audio.

### Music inspector

- start/end;
- gain;
- fades;
- mute.

### Keyframes V1

- enable keyframe;
- previous/next;
- easing preset;
- simple list or mini-lane.

Do not build a full curve editor yet.

Exit:

Existing engine properties are directly usable and exportable.

---

## P1-D — Canvas direct manipulation

Features:

- bounding box;
- move;
- resize;
- rotate;
- crop;
- mask visualization;
- center guides;
- safe margins;
- snapping;
- keyboard nudge;
- Escape cancellation.

State rule:

- pointer movement updates detached/local preview;
- gesture end creates one change set;
- no project revision per pointer event.

Exit:

Visual placement no longer requires typing coordinates.

---

## P1-E — Media bin V1

- list project assets;
- video;
- image;
- audio;
- transcript;
- components;
- thumbnail/icon;
- name;
- type;
- duration;
- search;
- add to timeline;
- usage indicator;
- missing/offline state;
- safe removal;
- no raw filesystem paths.

---

## P1-F — AI proposal visualization

Pending operations must appear as ghosts.

Examples:

```text
cut       → shaded removal interval
title     → translucent overlay block and canvas ghost
captions  → dotted caption blocks
B-roll    → ghost overlay clip
zoom      → highlighted transform interval
audio     → gain/fade badge
```

Interaction:

- click operation;
- jump to time;
- inspect parameters;
- repair;
- toggle when policy supports it;
- accept;
- reject.

Exit:

AI and manual edits visibly use the same editor.

---

## P1-G — Talking-head workflow gate

Real workflow:

```text
upload
→ remove pauses
→ captions
→ title/nameplate
→ B-roll/image
→ music
→ punch-in
→ repair one proposal
→ accept
→ Undo/Redo
→ export
→ reopen
```

Measure:

- time saved;
- corrections;
- preview latency;
- export time;
- failures;
- publishability.

Do not proceed based only on tests.

---

## P2-A — General multitrack foundation

Build:

- create/reorder tracks;
- multiple video tracks;
- multiple audio tracks;
- append;
- insert;
- overwrite;
- move between tracks;
- linked A/V;
- unlink;
- lock;
- mute;
- solo;
- sync lock;
- markers;
- selected ranges;
- snapping contracts.

Renderer must support overlapping video and mixed audio.

Exit:

Export a real multitrack project with camera footage, B-roll, captions, title, dialogue, and music.

---

## P2-B — Professional timeline tools

Build after P2-A:

- roll;
- slip;
- slide;
- lift;
- extract;
- source in/out;
- append;
- insert;
- overwrite;
- three-point editing;
- match frame;
- replace edit.

Every tool requires:

- typed operation;
- validation;
- gesture;
- keyboard path;
- preview;
- export;
- Undo;
- tests.

---

## P2-C — Multiple sequences

Later:

- stable sequence IDs;
- sequence browser;
- active sequence;
- duplicate;
- nested sequence contract;
- sequence export.

Do not build nested sequences before normal multitrack is stable.

---

## P3-A — Real transcription

Connect the transcription port.

Store:

- transcript;
- sentence/word timing;
- confidence;
- producer;
- producer version;
- asset hash;
- observation revision.

Machine transcript is an observation, not guaranteed truth.

Provide correction UI.

---

## P3-B — Searchable context

Start with:

- sentence index;
- word timing;
- full-text search;
- bounded context windows.

No vector database required initially.

---

## P3-C — Real AI providers

Use provider-independent adapters/LiteLLM.

Requirements:

- outbound allowlist;
- no raw filesystem paths;
- minimum required context;
- provider/model version;
- prompt version;
- input hash;
- registry version;
- raw response;
- parsed proposal;
- validation;
- correction;
- final decision;
- timeout;
- cancellation;
- quota errors;
- stable error mapping.

Run one fixed corpus through at least two providers.

Measure:

- valid plan rate;
- clarification rate;
- unsupported rate;
- latency;
- repair rate;
- disagreement;
- corruption rate: zero.

---

## P3-D — Compound AI editing

First representative request:

```text
“Remove the slow opening, add captions,
add a punch-in when I make the main point,
put my name up and lower the music.”
```

Requirements:

- atomic pending change set;
- ordered dependencies;
- operation-level visualization;
- whole-plan preview;
- direct correction;
- revision protection;
- one acceptance;
- one Undo.

---

## P4-A — Motion-graphics component platform

Each component:

- stable ID;
- semantic version;
- manifest;
- JSON Schema;
- defaults;
- renderer requirements;
- validators;
- preview fixture;
- migrations;
- AI skill;
- performance budget.

Batch 1:

- counter;
- lower third;
- title card;
- highlight box;
- arrow.

Batch 2:

- quote card;
- chapter card;
- feature card;
- comparison card;
- CTA/end card.

Batch 3:

- charts;
- diagrams;
- product-demo callouts;
- dynamic layouts.

---

## P4-B — Motion system

Support:

- keyframes;
- linear;
- ease-in;
- ease-out;
- ease-in-out;
- cubic Bézier;
- spring presets;
- bounce presets;
- entrance/exit.

Add browser/export motion parity fixtures.

---

## P4-C — Punch-in zoom

Punch-in consists of:

```text
scale + position + range + keyframes + easing + safe crop
```

Support:

- point target;
- selected region;
- direct repair;
- safe-framing validator.

Face/object targeting comes later.

---

## P5-A — Audio

Order:

1. waveform;
2. clip gain;
3. fades;
4. mute/solo;
5. track gain;
6. volume keyframes;
7. ducking;
8. loudness normalization;
9. limiter;
10. simple dialogue cleanup.

Later:

- EQ;
- compressor;
- voice isolation;
- advanced restoration;
- buses/mixer.

---

## P5-B — Color

Creator V1:

- exposure;
- contrast;
- saturation;
- temperature;
- tint;
- highlights;
- shadows;
- LUT.

Preserve source color metadata.

Later:

- OpenColorIO;
- ACES;
- HDR;
- log;
- scopes;
- curves;
- qualifiers.

Do not attempt full Resolve Color parity now.

---

## P5-C — Perspective

After standard transform/crop:

- corner pin;
- four-point perspective;
- perspective canvas handles;
- keyframes;
- exact preview/export parity.

Later:

- planar tracking;
- screen replacement.

---

## P6 — Compositing and effects

Start with a constrained effect/layer graph:

- ordered layers;
- ordered effects;
- masks;
- blend modes;
- bounded dependencies.

Later evaluate:

- OpenFX;
- MLT effects;
- Natron external process;
- WebGPU shaders.

Third-party effects require sandboxing and resource limits.

---

## P7 — Vision, tracking, masks

Observation layer:

- faces;
- objects;
- screen regions;
- OCR;
- shots;
- empty space;
- motion.

Store provenance and confidence.

Target flow:

```text
point/box
→ candidate targets
→ score
→ user confirmation if ambiguous
→ stable target ID
```

Tracking/segmentation:

- promptable mask;
- propagation;
- drift detection;
- occlusion;
- re-identification;
- correction frames;
- positive/negative correction clicks.

Advanced effects:

- text behind subject;
- object border;
- tracked callout;
- background blur;
- cutout;
- object-attached component.

Low-confidence tracking must not silently proceed.

---

## P8 — API, SDK, MCP

Only after services are stable.

Order:

1. internal application service API;
2. HTTP API;
3. TypeScript SDK;
4. Python SDK;
5. MCP adapter.

MCP tools:

- inspect_project;
- list_capabilities;
- create_annotation;
- plan_edit;
- preview_change_set;
- accept_change_set;
- reject_change_set;
- undo_change_set;
- get_job_status;
- export_project.

Do not expose one MCP tool per coordinate or keyframe by default.

---

## P9 — Production SaaS

Only after local product value is validated.

- authentication;
- authorization;
- tenant isolation;
- object storage;
- job queues;
- CPU/GPU workers;
- signed URLs;
- quotas;
- billing;
- monitoring;
- backups;
- retention;
- deletion;
- audit logs;
- incident recovery.

---

# 18. Testing strategy

## Unit

- time;
- geometry;
- snapping;
- operations;
- migrations;
- validators;
- capability schemas;
- render-plan compilation;
- view-model conversion;
- interaction math.

## Integration

- change-set API;
- stale revision;
- persistence;
- Undo/Redo;
- frozen export revision;
- provider validation;
- reopen;
- asset upload;
- archive round-trip.

## Browser E2E

```text
Home
→ open/upload
→ Assist default
→ Studio switch
→ preserve playhead
→ edit
→ proposal
→ accept
→ Undo/Redo
→ export
→ reopen
```

Later:

- timeline drag;
- trim;
- split;
- inspector;
- canvas handles;
- proposal ghosts;
- switch during proposal;
- refresh;
- cancel/retry export.

## Visual parity

```text
canonical input
→ browser screenshot
→ final-render frame
→ compare within tolerance
```

Cover:

- fonts;
- wrapping;
- emoji;
- portrait;
- landscape;
- edge placement;
- alpha;
- masks;
- motion frames.

## Performance

Scenarios:

- playback + annotation;
- playback + timeline scroll;
- AI pending + continued use;
- export + editing;
- 50 clips;
- long captions;
- repeated project open/close.

Measure:

- interaction latency;
- dropped frames;
- JS heap;
- DOM count;
- canvas memory;
- object URLs;
- listeners;
- workers;
- preview latency;
- export latency.

## Human evidence

Required for:

- premium feel;
- hierarchy;
- discoverability;
- non-editor understanding;
- motion taste;
- publishability.

---

# 19. Accessibility

Require:

- keyboard path;
- visible focus;
- semantic names;
- understandable errors;
- sufficient contrast;
- usable target sizes;
- reduced motion;
- no color-only status;
- keyboard-reachable timeline;
- Inspector numeric alternatives to canvas gestures.

Assist uses plain language.

Studio may use editor terminology with tooltips.

---

# 20. Security and privacy

AI context is allowlisted.

Never send by default:

- raw filesystem paths;
- unrelated project history;
- private metadata;
- whole media;
- complete transcript when only a window is needed.

Treat transcript/OCR/media text as untrusted data, not instructions.

Component/plugin execution requires:

- version pinning;
- declared permissions;
- timeout;
- memory limit;
- no direct project mutation;
- sandboxing where executable.

---

# 21. Failure protocol

Record nonblocking failures instead of drifting.

Every failure includes:

- What?
- Where?
- When?
- Who?
- Why?
- How reproduced?
- What tried?
- Evidence?
- Blocking?
- One-line solution?
- Status?

Fix immediately when risk includes:

- data loss;
- project corruption;
- source mutation;
- security/privacy;
- invalid export;
- broken core workflow;
- migration loss;
- stale overwrite;
- unrecoverable crash.

Do not use the registry to postpone failures that invalidate the active milestone.

---

# 22. Codex discipline

For every task:

1. verify branch and SHA;
2. read relevant contracts;
3. state scope;
4. state non-goals;
5. create/update focused tests;
6. implement one bounded slice;
7. run focused tests;
8. run required build;
9. inspect diff;
10. update task/failure records;
11. report exact evidence;
12. stop.

Do not combine:

- broad cleanup;
- architecture rewrite;
- new features;
- documentation reconciliation;

unless the active task requires them.

---

# 23. Codex report template

```text
Active branch:
Start commit:
End commit:

Objective:
Implemented:
Not implemented:

Files created:
Files modified:
Third-party files:
Licenses/notices:

Domain changes:
API changes:
UI changes:
Preview changes:
Export changes:
Migration changes:

Tests:
- command
- result

Build:
- command
- result

Browser walkthrough:
- steps
- result
- screenshots

Performance:
- scenario
- result

Known limitations:
Blocking failures:
Nonblocking failures:

Acceptance criteria:
Owner evidence open:

Exact next task:
Stop condition:
```

---

# 24. Exact next Codex command

```text
ACTIVE TASK: P0-R — OPEN-SOURCE TIMELINE REUSE AUDIT AND BOUNDED OPENCUT SPIKE

Do not begin production Timeline V1.

Verify:
- active branch;
- current SHA;
- clean tree;
- P0-B/P0-C state.

Goal:
Determine whether selected OpenCut timeline modules should be adopted,
vendored-and-adapted, or only studied while keeping Sanverse’s project,
operations, revisions, change sets, proposals, history, preview and export
authoritative.

Read:
- apps/web/src/editor/EditorShell.tsx
- apps/web/src/app/App.tsx
- apps/web/src/screens/studio/StudioScreen.tsx
- apps/web/src/features/timeline/
- packages/edit-domain/
- packages/render-contract/
- current OpenCut repository
- OpenCut classic
- OpenTimelineIO
- MLT
- Kdenlive/Natron only as references

Produce a matrix for:
1. license;
2. upstream commit;
3. exact files/modules;
4. framework;
5. state coupling;
6. project coupling;
7. renderer coupling;
8. export coupling;
9. history coupling;
10. selection;
11. playhead;
12. zoom;
13. scroll;
14. trim;
15. snapping;
16. waveforms;
17. virtualization;
18. accessibility;
19. bundle impact;
20. memory impact;
21. maintenance;
22. upstream stability.

Build one disposable sandbox:

Sanverse fixture
→ adapter
→ OpenCut-derived timeline presentation
→ playhead, selection, zoom and scroll
→ one trim or split gesture
→ Sanverse typed operation

Fixture:
- one video clip;
- one title;
- one caption range;
- one music item.

Hard constraints:
- no second project model;
- no OpenCut renderer;
- no OpenCut export;
- no OpenCut database/auth;
- no replacement Undo;
- no production route replacement;
- no real provider;
- no full multitrack implementation;
- preserve notices;
- record exact upstream commit and modifications.

Return one decision:
A. Adopt selected modules.
B. Vendor and substantially adapt selected modules.
C. Study the behavior and build a focused Sanverse timeline.
D. Reassess a larger OpenCut fork.

Report evidence, performance, licensing notes, maintenance estimate and exact next task.

Stop after the sandbox and decision report.
```

---

# 25. Final strategic rule

Do not choose between “build the editor” and “build AI.”

Use vertical capability slices:

```text
deterministic operation
→ manual UI
→ preview/export
→ repair
→ AI capability mapping
→ evaluation
```

Example:

```text
Punch-in zoom:
1. deterministic zoom operation;
2. Inspector control;
3. canvas/timeline visualization;
4. export verification;
5. AI mapping;
6. natural-language evaluation.
```

This avoids:

```text
a professional editor with weak AI
```

and:

```text
an impressive AI demo with no repairable editor underneath.
```

The Sanverse target is:

> Assist makes editing understandable. Studio makes editing precise. AI and humans use the same operations. The interface visibly proves what the AI changed.
