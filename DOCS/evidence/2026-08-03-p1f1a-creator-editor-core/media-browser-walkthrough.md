# Gate B real-browser walkthrough — 2026-08-03

Real local server (`npm run dev`, web :2000, API :2001), real media, real files
on disk. Every line below is an observation, not an expectation.

**Project:** `project_a5c6b54b60f236e1b6e789e1cc773826`
**Media used:**

| file | what it really is | size |
|---|---|---|
| `interview.mp4` | the 30-second 1080p test video | 8,981,037 B |
| `logo.png` | a real PNG screenshot | 173,207 B |
| `music.mp3` | a real MP3, encoded here with ffmpeg (440 Hz, 6 s) | 24,772 B |
| `broll.mp4` | the 60-second app-test video | 17,104,000 B |
| `budget.pdf` | not media — deliberately | 17 B |

---

## What was done, and what happened

| # | Step | Observed |
|---|---|---|
| 1 | Open Studio → Media | panel renders: header, search/filter, results, all present |
| 2–5 | Resize the Media pane through four widths | see `media-responsive-matrix.md` — 418 / 352 / 285 / 255 px |
| 6 | Look for clipped controls | **none** at any width; no horizontal scrolling |
| 7 | Import menu → **Image** | file dialog filter became `image/png,image/jpeg,image/webp,image/bmp,image/gif,image/tiff,…` — **image types only** |
| 8 | Import the real PNG | `1 file imported.` · row `logo.png, Image, Unused` · count 1 → 2 |
| 9 | Import the real MP3 **and** the 60-second MP4 together | `2 files imported.` · counts `Video 2 · Image 1 · Audio 1` |
| 10 | Check the four import choices | Video / Image / Audio / All supported media, each with a truthful filter; **one** hidden file input serves all four |
| 11 | **Drop from the operating system**: `budget.pdf` + a PNG | PNG imported; PDF refused **by name**; drop highlight cleared |
| 12 | Read the refusal | `budget.pdf is not a video, a picture, or a piece of music (application/pdf).` |
| 13 | Search `logo` | `All media · 1 result`, only `logo.png` shown |
| 14 | Filter Audio, then Video, then All | `1 result · Audio only` → `2 results · Video only` → all 5. The compact control read `Filter media, Audio selected` at the same moment — one filter, two shapes |
| 15 | Sort by each field | see the table below |
| 16 | Reverse the sort | `Longest first` and `Newest first` both genuinely reversed |
| 17 | Create folder `B-roll` | 200 · written to disk as `folder_b93629d667b977e6` |
| 18 | Create ` b-roll ` again | **400 `FOLDER_NAME_DUPLICATE`** — "A folder with that name already exists." Form stayed open with the text still in it |
| 19 | Rename to `Cutaways` | 200 · file on disk updated |
| 20 | Move `logo.png` in, from the row's own menu | 200 · `assetFolderAssignments` written |
| 21 | Switch to All media | `All media · 4 results` (the filed one is no longer at the top level) |
| 22 | Move it back to the root | 200 |
| 23 | Delete the folder | 200 · folders `[]` · **all 5 assets still present** |
| 24 | **Reload the whole page**, reopen the project | folder `Cutaways` still there, still holding 1 asset — see below |
| 25 | Compare the project before/after all folder work | **byte-identical** |
| 26–28 | Timeline, Preview, export key | unchanged — revision never moved |
| 29 | One video still in the project | yes, `interview.mp4` still the primary footage |
| 30 | Console errors | **0** |
| 31 | Failed HTTP requests | **0** |
| 32 | Server log | no errors |
| 33 | Object URLs in the Media panel | **0** — every source is a server URL, so there is nothing to leak |
| 34–37 | 1440×900, 1280×800, 1024×768, 390×844 | all four checked — see `media-responsive-matrix.md` |

---

## Step 15 — the sort, in full

Five assets, added in this order: `interview.mp4`, `logo.png`, `music.mp3`,
`broll.mp4`, `second.png`.

| sort | result |
|---|---|
| Date added (oldest first) | interview · logo · music · broll · second |
| **Date added (newest first)** | second · broll · music · logo · interview |
| Name A→Z | broll · interview · logo · music · second |
| Type | interview · broll *(video)* · logo · second *(image)* · music *(audio)* |
| Duration (shortest) | logo · second *(no duration)* · music · interview · broll |
| **Duration (longest)** | broll · interview · music · logo · second |

Look at `logo.png` and `second.png`. They tie on type **and** on duration, and in
every single row above they stay in the order the project holds them. That is
the stable tie-break doing its job: re-sorting never reshuffles rows that did not
change, so the user is never shown movement they cannot explain.

---

## Step 24 — the persistence proof

After a full page reload and reopening the project from the home screen:

```
  Folder menu:   All media  4 at top level
                 Cutaways   1
  Results:       Cutaways · 1 result
```

And on disk, 253 bytes:

```json
{"schemaVersion":"sanverse.media-organization/v1",
 "folders":[{"folderId":"folder_b93629d667b977e6","name":"Cutaways",
             "createdAt":"2026-08-03T17:59:17.457Z"}],
 "assetFolderAssignments":{"asset_cde559d0888da3d6c33b19612e195b1c":
                           "folder_b93629d667b977e6"}}
```

This is the whole point of ADR-MEDIA-ORGANIZATION-V1 demonstrated in one file:
the filing is on the server, so it is not tied to this browser, and it is beside
the project rather than inside it, so it changed nothing about the video.

---

## Step 25 — the project did not move

```
  BEFORE the folder work    revision 4   changeSets 0   assets 5
                            sha256 39e6e0541bdb02ad57fea5d2acd7adf8461ac6954d6ff2d89ec7b40c27389d84

  create → duplicate refusal → rename → move in → move out → delete

  AFTER  the folder work    revision 4   changeSets 0   assets 5
                            sha256 39e6e0541bdb02ad57fea5d2acd7adf8461ac6954d6ff2d89ec7b40c27389d84
```

Identical hash. Since the export key is
`sha256(projectId : revision : renderPlanSchemaVersion)` and the revision did not
move, the key did not move: a re-export re-uses the finished MP4 rather than
spending 60–90 seconds re-encoding an identical video.

---

## What this walkthrough did NOT prove

State it plainly rather than let the table above imply more than it shows.

1. **No screenshots.** The browser pane was not displayed, so the page was not
   compositing frames and every screenshot attempt timed out. The evidence is
   measured DOM geometry, not pictures. Layout is proved; *appearance* is not.

2. **The OS drop was a synthesized `DragEvent`** carrying real `File` objects
   through the real handler — not a literal drag from Windows Explorer. It
   exercises exactly the code path a real drop does, and it does not prove the
   browser's own drag chrome behaves.

3. **The ≤220px minimum layout was never seen**, because today's Studio pane
   snaps from ~255px to collapsed.

4. **Media-to-Timeline drag was not tested**, because it is deliberately
   switched off. See `media-drag-contract.md`.

---

## Two pre-existing defects found while doing this

Neither was introduced by Gate B; both are recorded in `FAILURE_REGISTRY.md`.

**FAIL-047 — resizing the window strands the user with no Media panel.**
The Studio layout does not recompute its responsive mode on resize. Shrink a
window from 1440 to 1024 and the CSS hides the Media and Inspector docks at
1100px, while the compact switcher that should replace them renders only for
`tablet`/`mobile` — a mode the app is still not in. Reloading fixes it, which is
what proves the missing recomputation is the whole fault.

**FAIL-048 — imported file names are forgotten on reload.**
`logo.png` came back as `Image 1` after the page was reloaded. The name a user
recognises is held only in browser session state at upload time and is never
persisted, so the Media list loses it. Cosmetic today, and directly against the
product standard that a user should never have to hold information the product
could hold for them.
