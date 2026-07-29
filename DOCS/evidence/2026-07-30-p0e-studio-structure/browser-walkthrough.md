# P0-E browser walkthrough

Date: 2026-07-30
Project: disposable local `check .mp4` scratch project
URL: `http://localhost:2000`

## Authority and continuity

- Exactly one `<video>` existed throughout.
- The source URL and playback time survived every workspace switch.
- Unsent text `keep this P0-E draft` survived Assist → Studio, AI collapse,
  expansion, and Studio → Assist.
- Collapsing AI hid content without unmounting its textarea.

## Editing, proposal, and export

- `Cut here` changed one section into two; Undo restored one; Redo restored two.
- Export completed and exposed `Download MP4` after about 75 seconds.
- Point captured a center target at about 1.155 seconds; Inspector showed the
  same time and 50% / 50% coordinates.
- A pending `P0-E Review` proposal survived workspace and AI-panel switches.
- Collapsed AI showed `1 pending`.
- Repair to `P0-E Final` and acceptance completed successfully.

## Responsive evidence

| Viewport | Page width | Page height | Videos | Media | Inspector | Result |
|---|---:|---:|---:|---|---|---|
| 1440×900 | 1440 | 900 | 1 | visible | visible | no horizontal overflow |
| 1280×800 | 1280 | 800 | 1 | visible | visible | no horizontal overflow |
| 1024×768 | 1024 | 1932 | 1 | collapsed | collapsed | video-first vertical flow |

Screenshots: `studio-1440x900.png`, `studio-1280x800.png`,
`studio-1024x768.png`.

## Console, network, and accessibility

- Stable page: one video, zero broken images, no horizontal overflow.
- Console retained one old Vite HMR reload error timestamped before the stable
  reload. No later runtime error appeared during the completed workflow.
- The automation surface did not expose `performance`, so a resource count was
  unavailable. The local video played and export/download state completed.
- Workspace, AI collapse, Point, direct edits, Undo, Redo, and Export were
  reachable by semantic role/name. AI collapse exposed `aria-expanded`; the
  pending count used a named status. Reduced-motion behavior remained intact.
