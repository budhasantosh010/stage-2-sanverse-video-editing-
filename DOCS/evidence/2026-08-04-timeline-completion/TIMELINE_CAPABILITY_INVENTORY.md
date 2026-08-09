# What the Timeline can already do, and what it cannot

2026-08-06 · Gate P0 · read at commit `ad11b07`

## Why this file exists

Before building eight gates of Timeline work, somebody has to say honestly what
is already there. Without that, the same thing gets built twice, or a gate is
declared done because nobody checked whether the export end of it existed.

Every row below was **read from the code**, not remembered. Where a row says
"absent", it means a search of the whole repository found nothing.

## How to read the table

Each feature is judged on seven separate questions, because a feature can exist
in one place and be missing in another — and that is the most dangerous state to
be in. "The user can do it on screen but the export ignores it" is worse than
"the user cannot do it", because the first one lies.

```
  BUILT?      is the idea in the code at all
  DOMAIN OP   is there an accepted, undoable, replayable operation for it
  PREVIEW     does the browser preview show it
  EXPORT      does the exported MP4 contain it
  UNDO        does one gesture make exactly one Undo entry
  UI          can a user reach it without typing code
  MIGRATION   would turning this on rewrite projects already saved
```

**Migration impact** is the column that costs money if it is wrong. "None" means
a project saved yesterday opens tomorrow unchanged.

---

## 1 — What is fully built today (T0 and earlier)

| feature | built | domain op | preview | export | undo | UI | migration | gate |
|---|---|---|---|---|---|---|---|---|
| Split a clip | yes | `split-clip` | yes | yes | yes | yes | none | done |
| Trim a clip | yes | `trim-clip` | yes | yes | yes | yes | none | done |
| Remove clip, leave gap | yes | `remove-clip` | yes | yes | yes | yes | none | done |
| Remove clip, close gap | yes | `remove-clip` ripple | yes | yes | yes | yes | none | done |
| Reorder clips | yes | `reorder-clip` | yes | yes | yes | yes | none | done |
| Place footage on V1 | yes | `place-primary-clip` | yes | yes | yes | yes | none | done |
| Move footage on V1 | yes | `move-primary-clip` | yes | yes | yes | yes | none | done |
| Switch one clip off | yes | `set-clip-enabled` | yes | yes | yes | yes | none | done |
| Clip audio level / fades | yes | `set-clip-audio` | yes | yes | yes | yes | none | done |
| Track output on/off (5 tracks) | yes | `set-track-output` | yes | yes | yes | yes | none | done |
| Track padlock | yes | none — sidecar | n/a | n/a | no, by design | yes | none | done |
| Captions (add/cue/style) | yes | 3 caption ops | yes | yes | yes | yes | none | done |
| Titles | yes | `add-title` | yes | yes | yes | yes | none | done |
| Callouts | yes | `add-callout` | yes | yes | yes | yes | none | done |
| Nameplates | yes | `add-nameplate` | yes | yes | yes | yes | none | done |
| B-roll / picture overlay | yes | `add-media-overlay` | yes | yes | yes | yes | none | done |
| Music | yes | `add-music` | yes | yes | yes | yes | none | done |
| Remove any overlay | yes | `remove-overlay` | yes | yes | yes | yes | none | done |
| Visual position/scale/rotation | yes | `set-visual-properties` | yes | yes | yes | yes | none | done |
| Footage motion (pan/zoom) | yes | `set-footage-motion` | yes | yes | yes | yes | none | done |
| Single selection | yes | none — presentation | n/a | n/a | no, by design | yes | none | done |
| Snapping | yes | none — presentation | n/a | n/a | no, by design | yes | none | done |
| Insert / Overwrite / Append | yes | via planner | yes | yes | yes | yes | none | done |
| Zoom / Fit / scroll | yes | none — presentation | n/a | n/a | no, by design | yes | none | done |
| Filmstrips + waveforms | yes | none — derived | yes | n/a | n/a | yes | none | done |
| One context menu | yes | routes to ops | yes | yes | yes | yes | none | done |
| Mixed-shape export (Fit/Fill) | yes | `sanverse.render/framing` | yes | yes | yes | not yet | none | T0 |

**One row above is a warning, not a boast:** *Mixed-shape export* has no control
on screen. The rule exists, the export obeys it, and the default (Fit) is right —
but a user cannot yet choose Fill. That is a **partial**, and it belongs to a
later gate rather than being quietly counted as done.

---

## 2 — Gate T1, feature by feature

| feature | built | domain op | preview | export | undo | UI | migration | gate |
|---|---|---|---|---|---|---|---|---|
| Icon toolbar (9 tools) | partial — 3 word buttons | n/a | n/a | n/a | n/a | partial | none | T1 |
| Multi-selection (Ctrl / Shift) | **absent** — one item only | n/a | n/a | n/a | n/a | no | none | T1 |
| Select All / track / before / after | **absent** | n/a | n/a | n/a | n/a | no | none | T1 |
| Linked V1+A1 selection | **absent** | n/a | n/a | n/a | n/a | no | none | T1 |
| Marquee (drag a box) | **absent** | none needed | n/a | n/a | none, by design | no | none | T1 |
| Move several items at once | **absent** — one at a time | reuses existing | yes | yes | must be ONE | no | none | T1 |
| Trim several items at once | **absent** | reuses existing | yes | yes | must be ONE | no | none | T1 |
| Groups | **absent** | NEW `set-timeline-groups` | not rendered | not rendered | yes | no | none | T1 |
| Copy / cut / paste / duplicate | **absent** | reuses existing | yes | yes | one per paste | no | none | T1 |
| Markers (point + range) | **absent** | NEW `set-timeline-markers` | not rendered | not rendered | yes | no | none | T1 |
| Track height / collapse | **absent** — fixed by screen width | none — sidecar | n/a | n/a | no, by design | no | none | T1 |
| Context menu, real actions only | partial | existing | yes | yes | yes | partial | none | T1 |
| Magnetic drag feedback | partial — snap guide only | none — preview | n/a | n/a | none, by design | partial | none | T1 |
| Gap objects | partial — drawn, not selectable | existing remove-gap | yes | yes | yes | partial | none | T1 |
| Keyboard presets | **absent** — one fixed set | none — sidecar | n/a | n/a | no, by design | no | none | T1 |

### The two new domain operations, and why they are safe

Groups and markers are the **user's own work** — a note somebody typed is
something they would be upset to lose. So they cannot be browser-only settings
like the padlocks; they have to travel with the project and be undoable.

But they change **nothing** about the finished video. So they must not force the
video to be built again.

Those two requirements look like they conflict. They only conflict because of how
the export key is currently made:

```
  BEFORE:  export key = projectId : revision : schemaVersion
                                    ^^^^^^^^
           any edit at all, even one that changes nothing you can see,
           makes a new key and throws away a finished export

  AFTER:   export key = projectId : schemaVersion : the render plan itself
           the key describes WHAT WILL BE PRODUCED, so two projects that
           will produce the same video share one export
```

Adding a marker therefore adds a revision and an Undo entry, and leaves the
export key untouched, because the render plan is byte-identical. **Migration
impact: none** — a project with no marker operations reads back with no markers,
exactly as it does today.

This also fixes something that was already wasteful: today, renaming, muting and
unmuting, or any no-op toggle discards a finished export and makes the user wait
for an identical file.

---

## 3 — Gates T2 to T7, so nothing is claimed twice

| feature | built | domain op | preview | export | undo | UI | migration | gate |
|---|---|---|---|---|---|---|---|---|
| Constant speed | **absent** | none | no | no | n/a | no | none | T2 |
| Rate stretch | **absent** | none | no | no | n/a | no | none | T2 |
| Reverse | **absent** | none | no | no | n/a | no | none | T2 |
| Freeze frame | **absent** | none | no | no | n/a | no | none | T2 |
| J and L cuts | **absent** | none | no | no | n/a | no | none | T2 |
| Transitions | **partial** | `set-clip-transition` exists | yes | yes | yes | **no UI** | none | T2 |
| Ripple / roll / slip / slide | **absent** | none | no | no | n/a | no | none | T3 |
| Trim to playhead | **absent** | reuses trim | yes | yes | yes | no | none | T3 |
| Dynamic trim (J/K/L) | **absent** | none | no | no | n/a | no | none | T3 |
| Numeric precision trim | **yes** — compact Timeline popover | reuses precision planners; integer ticks canonical | yes | yes | yes | yes | none | done |
| Keyframes on properties | **yes** — closed Editor target/property capability matrix, full-state planners, source/visual time projection | existing `set-visual-properties` + `set-footage-motion` | yes | yes | yes | yes | none | done T4 |
| Keyframe lanes on timeline | **yes** — expandable animated/all-property rows, shared selection, bounded visible diamonds, numeric/keyboard/marquee/clipboard editing | existing animation tracks | yes | yes | yes | yes | bounded to active target + visible range/overscan | done T4 |
| Graph (curve) editor | **yes** — Timeline-local single-property Graph, pan/zoom/Fit, point/marquee/Bezier/Spring/Bounce editing | shared `evaluateVisualProperties` | yes | yes | yes | yes | max 640 graph samples; one active target/property | done T4 |
| Add / delete / rename tracks | **absent** — five fixed | none | no | no | n/a | no | **large** | T5 |
| Sync lock, targeting | **absent** | none | n/a | n/a | n/a | no | none | T5 |
| Audio channel display | **absent** | none | no | no | n/a | no | none | T5 |
| Several sequences | **absent** — one only | none | no | no | n/a | no | **large** | T6 |
| Nested / compound clips | **absent** | none | no | no | n/a | no | **large** | T6 |
| Source monitor, 3-point | **absent** | none | no | no | n/a | no | none | T6 |
| Proxies | **absent** for editing | none | no | no | n/a | no | none | T6 |
| Preview render cache | **absent** | none | no | no | n/a | no | none | T6 |
| Multicam | **absent** | none | no | no | n/a | no | **large** | T6 |
| Transcript model | **partial** — `transcript.ts` | none | no | no | n/a | no | none | T7 |
| Word ↔ timeline mapping | **absent** | none | no | no | n/a | no | none | T7 |
| Edit by editing text | **absent** | none | no | no | n/a | no | none | T7 |

### The three rows marked "migration: large"

Adding tracks, several sequences, and nested clips all mean the same thing:
**the shape of a saved project changes.** Today a project has exactly one
composition with exactly five named tracks. Every project ever saved assumes it.

That is not a reason to avoid them. It is a reason they are in T5 and T6 and not
sooner, and a reason each one needs its own written upgrade path *before* any
code is written — one that can open a project saved today and produce the same
video, with a test that proves it.

### Two rows that are the most misleading in the whole document

**Transitions** and **keyframes** both say *partial*. In both cases the domain
operation exists, the preview honours it and the export honours it — and there is
**no way for a user to reach it.** From the user's chair those features do not
exist. From the code's point of view they are nearly done.

Recording that here is the point of the whole file: without it, a future session
reads "transitions: exists" and skips the only part that was missing.

---

## Totals

```
  fully built and reachable by a user . . . . . . . 27
  partial (exists somewhere, not everywhere) . . .  8
  absent . . . . . . . . . . . . . . . . . . . . . 31

  needing a new domain operation in T1 . . . . . . . 2   (markers, groups)
  needing a project-shape change (T5/T6) . . . . . . 4
  changing anything about projects saved today . . . 0
```

The last line is the one that matters for Gate T1: **nothing in T1 rewrites a
saved project.**
