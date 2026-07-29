SANVERSE DUAL-WORKSPACE PRODUCT AND UI IMPLEMENTATION CONTEXT

You are working inside the Sanverse Stage 2 repository.

Before doing any implementation, verify the actual checked-out branch and commit.
The GitHub pull request may still be open even if the owner believes the work was
merged locally. Do not assume that main contains the local-alpha branch.

Read these files first:

- START_HERE.md
- CLAUDE.md
- DOCS/CURRENT_STATE.md
- DOCS/HANDOFF.md
- DOCS/GOALS.md
- DOCS/DECISIONS.md
- DOCS/FAILURE_REGISTRY.md
- DOCS/plans/PLAN_CHECKLIST.md
- DOCS/plans/COMPLETE_MICRO_PLAN.md
- .hermes/plans/2026-07-29_141525-dual-workspace-full-editor-roadmap.md

Inspect these implementation areas:

- apps/web/src/app/App.tsx
- apps/web/src/app/app-state.ts
- apps/web/src/screens/home/HomeScreen.tsx
- apps/web/src/screens/studio/StudioScreen.tsx
- apps/web/src/screens/studio/StudioScreen.css
- apps/web/src/styles/global.css
- apps/web/src/features/timeline/
- apps/web/src/features/render-plan/
- apps/web/src/features/conversation/
- apps/web/src/features/annotation/
- apps/web/src/features/overlays/
- apps/web/src/features/captions/
- apps/web/src/features/proposal-repair/
- packages/edit-domain/
- packages/intent-domain/
- packages/render-contract/
- apps/api/src/intent/
- apps/api/src/render/
- apps/api/src/jobs/
- apps/api/src/projects/

Do not trust checklist labels without checking the actual code and UI reachability.

======================================================================
1. PRODUCT TRUTH
======================================================================

Sanverse currently has a substantial deterministic editing engine and a local
technical alpha.

It is not yet:

- a completed professional nonlinear editor;
- a finished consumer product;
- a DaVinci Resolve replacement;
- a Premiere Pro replacement;
- a CapCut replacement;
- a finished Apple-quality interface;
- a production SaaS;
- a validated external-user product.

The current interface is primarily an engineering/control interface that exposes
and proves some operations.

The next product bottleneck is not adding more hidden domain operations.

The next bottleneck is:

“Expose the existing engine through a coherent dual-workspace interface where
ordinary users and professional users can operate the same project, and where
AI actions are visibly represented on the canvas, timeline and inspector.”

======================================================================
2. NON-NEGOTIABLE PRODUCT ARCHITECTURE
======================================================================

Build:

One engine
One project schema
One capability registry
One typed-operation system
One render plan
One preview/export pipeline
One revision history
One undo/redo system

Two workspaces:

- Assist
- Studio

Architecture:

Assist workspace ─┐
                  ├──> typed operations
Studio workspace ─┘          │
                              ▼
                     deterministic editor engine
                              │
                    canonical project/render plan
                              │
                   browser preview + FFmpeg export

AI is not a second editor.

AI must not:

- click buttons through browser automation;
- simulate a mouse to edit;
- create a separate AI project format;
- write project files directly;
- invoke FFmpeg directly;
- bypass validation;
- accept its own proposal;
- use a separate undo system;
- use a separate renderer.

Manual actions and AI actions must produce the same typed operations.

Example:

Manual user drags a clip
→ move-clip operation
→ project revision
→ preview/export

AI says “move this part earlier”
→ proposed move-clip operation
→ detached preview
→ user approval
→ project revision
→ preview/export

======================================================================
3. CURRENTLY BUILT ENGINE CAPABILITIES
======================================================================

Confirm these in the actual branch before relying on them.

Project foundation:

- versioned project schemas;
- asset identity;
- composition and clip-instance concepts;
- rational/exact project timing;
- project revisions;
- v1-to-v2/vNext migrations;
- atomic change sets;
- server-authoritative project mutations;
- undo;
- redo;
- autosave;
- crash recovery;
- portable project archives;
- integrity hashes;
- protected original media;
- diagnostics and bounded failures.

Media and preview:

- video upload;
- local project storage;
- recent projects;
- video playback;
- browser preview;
- FFmpeg export;
- MP4 download;
- durable export jobs;
- progress states;
- cancellation/restart foundations;
- source media immutability.

Spatial intent:

- point capture;
- normalized coordinates;
- point/circle/box/arrow/freehand annotation contracts;
- annotation intent that does not automatically enter final export.

Written and media overlays:

- nameplates;
- titles;
- callouts;
- captions;
- image overlays;
- B-roll/media overlays;
- music beds;
- direct repair for several overlay families;
- browser preview layers;
- FFmpeg output paths.

Editorial operations:

- split;
- trim start/end;
- remove and close gap;
- remove while preserving gap;
- reorder earlier/later;
- clip enable/disable;
- gain;
- fade in;
- fade out;
- some transition support.

Visual properties:

- position;
- scale;
- rotation;
- opacity;
- crop;
- layer order;
- rectangle/ellipse masks;
- feathering contract;
- keyframes;
- linear easing;
- cubic-Bezier easing;
- spring;
- bounce;
- blur;
- brightness;
- contrast;
- saturation;
- grayscale;
- bounded transitions.

AI architecture:

- provider-independent interface;
- fake provider;
- OpenAI-compatible adapter;
- outbound-data allowlist;
- structured candidates;
- clarification;
- unsupported-intent handling;
- stale-revision rejection;
- preview-only proposals;
- manual proposal repair;
- atomic approval;
- evaluation fixtures;
- multi-action change-set foundations;
- capability/component recipe versions.

======================================================================
4. CURRENTLY VISIBLE USER CONTROLS
======================================================================

The current Studio screen visibly exposes approximately:

- video playback;
- point mode;
- nameplate creation;
- nameplate proposal preview;
- proposal repair;
- accept proposal;
- discard proposal;
- history;
- undo;
- redo;
- AI/chat composer;
- export;
- export status;
- simple time strip;
- split/cut at playhead;
- remove section;
- hide/show section;
- shorten start;
- shorten end;
- remove while preserving gap;
- move earlier/later;
- clip gain;
- fade in/out;
- add title;
- add callout;
- add image/B-roll;
- add music;
- repair added overlays;
- import captions from a transcript JSON file.

These controls are not currently organized into a professional editor layout.

======================================================================
5. BUILT INTERNALLY BUT NOT PROPERLY EXPOSED
======================================================================

Several capabilities appear to exist in domain/render code but lack complete
manual controls.

Likely examples:

- position inspector;
- direct canvas translation;
- resize handles;
- rotation control;
- crop UI;
- mask editing UI;
- layer panel;
- opacity control;
- ordered effect stack;
- keyframe controls;
- keyframe lanes;
- curve graph;
- spring/bounce preset selection;
- transition handles;
- proper caption cue editing;
- typography controls;
- visual style controls;
- clip-level detailed property editing.

Do not mark a feature “user-ready” merely because:

- a TypeScript type exists;
- a validator exists;
- a render node exists;
- an API accepts it;
- a fixture renders it.

A capability is user-ready only when:

domain
+ UI
+ preview
+ export
+ correction
+ undo
+ persistence
+ user evidence

all work.

======================================================================
6. NOT CURRENTLY BUILT AS A PROFESSIONAL EDITOR
======================================================================

Do not claim these exist unless repository inspection proves otherwise.

Professional timeline:

- general multitrack video/audio timeline;
- draggable clip blocks;
- timeline zoom;
- horizontal timeline scroll;
- waveform visualization;
- clip thumbnails;
- track headers;
- video/audio track types;
- lock;
- mute;
- solo;
- sync lock;
- track targeting;
- linked/unlinked audio and video;
- snapping;
- markers;
- ranges;
- transition handles;
- ripple trim handles;
- roll edits;
- slip edits;
- slide edits;
- lift;
- extract;
- append;
- insert;
- overwrite;
- source in/out;
- three-point editing;
- match frame;
- replace edit;
- compound clips;
- nested sequences;
- multiple sequences;
- adjustment layers;
- multicam;
- J/K/L playback controls;
- shortcut customization.

Professional panels:

- media bin;
- source monitor;
- program monitor distinction;
- inspector;
- effects browser;
- effect stack;
- audio meters;
- audio mixer;
- color scopes;
- color grading panel;
- keyframe timeline;
- curve editor;
- project metadata browser;
- relink UI;
- proxy controls.

Professional finishing:

- managed color pipeline;
- HDR;
- log/RAW;
- lift/gamma/gain;
- curves;
- qualifiers;
- vectorscope;
- waveform scope;
- RGB parade;
- advanced audio restoration;
- mixer buses;
- plugin ecosystem;
- advanced tracking;
- rotoscoping;
- advanced keying;
- node compositing;
- spatial audio;
- professional format breadth.

======================================================================
7. APPLE-LIKE UI STATUS
======================================================================

The product currently has a beginning foundation:

- design variables;
- black/white/neutral direction;
- screen transitions;
- button press feedback;
- focus-visible styles;
- keyboard labels;
- reduced-motion support;
- some accessibility semantics.

It does not yet have a mature Sanverse UI component system.

The goal is not to copy iOS visuals.

The goal is:

- immediate response;
- precise alignment;
- strong hierarchy;
- restrained motion;
- predictable interaction;
- excellent typography;
- uncluttered surfaces;
- direct manipulation;
- low perceived latency;
- clean error recovery;
- no unnecessary complexity.

Do not use:

- glass everywhere;
- huge blur layers;
- bouncing on every control;
- decorative fake progress;
- long animations;
- large animation dependencies without evidence;
- many unrelated visual styles;
- custom controls where native semantics are better.

======================================================================
8. SANVERSE UI KERNEL TO BUILD
======================================================================

Create a small reusable UI system before building more screen-specific controls.

Foundation tokens:

- canvas background;
- surface background;
- raised surface;
- selected surface;
- text primary;
- text secondary;
- text muted;
- border subtle;
- border strong;
- focus ring;
- semantic success;
- semantic warning;
- semantic error;
- semantic selection;
- track identity colors;
- spacing scale;
- radius scale;
- shadow/elevation scale;
- typography scale;
- motion durations;
- motion easing;
- spring presets;
- reduced-motion variants;
- control heights;
- icon sizes.

Core primitives:

- Button
- IconButton
- SegmentedControl
- Tabs
- Panel
- Toolbar
- Divider
- Tooltip
- Popover
- ContextMenu
- Dropdown/Menu
- TextField
- TextArea
- SearchField
- NumberField
- Slider
- Toggle
- Checkbox
- Select
- Progress
- Spinner
- Toast
- InlineNotice
- EmptyState
- Dialog
- Sheet
- ScrollArea
- ResizablePanel
- SplitPane

Editor primitives:

- InspectorSection
- InspectorRow
- PropertyLabel
- PropertyValue
- KeyframeToggle
- TimelineToolbar
- TimelineRuler
- TrackHeader
- TrackRow
- ClipBlock
- TransitionBlock
- CaptionBlock
- AudioWaveform
- Playhead
- RangeSelection
- Marker
- SelectionOutline
- CanvasHandles
- BoundingBox
- CropOverlay
- MaskOverlay
- ProposalGhost
- ChangeBadge
- JobProgress

Every primitive must support:

- disabled;
- hover;
- pressed;
- selected;
- focus-visible;
- loading when relevant;
- error when relevant;
- keyboard behavior;
- reduced motion;
- cleanup of listeners/animations;
- compact and regular density when relevant.

Do not create dozens of decorative variants.

======================================================================
9. SHARED EDITOR SHELL
======================================================================

Build one persistent EditorShell.

Top bar:

- Sanverse mark;
- editable project name;
- save status;
- Assist/Studio segmented switch;
- Undo;
- Redo;
- export status;
- Export button;
- optional overflow menu.

State that must survive workspace switching:

- project;
- project revision;
- playhead;
- playing/paused state;
- selected clip/item;
- selected range;
- selected point/annotation;
- canvas zoom;
- timeline zoom;
- scroll position where practical;
- pending AI proposal;
- proposal corrections;
- accepted history;
- undo stack;
- redo stack;
- export job;
- current media;
- panel state where appropriate.

Do not reload or convert the project when switching.

Do not create separate Assist and Studio state stores.

Recommended logical structure:

App
└── EditorSessionProvider / shared editor state
    └── EditorShell
        ├── EditorTopBar
        ├── AssistWorkspace
        └── StudioWorkspace

The server remains authoritative for accepted project mutations.

======================================================================
10. ASSIST WORKSPACE
======================================================================

Assist is the default workspace for normal users.

Primary goal:

A person can describe the result, point or draw when needed, preview the exact
change, correct it and approve it without learning professional terminology.

Assist must not look like a stripped-down Premiere interface.

Recommended desktop layout:

┌────────────────────────────────────────────────────────────────────┐
│ Sanverse   Project name      [Assist | Studio]   Undo   Export     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│                       LARGE VIDEO CANVAS                           │
│                                                                    │
│       contextual point / circle / box / freehand controls          │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ COMPACT CHANGE STRIP                                               │
│ cut · captions · title · zoom · B-roll · audio                     │
├──────────────────────────────────────────────┬─────────────────────┤
│ Ask Sanverse…                                │ Proposal review     │
│ natural-language input                       │ affected moments    │
│                                              │ Preview             │
│                                              │ Refine / Accept     │
└──────────────────────────────────────────────┴─────────────────────┘

Assist always-visible controls:

- video;
- play/pause;
- scrub/playhead;
- instruction input;
- Send;
- Undo;
- Export;
- workspace switch.

Contextual controls only:

- Point;
- Circle;
- Box;
- Arrow;
- Freehand;
- select affected range;
- move proposal;
- resize proposal;
- retime proposal;
- change text;
- adjust one or two important parameters;
- Open in Studio.

Do not always show:

- all timeline tools;
- transform values;
- effect stack;
- layers;
- keyframe graphs;
- color wheels;
- mixer;
- track routing.

Assist proposal card should show:

- plain-language summary;
- number of proposed changes;
- affected time ranges;
- affected objects;
- warnings;
- whether anything needs clarification;
- estimated preview status;
- Preview;
- Accept all;
- Refine;
- Reject;
- Open in Studio.

Repair model:

AI proposal
→ direct manipulation or short contextual controls
→ updated detached preview
→ accept

Rejecting and rewriting the entire prompt must not be the main correction flow.

Assist change strip:

This is not a professional timeline.

It should show:

- scenes/sections;
- accepted edits;
- proposed edits;
- captions;
- important markers;
- selected range;
- playhead.

It should use understandable labels:

- Removed pause
- Added captions
- Added title
- Added zoom
- Added B-roll
- Lowered music

Not:

- ripple delete operation;
- transform matrix;
- track patch;
- effect node.

======================================================================
11. STUDIO WORKSPACE
======================================================================

Studio provides direct precision.

Recommended desktop layout:

┌────────────────────────────────────────────────────────────────────────┐
│ Sanverse   Project   [Assist | Studio]   Undo Redo   Save   Export    │
├───────────────┬────────────────────────────────────┬───────────────────┤
│ MEDIA / BIN   │ PROGRAM CANVAS                     │ INSPECTOR         │
│               │                                    │                   │
│ Video         │                                    │ Transform         │
│ Audio         │             VIDEO                  │ Crop              │
│ Images        │                                    │ Opacity           │
│ Titles        │                                    │ Mask              │
│ Components    │                                    │ Effects           │
│               │                                    │ Audio             │
├───────────────┴────────────────────────────────────┴───────────────────┤
│ TOOLBAR: Select | Blade | Trim | Hand | Text | Draw                  │
├────────────────────────────────────────────────────────────────────────┤
│ V2  [title]              [image/B-roll]                               │
│ V1  [camera clip 1][camera clip 2]       [camera clip 3]              │
│ C1  [captions.........................]                               │
│ A1  [dialogue...................................................]     │
│ A2             [music............................................]    │
│                         ▲ playhead                                    │
└────────────────────────────────────────────────────────────────────────┘

Optional AI activity panel:

- collapsible;
- does not replace Inspector permanently;
- shows proposal status;
- operation list;
- affected clips/tracks;
- warnings;
- Preview;
- Accept;
- Reject;
- Modify;
- Cancel.

Studio is still progressively disclosed.

A normal user opening Studio should first see:

- media;
- canvas;
- timeline;
- inspector for selected item.

Advanced sections remain collapsed until relevant.

======================================================================
12. STUDIO TIMELINE V1
======================================================================

Build a real timeline UI over existing operations before adding every advanced
NLE operation.

Initial visible tracks:

- V2 — titles, callouts, B-roll, images and visual overlays;
- V1 — primary talking-head footage;
- C1 — captions;
- A1 — dialogue/original audio;
- A2 — music.

Timeline V1 requirements:

- timeline ruler;
- composition time;
- playhead;
- seek by clicking ruler;
- horizontal scrolling;
- timeline zoom;
- selected item;
- selected range;
- multiple track rows;
- stable track headers;
- clip blocks proportional to duration;
- captions on a caption row;
- overlays on an overlay row;
- music on an audio row;
- visible disabled clips;
- gaps;
- simple transitions;
- clip dragging where engine supports it;
- trim handles;
- snapping;
- keyboard delete;
- split at playhead;
- ripple delete;
- remove while keeping gap;
- move/reorder;
- enable/disable;
- Undo;
- Redo;
- contextual menu;
- clear pending/proposed state.

Timeline V1 should consume existing typed operations.

Do not build yet unless required:

- full three-point editing;
- roll;
- slip;
- slide;
- multicam;
- nested sequences;
- adjustment layers;
- professional track patching;
- advanced routing;
- full shortcut editor.

AI proposal visualization:

Pending AI changes must appear as ghost/noncommitted items.

Examples:

- proposed cut = shaded removal range;
- proposed title = translucent title block;
- proposed B-roll = translucent overlay clip;
- proposed captions = dotted caption range;
- proposed zoom = highlighted transform range;
- proposed audio change = visible gain badge/automation preview.

Pending operations must not mutate accepted state.

On Accept:

- ghost items settle into normal accepted styling;
- one project revision is created;
- one Undo reverses the change set.

On Reject:

- ghost items disappear;
- accepted project state is unchanged.

======================================================================
13. STUDIO INSPECTOR V1
======================================================================

Inspector is contextual.

Nothing selected:

- short help;
- project information;
- selected range summary.

Video clip selected:

- source information;
- start/end;
- enabled;
- linked audio;
- position;
- scale;
- rotation;
- crop;
- opacity;
- mask;
- visual effects;
- gain;
- fade in/out;
- transition summary.

Title/nameplate/callout selected:

- text;
- subtitle where supported;
- font/style preset;
- size;
- alignment;
- position;
- scale;
- rotation;
- opacity;
- duration;
- entrance/exit;
- layer;
- mask;
- effects.

Caption selected:

- text;
- start/end;
- caption style;
- position;
- max line width;
- safe margins;
- grouping controls.

Media overlay selected:

- asset;
- position;
- size;
- crop;
- opacity;
- layer;
- mask;
- entrance/exit;
- audio if video B-roll contains audio.

Music selected:

- gain;
- fade;
- start/end;
- mute;
- future ducking placeholder only when implemented.

Keyframe controls:

- property-level keyframe toggle;
- previous keyframe;
- next keyframe;
- easing preset;
- simple mini-lane initially.

Do not build a full graph editor in the first Inspector slice.

======================================================================
14. MEDIA BIN V1
======================================================================

Media bin should expose existing project assets:

- primary footage;
- imported video/B-roll;
- images;
- audio/music;
- transcript sidecars;
- titles/components as separate browser section.

Minimum behavior:

- thumbnail/icon;
- name;
- type;
- duration where relevant;
- search;
- drag or explicit Add to timeline;
- reveal usage;
- remove only when safe;
- clear offline/missing state;
- no filesystem paths exposed.

Do not build advanced smart bins initially.

======================================================================
15. CANVAS DIRECT MANIPULATION
======================================================================

The canvas must expose existing visual properties.

When a visual item is selected:

- bounding box;
- move handle;
- corner resize;
- edge resize when applicable;
- rotation handle;
- safe-margin guides;
- center guides;
- snapping;
- crop mode;
- mask overlay when relevant.

Direct manipulation emits the same typed operations as the Inspector.

During dragging:

- update a local/pending visual preview;
- avoid committing every pointer event as project history;
- commit one operation/change set at gesture end;
- Escape cancels;
- keyboard nudge works;
- Shift/Alt modifiers only if documented;
- pointer remains visually attached;
- no spring lag during precision dragging.

======================================================================
16. AI “MAGIC” EXPERIENCE
======================================================================

The magic must be honest and inspectable.

Example request:

“Remove the slow opening, add captions, zoom in when I make the main point,
put my name up and add relevant B-roll.”

Expected visible flow:

1. User submits the message.
2. The message appears immediately.
3. UI shows truthful status:
   - Understanding request…
   - Finding the relevant moments…
   - Preparing proposed changes…
   - Rendering preview…
4. Relevant ranges softly highlight.
5. Proposed timeline items appear as ghosts.
6. Proposed overlays appear on the canvas.
7. Inspector shows parameters for selected proposed operations.
8. Proposal summary lists each operation in plain language.
9. User can click any operation and jump to its time.
10. User can modify any operation directly.
11. Detached preview updates.
12. User accepts the entire change set or rejects it.
13. Accepted items become normal timeline items.
14. One Undo reverses the accepted request.

Do not expose chain-of-thought or pretend to stream internal reasoning.

Show observable actions and statuses only.

======================================================================
17. SHARED OPERATION VISUALIZATION
======================================================================

Every operation should have:

- plain-language label;
- icon;
- affected timeline range;
- affected item IDs;
- affected track;
- inspector representation;
- canvas representation if spatial;
- proposed state style;
- accepted state style;
- blocked/error state;
- history description;
- undo behavior.

Examples:

split-clip
- timeline: split line/new boundary;
- canvas: no spatial indicator;
- history: “Split section at 00:14.2”.

remove-range
- timeline: shaded removed range;
- proposal: “Remove 2.8 seconds”;
- preview: detached shortened result.

add-title
- timeline: overlay block;
- canvas: title ghost;
- inspector: title properties.

set-visual-properties
- timeline: property/keyframe marker;
- canvas: live transform;
- inspector: values.

set-clip-audio
- timeline: gain/fade badges or curve;
- inspector: gain and fades.

======================================================================
18. PERFORMANCE REQUIREMENTS
======================================================================

Premium means responsive.

Main thread priorities:

- pointer input;
- canvas manipulation;
- playback controls;
- timeline scrolling;
- inspector input;
- workspace switching.

Heavy work belongs in backend/workers:

- FFmpeg;
- export;
- thumbnails at scale;
- waveform generation;
- transcription;
- AI analysis;
- segmentation;
- tracking.

UI requirements:

- press feedback starts on next paint;
- canvas manipulation remains attached to pointer;
- timeline scrolling does not freeze playback;
- long render jobs do not freeze editing UI;
- animations use transform/opacity by default;
- large blur animations are avoided;
- no DOM node per frame;
- render only visible timeline range plus buffer;
- canvas may render dense waveforms/thumbnails;
- DOM/SVG should hold interactive items;
- object URLs/listeners/workers are cleaned up;
- reduced motion works;
- animation is interruptible;
- no fake progress.

Do not add large animation libraries without a measured requirement.

======================================================================
19. ACCESSIBILITY REQUIREMENTS
======================================================================

All important actions require:

- keyboard path;
- visible focus;
- semantic names;
- status announcements where needed;
- errors connected to controls;
- sufficient contrast;
- usable pointer targets;
- reduced motion;
- no information communicated only by color;
- timeline items reachable by keyboard;
- canvas transformations editable numerically in Inspector.

Assist must use plain language.

Studio may use established editor terms, but tooltips should explain them.

======================================================================
20. RESPONSIVE BEHAVIOR
======================================================================

Primary target:

- laptop and desktop browser.

Large desktop:

- media bin;
- canvas;
- inspector;
- full timeline.

Smaller laptop:

- collapsible media bin;
- collapsible inspector;
- canvas retains priority;
- timeline remains usable;
- AI panel becomes a drawer.

Do not compress every panel until text becomes unreadable.

Assist on small screens:

- canvas;
- compact change strip;
- chat/proposal bottom sheet.

Professional editing on phones is not the immediate target.

======================================================================
21. REFACTORING CONSTRAINTS
======================================================================

The current StudioScreen owns too many concerns.

Extract incrementally.

Possible structure:

apps/web/src/editor/
├── EditorShell.tsx
├── EditorTopBar.tsx
├── editor-session.ts
├── editor-selection.ts
├── workspaces/
│   ├── AssistWorkspace.tsx
│   └── StudioWorkspace.tsx
├── canvas/
│   ├── ProgramCanvas.tsx
│   ├── CanvasSelection.tsx
│   └── CanvasHandles.tsx
├── timeline/
│   ├── Timeline.tsx
│   ├── TimelineRuler.tsx
│   ├── TrackRow.tsx
│   ├── TrackHeader.tsx
│   ├── ClipBlock.tsx
│   ├── Playhead.tsx
│   └── ProposalGhost.tsx
├── inspector/
│   ├── Inspector.tsx
│   ├── TransformInspector.tsx
│   ├── TextInspector.tsx
│   ├── AudioInspector.tsx
│   └── EffectInspector.tsx
├── media-bin/
│   └── MediaBin.tsx
├── ai/
│   ├── AIActivityPanel.tsx
│   ├── ProposalSummary.tsx
│   └── ProposalOperationItem.tsx
└── ui/
    ├── Button.tsx
    ├── IconButton.tsx
    ├── SegmentedControl.tsx
    ├── Panel.tsx
    ├── Tabs.tsx
    └── ...

Adapt names to repository conventions.

Do not rewrite the domain or renderer merely to reorganize the UI.

Preserve:

- existing operations;
- project migrations;
- server-authoritative edits;
- accepted history;
- preview/export compiler;
- current tests;
- failure codes.

======================================================================
22. BUILD ORDER
======================================================================

Do not implement everything in one task.

PHASE P0-A — Repository and branch truth

- verify current branch/commit;
- confirm whether feature branch reached main;
- inspect current runtime;
- identify exact UI-reachable features;
- produce capability parity matrix:
  domain | API | UI | preview | export | repair | evidence.

Exit:
The team knows exactly what is built and what is merely internal.

PHASE P0-B — Shared UI kernel

Build only:

- tokens cleanup;
- Button;
- IconButton;
- SegmentedControl;
- Panel;
- Tabs;
- Tooltip;
- basic layout primitives.

Replace only the controls touched by the new shell.

Exit:
Shared primitives work in light Assist and dark/neutral Studio contexts.

PHASE P0-C — Shared EditorShell

- top bar;
- workspace selector;
- shared editor session;
- state continuity;
- no project reload;
- no duplicate store.

Exit:
Switch Assist ↔ Studio while preserving project, playhead, selection, proposal,
revision, history and Undo.

PHASE P0-D — Assist workspace

- large canvas;
- existing chat;
- point/draw tools;
- proposal review;
- compact change strip;
- contextual repair;
- Open in Studio.

Exit:
A non-editor can complete the current talking-head workflow without seeing
professional controls.

PHASE P0-E — Studio workspace skeleton

- media-bin region;
- canvas region;
- inspector region;
- timeline region;
- collapsible AI panel;
- reuse current simple controls temporarily.

Exit:
Layout and panel hierarchy are approved before deep timeline work.

PHASE P1-A — Timeline UI V1 over existing operations

- real tracks;
- clip blocks;
- playhead;
- zoom/scroll;
- selection;
- trim handles;
- split;
- delete/ripple;
- reorder;
- captions/overlays/audio rows;
- proposed ghost items.

Exit:
A user can manually perform and visually understand all currently supported
timeline operations.

PHASE P1-B — Inspector V1

Expose existing:

- transform;
- crop;
- opacity;
- layer;
- masks;
- basic effects;
- audio gain/fades;
- text properties;
- timing;
- easing presets.

Exit:
Capabilities already implemented internally become directly usable.

PHASE P1-C — Canvas manipulation

- move;
- resize;
- rotate;
- crop;
- snapping;
- keyboard nudge;
- gesture commit;
- proposal correction.

Exit:
Normal visual editing no longer requires typing coordinates.

PHASE P1-D — Media bin

- existing assets;
- thumbnails/icons;
- search;
- add to timeline;
- usage indication.

Exit:
Users can manage existing video/image/audio assets visibly.

PHASE P1-E — AI proposal visualization

- timeline ghosts;
- canvas ghosts;
- inspector parameters;
- affected ranges;
- operation summary;
- accept/reject/repair.

Exit:
AI and manual editing visibly use the same system.

PHASE P2 — General multitrack expansion

Only after P1 works:

- multiple general video/audio tracks;
- append;
- insert;
- overwrite;
- linked A/V;
- track lock/mute/solo;
- track routing;
- snapping contracts;
- markers;
- real multi-clip workflow;
- preview/export parity.

Do not implement every professional operation in one batch.

PHASE P3 — Real intelligence

- connect transcription;
- connect real provider;
- transcript-aware editing;
- silence/filler suggestions;
- captions;
- rough-cut requests;
- real evaluations.

Do not block P0/P1 UI development on API keys.

======================================================================
23. ACCEPTANCE CRITERIA
======================================================================

Shared shell:

- workspace switch exists;
- no project conversion;
- no history reset;
- no playhead reset;
- no proposal loss;
- no reload;
- undo works across workspace switch.

Assist:

- user starts with video + instruction;
- no professional terminology required;
- point/draw is understandable;
- AI proposal is visible;
- direct correction works;
- one acceptance creates one revision;
- one Undo reverses it.

Studio:

- timeline has recognizable tracks;
- selected clip is obvious;
- Inspector reflects selection;
- existing operations are reachable;
- accepted AI work appears exactly like manual work;
- pending AI work is clearly not yet accepted.

Timeline:

- playhead and canvas agree;
- clip lengths are proportional;
- gaps are visible;
- proposed edits are distinct;
- dragging/trim does not corrupt project;
- keyboard operations work;
- preview/export use the same project state.

UI quality:

- one clear primary action per state;
- no permanent glass over precision areas;
- no excessive bouncing;
- input feedback is immediate;
- no layout jump on panel changes;
- motion is interruptible;
- reduced motion works;
- controls have consistent sizing and spacing.

Reliability:

- accepted changes survive reload;
- source media is immutable;
- stale proposals fail;
- export uses frozen revision;
- cancel/retry works;
- failures are understandable;
- existing migrations remain valid.

======================================================================
24. EXPLICIT NON-GOALS FOR THE NEXT TASKS
======================================================================

Do not build now:

- complete Resolve/Premiere parity;
- full color page;
- node compositor;
- multicam;
- advanced roto;
- object tracking;
- SAM segmentation;
- spatial audio;
- plugin marketplace;
- full shortcut editor;
- collaboration;
- cloud SaaS;
- MCP;
- billing;
- advanced export matrix;
- third-party plugin compatibility.

Do not add new hidden operations before exposing the valuable existing ones.

======================================================================
25. FIRST CODEX TASK
======================================================================

The first implementation task is P0-B + P0-C only:

“Build the minimal shared UI kernel and shared EditorShell with an Assist/Studio
workspace selector and state continuity.”

Detailed requirements:

1. Verify the actual active branch and repository status.
2. Read the current application and state model.
3. Do not modify domain schemas or render behavior.
4. Create reusable:
   - Button
   - IconButton
   - SegmentedControl
   - Panel
   - Tabs
5. Add the shared EditorShell.
6. Add Assist/Studio workspace state.
7. Keep current Studio content functional inside the Studio workspace.
8. Add a minimal Assist layout using existing:
   - video preview
   - conversation
   - point tool
   - proposal
   - compact history/change strip
9. Preserve:
   - project
   - revision
   - playhead
   - point selection
   - pending proposal
   - Undo/Redo
   - export state
10. Do not implement the professional timeline yet.
11. Do not add new effects.
12. Do not connect a real AI provider.
13. Add focused state-continuity tests.
14. Run only tests relevant to changed boundaries, then the required web build.
15. Record nonblocking problems in FAILURE_REGISTRY.md.
16. Stop and produce an owner walkthrough before beginning Timeline V1.

Finish with:

- files changed;
- screenshots/state descriptions;
- tests run;
- known limitations;
- exact next task after owner approval.
