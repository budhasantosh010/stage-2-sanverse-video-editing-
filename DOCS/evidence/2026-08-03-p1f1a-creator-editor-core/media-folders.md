# Folders — where they live, and why not anywhere else

Gate B of P1-F.1A. The decision itself is `DOCS/decisions/ADR-MEDIA-ORGANIZATION-V1.md`.
This document is the evidence that the decision is real in running code.

---

## Where your filing actually lives

```
  .sanverse-data/projects/<projectId>/
  ├── project.json              what the file is           (read-only)
  ├── source.mp4                the footage itself
  ├── edit-project.json         YOUR DECISIONS about the video
  ├── assets/                   everything else you imported
  └── media-organization.json   ◄── YOUR FILING. This gate.
```

It is a file **on the server**, **beside** the project, and **outside**
`edit-project.json`.

---

## The two things it is not, and what each would have cost

### Not the browser's own storage (localStorage)

Per-browser and per-machine. You file twenty clips on the laptop, open the same
project on the desktop, and the filing is gone. Clear your browser data and it
is gone with no warning and no way back. The server could never see it, so
nothing else could ever use it.

### Not inside `EditProject`

Three consequences, each on its own enough to reject it:

**1. Undo would walk through your filing.** You cut a shot, rename a folder,
   and press Undo expecting the cut back. Instead the folder is renamed. Undo
   has to mean "undo a decision about my video".

**2. A rename would re-render an identical video.** The export key is
   `sha256(projectId : revision : renderPlanSchemaVersion)`. Anything inside
   `EditProject` moves the revision, which moves the key, which means the next
   export cannot reuse the finished MP4 — 60 to 90 seconds of this machine's CPU
   spent producing a file that is byte-for-byte what it already had.

**3. Data the compiler must ignore should not be in the compiler's input.**
   Every future reader of `EditProject` would have to know to skip it.

This is the same call ADR-006 already made for transcripts: *a transcript is
evidence, not a decision.* Filing a clip into a folder changes not one pixel and
not one millisecond, so it is not a decision about the video.

---

## A folder is a LABEL, not a container

```
  BEFORE                          AFTER deleting "B-roll"

  All media                       All media
  ├── interview.mp4               ├── interview.mp4
  ├── [B-roll]                    ├── logo.png      ◄── came back
  │   ├── logo.png                ├── cutaway.mp4   ◄── came back
  │   └── cutaway.mp4             └── music.mp3
  └── music.mp3
```

Deleting a folder returns its media to the top level. **It never deletes media.**
Deleting a label must never be able to delete your material.

Held by a domain test and by an API-service test, and confirmed in the real
browser: after deleting the folder the project still had all 5 assets.

---

## One level. No nesting.

A folder cannot contain a folder. An asset is either at the top level or in
exactly one folder — the absence of an entry *is* "top level", so there is no
second way to say the same thing and therefore no way for two records to
disagree.

Limits: at most **32 folders**, names at most **64 characters**, names unique
after trimming and case-folding (so `B-roll`, ` b-roll `, and `B-ROLL` are the
same name).

---

## Five typed commands, never arbitrary JSON

```
  create-folder          { name }
  rename-folder          { folderId, name }
  move-asset-to-folder   { assetId, folderId }
  move-asset-to-root     { assetId }
  delete-folder          { folderId }
```

Typed and validated rather than "send me the new document" for two reasons:
a caller cannot hand over a shape nobody has thought about, and **a future AI
can call exactly the same five capabilities the buttons call** — the same rule
the edit operations already follow.

Anything else is refused, not repaired:

| What went wrong | Code | What the user is told |
|---|---|---|
| Name already used | `FOLDER_NAME_DUPLICATE` | A folder with that name already exists. |
| Folder is gone | `FOLDER_UNKNOWN` | — |
| Asset is not in this project | `ASSET_UNKNOWN` | — |
| Name empty or too long | `FOLDER_NAME_INVALID` | — |
| 32 folders already | `FOLDER_LIMIT_REACHED` | — |
| File on disk is not v1 | `ORGANIZATION_INVALID` | — |

A corrupt file is **refused, and the bytes are left on disk**, so the user's
folders can still be recovered by hand. Quietly replacing it with an empty
filing would look exactly like "all my folders vanished".

---

## The server is the authority

```
  user clicks  ──►  POST /api/projects/:id/media-organization
                      { "command": { "kind": "create-folder", "name": "B-roll" } }
                    │
                    ├─ validated by the domain
                    ├─ written to the durable file
                    └─ the WHOLE new organization comes back
                    │
                    ▼
             the panel draws what came back
```

The browser never edits its own copy and then tells the server about it. That
costs one round trip and it is worth it: the alternative is a panel showing a
folder that was refused — a lie the user cannot detect.

A refused command changes **nothing** on screen, and the form stays open with
the text still in it, so a name clash is fixed rather than retyped.

Two commands cannot race. The guard is a `ref`, not state: two clicks in the
same frame both read the old state value, so a state-based guard would let both
through — the first would succeed and the second would be refused as a
duplicate, showing the user an error for something that in fact worked.

---

## Real browser proof — 2026-08-03

Project `project_a5c6b54b60f236e1b6e789e1cc773826`, real 30-second 1080p video
plus a real PNG, a real MP3, and a second real video, on the real local server.

| Step | Result |
|---|---|
| Open project | `GET …/media-organization` → empty organization |
| Create "B-roll" | 200 · `folder_b93629d667b977e6` written to disk |
| Create " b-roll " again | **400 `FOLDER_NAME_DUPLICATE`** · form stayed open with the text |
| Rename to "Cutaways" | 200 |
| Move `logo.png` in (row menu) | 200 · assignment written |
| **Reload the whole page** | folder still there, still holding 1 asset |
| Move back to All media | 200 |
| Delete "Cutaways" | 200 · folders `[]`, **all 5 assets still present** |

On disk after the move:

```json
{"schemaVersion":"sanverse.media-organization/v1",
 "folders":[{"folderId":"folder_b93629d667b977e6","name":"Cutaways",
             "createdAt":"2026-08-03T17:59:17.457Z"}],
 "assetFolderAssignments":{"asset_cde559d0888da3d6c33b19612e195b1c":
                           "folder_b93629d667b977e6"}}
```

253 bytes, in the project's own directory. That is what "durable" means here —
not a promise, a file.

And the project itself, before and after all six operations:

```
  revision 4 → 4        changeSets 0 → 0        assets 5 → 5
  sha256 39e6e0541bdb02ad57fea5d2acd7adf8461ac6954d6ff2d89ec7b40c27389d84
       → 39e6e0541bdb02ad57fea5d2acd7adf8461ac6954d6ff2d89ec7b40c27389d84
```

Byte-identical.

---

## Where a folder problem is reported

**Inside the folder control, never as a banner across the panel.** The user's
media, their timeline, and their export are entirely unaffected by a folder
failure, and a red bar over everything would say otherwise.

The two kinds of failure get different offers, because they need different fixes:

- **could not read the folder list** → a note plus "Try again", which re-fetches.
- **the server understood and said no** (a name that clashes) → the reason, and
  no "Try again", because retrying sends the same refused command. Offering
  advice that cannot work is worse than offering none.

---

## What this design gives up, stated plainly

- **Folder changes are not undoable.** Deliberate — Undo is for decisions about
  the video. Deleting a folder is safe because the media returns to the top
  level, so there is nothing to lose.
- **Filing is not in the portable project archive.** Move a project to another
  machine and the folders do not travel with it. Worth revisiting; not now.
- **Two windows editing folders at once: last write wins, no merge.** Nothing
  in the product creates that situation today.
